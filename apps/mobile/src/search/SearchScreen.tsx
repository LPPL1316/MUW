import type { Person } from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SamplePost } from "../feed/sampleFeed";
import { t, tLater } from "../i18n";
import { useDrawingsDoor } from "../social/drawingsDoor";
import { useFollowsDoor } from "../social/followsDoor";
import { LOG_IN_TO_FIND } from "../social/PeopleSearch";
import { usePeopleDoor } from "../social/peopleDoor";
import { useReduceMotion } from "../ui/useReduceMotion";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  motion,
  radius,
  space,
} from "../theme/tokens";
import { categoryOf, type CategoryKey } from "./categories";
import { EmptyResults } from "./EmptyResults";
import { FilterButton } from "./FilterButton";
import { FilterChip } from "./FilterChip";
import { FilterSheet } from "./FilterSheet";
import { loadRecent, saveRecent, withoutRecent, withRecent } from "./recentSearches";
import { type Result, ResultsGrid } from "./ResultsGrid";
import { SearchBar } from "./SearchBar";
import { activeCount, NO_FILTERS, type SearchFilters } from "./searchFilters";
import { StartState } from "./StartState";
import { asksAnything, useDrawingSearch } from "./useDrawingSearch";

export type SearchTab = "all" | "drawings" | "people" | "routes";

/** In English: shown with `t()`. The tabs, in their order. */
const TABS: readonly { key: SearchTab; label: string }[] = [
  { key: "all", label: tLater("All") },
  { key: "drawings", label: tLater("Drawings") },
  { key: "people", label: tLater("People") },
  { key: "routes", label: tLater("Routes") },
];

/** How many members «All» shows above the drawings. */
const PEOPLE_IN_ALL = 3;
/** How many drawings «Featured drawings» shows. */
const FEATURED = 8;
/** The featured drawings: the most liked, whatever was typed. */
const POPULAR: SearchFilters = { ...NO_FILTERS, sort: "popular" };
/** Where the page comes from as it opens: a touch smaller, a touch higher. */
const OPEN_FROM_SCALE = 0.96;
const OPEN_FROM_RISE = -8;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** An example of «Feed» touched: its route, as «Feed» opens it. */
  onOpenExample: (post: SamplePost) => void;
};

/**
 * The search of «Feed»'s lens (TASK-344, ADR-0297), over the whole app:
 * the field with the keyboard up, the tabs «All · Drawings · People ·
 * Routes», the filters' button with their number. Before anything is
 * asked, the recent searches, the categories and the featured drawings;
 * then the drawings found, two a row, and the members by name. A drawing
 * touched opens on the map with its author, an example as its route, a
 * member as their profile: the search closes first.
 */
export function SearchScreen({ visible, onClose, onOpenExample }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Mounted with the page: each opening starts from an empty field. */}
      {visible && <SearchPage onClose={onClose} onOpenExample={onOpenExample} />}
    </Modal>
  );
}

function SearchPage({ onClose, onOpenExample }: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) {
      shown.setValue(1);
      return;
    }
    const opening = Animated.timing(shown, {
      toValue: 1,
      duration: motion.sheetMs,
      // In JS: driven natively, nothing moves inside a Modal on iOS
      // (the new architecture; SuperLikeSheet.tsx).
      useNativeDriver: false,
    });
    opening.start();
    return () => opening.stop();
  }, [shown, still]);

  const [typed, setTyped] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const search = useDrawingSearch(typed, filters);
  const featured = useDrawingSearch("", POPULAR);

  const { open: openDrawing } = useDrawingsDoor();
  const { openProfile } = useFollowsDoor();
  const { open: openPeople } = usePeopleDoor();

  const remember = useCallback(() => {
    setRecent((was) => {
      const now = withRecent(was, typed);
      saveRecent(now);
      return now;
    });
  }, [typed]);

  const pick = useCallback(
    (result: Result) => {
      remember();
      onClose();
      if (result.kind === "member") {
        openDrawing(result.post);
      } else {
        onOpenExample(result.post);
      }
    },
    [onClose, onOpenExample, openDrawing, remember],
  );

  const pickPerson = useCallback(
    (person: Person) => {
      remember();
      onClose();
      openProfile(person);
    },
    [onClose, openProfile, remember],
  );

  const results = useMemo<Result[]>(() => {
    const examples = search.examples.map((post) => ({
      kind: "example" as const,
      post,
    }));
    if (tab === "routes") {
      return examples;
    }
    const members = search.members.kind === "ready" ? search.members.posts : [];
    return [...members.map((post) => ({ kind: "member" as const, post })), ...examples];
  }, [search.examples, search.members, tab]);

  const featuredResults = useMemo<Result[]>(() => {
    const fromMembers =
      featured.members.kind === "ready"
        ? featured.members.posts.map((post) => ({ kind: "member" as const, post }))
        : [];
    const examples = featured.examples.map((post) => ({
      kind: "example" as const,
      post,
    }));
    return [...fromMembers, ...examples].slice(0, FEATURED);
  }, [featured.examples, featured.members]);

  const asking = asksAnything(typed, filters);
  // While the typing has not paused, the placeholders: not the drawings of
  // the search before.
  const loading =
    search.waiting || (tab !== "routes" && search.members.kind === "loading");
  const shownResults = search.waiting ? [] : results;
  const reset = activeCount(filters) > 0 || filters.category !== null;
  const category = filters.category === null ? null : categoryOf(filters.category);

  const chooseCategory = (key: CategoryKey) =>
    setFilters((was) => ({ ...was, category: key }));

  return (
    <Animated.View
      style={[
        styles.page,
        { paddingTop: insets.top + space.sm },
        {
          opacity: shown,
          transform: [
            {
              scale: shown.interpolate({
                inputRange: [0, 1],
                outputRange: [OPEN_FROM_SCALE, 1],
              }),
            },
            {
              translateY: shown.interpolate({
                inputRange: [0, 1],
                outputRange: [OPEN_FROM_RISE, 0],
              }),
            },
          ],
        },
      ]}
      testID="search-page"
    >
      <View style={styles.top}>
        <SearchBar
          value={typed}
          onChange={setTyped}
          onSubmit={remember}
          placeholder={t("Search drawings, people, places")}
          autoFocus
          testID="search-field"
        />
        <FilterButton count={activeCount(filters)} onPress={() => setSheet(true)} />
        <Pressable
          style={styles.cancel}
          onPress={onClose}
          accessibilityRole="button"
          testID="search-cancel"
        >
          <Text style={styles.cancelText}>{t("Cancel")}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabs}
        keyboardShouldPersistTaps="handled"
      >
        {TABS.map(({ key, label }) => (
          <FilterChip
            key={key}
            label={t(label)}
            selected={tab === key}
            onPress={() => setTab(key)}
            testID={`search-tab-${key}`}
          />
        ))}
        {category !== null && (
          <FilterChip
            label={`${t(category.label)} ✕`}
            selected
            onPress={() => setFilters((was) => ({ ...was, category: null }))}
            testID="search-category"
          />
        )}
      </ScrollView>
      {tab === "people" ? (
        <PeopleList
          shown={search.people}
          onPick={pickPerson}
          onLogIn={() => {
            onClose();
            openPeople();
          }}
        />
      ) : !asking ? (
        <StartState
          recent={recent}
          onRecent={setTyped}
          onRemoveRecent={(each) =>
            setRecent((was) => {
              const now = withoutRecent(was, each);
              saveRecent(now);
              return now;
            })
          }
          onCategory={chooseCategory}
          // An API before TASK-344 part B finds nothing for
          // `shape=word`: «Words» waits for an answer that knows it.
          wordsKnown={search.wordsKnown || featured.wordsKnown}
          featured={featuredResults}
          onPick={pick}
        />
      ) : (
        <ResultsGrid
          results={shownResults}
          loading={loading}
          loadingMore={search.members.kind === "ready" && search.members.more}
          onEnd={search.more}
          onPick={pick}
          header={
            tab === "all" &&
            search.people.kind === "ready" &&
            search.people.people.length > 0 ? (
              <PeopleRows
                people={search.people.people.slice(0, PEOPLE_IN_ALL)}
                onPick={pickPerson}
              />
            ) : search.members.kind === "failed" && tab !== "routes" ? (
              <Text style={styles.note}>{search.members.problem}</Text>
            ) : null
          }
          empty={
            <EmptyResults onReset={reset ? () => setFilters(NO_FILTERS) : undefined} />
          }
        />
      )}
      <FilterSheet
        visible={sheet}
        filters={filters}
        onApply={(chosen) => {
          setFilters(chosen);
          setSheet(false);
        }}
        onClose={() => setSheet(false)}
      />
    </Animated.View>
  );
}

/** The members found in the tab «People». */
function PeopleList({
  shown,
  onPick,
  onLogIn,
}: {
  shown: ReturnType<typeof useDrawingSearch>["people"];
  onPick: (person: Person) => void;
  onLogIn: () => void;
}) {
  if (shown.kind === "off") {
    return (
      <Pressable style={styles.hint} onPress={onLogIn} accessibilityRole="button">
        <Text style={styles.note}>{t(LOG_IN_TO_FIND)}</Text>
      </Pressable>
    );
  }
  if (shown.kind === "failed") {
    return <Text style={styles.note}>{shown.problem}</Text>;
  }
  if (shown.kind === "ready" && shown.people.length === 0) {
    return <Text style={styles.note}>{t("Nobody has a name like that.")}</Text>;
  }
  return (
    <ScrollView
      contentContainerStyle={styles.gutter}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {shown.kind === "ready" && <PeopleRows people={shown.people} onPick={onPick} />}
    </ScrollView>
  );
}

/** Members, a row each: the first letter in a circle and the name. */
function PeopleRows({
  people,
  onPick,
}: {
  people: readonly Person[];
  onPick: (person: Person) => void;
}) {
  return (
    <View style={styles.people}>
      {people.map((person) => (
        <Pressable
          key={person.public_id}
          style={styles.person}
          onPress={() => onPick(person)}
          accessibilityRole="button"
          testID={`person-${person.public_id}`}
        >
          <View style={styles.initial}>
            <Text style={styles.initialText}>
              {person.username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {person.username}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The side of a member's circle. */
const INITIAL = 36;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  cancel: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingLeft: space.xs,
  },
  cancelText: {
    ...font.body,
    color: color.text,
  },
  tabsRow: {
    flexGrow: 0,
  },
  tabs: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  note: {
    ...font.small,
    color: color.textMuted,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  hint: {
    minHeight: MIN_TAP_SIZE,
  },
  gutter: {
    paddingHorizontal: space.lg,
  },
  people: {
    paddingBottom: space.sm,
  },
  person: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
  },
  initial: {
    width: INITIAL,
    height: INITIAL,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  initialText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  name: {
    ...font.body,
    flex: 1,
    color: color.text,
  },
});
