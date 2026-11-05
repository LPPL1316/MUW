import type {
  StyleGender,
  StylePost as Post,
  StyleTheme,
} from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchStylePage } from "../api/style";
import { t } from "../i18n";
import { useFollowsDoor } from "../social/followsDoor";
import { useScrollToTopOnReselect } from "../tabs/tabReselect";
import { color, font, fontWeight, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { EmptyState } from "../ui/EmptyState";
import { HEART } from "../ui/outlines";
import { StylePost } from "./StylePost";
import { styleWords } from "./styleWords";

const THEMES: readonly StyleTheme[] = ["running", "trail", "bike", "gym", "athleisure"];
const GENDERS: readonly StyleGender[] = ["women", "men"];
/** A page of the lens: the API gives at most 50. */
const PAGE = 20;

type Shown =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; posts: Post[]; before: string | null; moreFailed: boolean };

type Props = {
  /** This tab is the one on the screen: hidden, the list keeps its place. */
  visible: boolean;
  cardWidth: number;
  insetBottom: number;
  fetchFn?: typeof fetch;
};

/**
 * The lens «Style» of «Feed» (TASK-384, ADR-0326): only the MuW Style posts,
 * the newest first, with a theme and «Women» or «Men» to choose. A choice
 * touched again is let go. The end of the list reads more.
 */
export function StyleLens({ visible, cardWidth, insetBottom, fetchFn }: Props) {
  const { apiUrl } = useFollowsDoor();
  const words = styleWords();
  const [theme, setTheme] = useState<StyleTheme | null>(null);
  const [gender, setGender] = useState<StyleGender | null>(null);
  const [asked, setAsked] = useState(0);
  // What was read, with the question it answers: another question is loading.
  const question = `${theme ?? ""}|${gender ?? ""}|${asked}`;
  const [read, setRead] = useState<{ question: string; shown: Shown } | null>(null);
  const shown = useMemo<Shown>(
    () =>
      apiUrl === null
        ? { kind: "failed" }
        : read?.question === question
          ? read.shown
          : { kind: "loading" },
    [apiUrl, read, question],
  );

  useEffect(() => {
    if (apiUrl === null) {
      return;
    }
    let current = true;
    void fetchStylePage(apiUrl, { theme, gender, limit: PAGE }, { fetchFn }).then(
      (page) => {
        if (current) {
          setRead({
            question,
            shown:
              page === null
                ? { kind: "failed" }
                : { kind: "ready", ...page, moreFailed: false },
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [apiUrl, theme, gender, question, fetchFn]);

  const more = useCallback(() => {
    if (apiUrl === null || shown.kind !== "ready" || shown.before === null) {
      return;
    }
    const { before } = shown;
    void fetchStylePage(
      apiUrl,
      { theme, gender, before, limit: PAGE },
      { fetchFn },
    ).then((page) => {
      setRead((now) => {
        // Only onto the page it follows, of the same question.
        if (
          now === null ||
          now.question !== question ||
          now.shown.kind !== "ready" ||
          now.shown.before !== before
        ) {
          return now;
        }
        return {
          question,
          shown:
            page === null
              ? { ...now.shown, moreFailed: true }
              : {
                  kind: "ready",
                  posts: [...now.shown.posts, ...page.posts],
                  before: page.before,
                  moreFailed: false,
                },
        };
      });
    });
  }, [apiUrl, shown, theme, gender, question, fetchFn]);

  const scroll = useScrollToTopOnReselect<FlatList<Post>>();
  const filters = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
      testID="style-filters"
    >
      {THEMES.map((value) => (
        <Chip
          key={value}
          label={words.themes[value]}
          chosen={theme === value}
          onPress={() => setTheme(theme === value ? null : value)}
        />
      ))}
      <View style={styles.gap} />
      {GENDERS.map((value) => (
        <Chip
          key={value}
          label={words.genders[value]}
          chosen={gender === value}
          onPress={() => setGender(gender === value ? null : value)}
        />
      ))}
    </ScrollView>
  );
  return (
    <View style={visible ? styles.list : styles.hidden}>
      <FlatList<Post>
        ref={scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insetBottom + space.xl },
        ]}
        ListHeaderComponent={filters}
        data={shown.kind === "ready" ? shown.posts : []}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => <StylePost post={item} width={cardWidth} />}
        ListEmptyComponent={
          shown.kind === "loading" ? (
            <ActivityIndicator
              color={color.textMuted}
              style={styles.loading}
              testID="style-loading"
            />
          ) : shown.kind === "failed" ? (
            <EmptyState
              outline={HEART}
              title={words.lens}
              message={t("Couldn't load the Feed.")}
              action={{ label: t("Try again"), onPress: () => setAsked((n) => n + 1) }}
              testID="style-failed"
            />
          ) : (
            <EmptyState
              outline={HEART}
              title={words.lens}
              message={words.empty}
              testID="style-empty"
            />
          )
        }
        ListFooterComponent={
          shown.kind === "ready" && shown.moreFailed ? (
            <Pressable
              style={styles.chip}
              onPress={more}
              accessibilityRole="button"
              testID="style-more-failed"
            >
              <Text style={styles.chipText}>{t("Try again")}</Text>
            </Pressable>
          ) : null
        }
        onEndReached={visible ? more : undefined}
        onEndReachedThreshold={1}
        testID="style-list"
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Chip({
  label,
  chosen,
  onPress,
}: {
  label: string;
  chosen: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, chosen && styles.chipChosen]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
    >
      <Text style={[styles.chipText, chosen && styles.chipTextChosen]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
  content: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  filters: {
    gap: space.sm,
    paddingBottom: space.xs,
  },
  gap: {
    width: space.sm,
  },
  loading: {
    paddingVertical: space.xl,
  },
  // As the choices of `Segmented`: chosen is told by a lighter surface and
  // a border, not by yellow, which is the route's.
  chip: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipChosen: {
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  chipText: {
    ...font.label,
    color: color.text,
  },
  chipTextChosen: {
    fontWeight: fontWeight.bold,
  },
});
