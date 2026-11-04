import type {
  ContestEntry,
  FeedPost,
  PastContest,
  ThemedContest,
} from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dayLabel } from "../activities/activityText";
import { FeedMapShooter } from "../feed/FeedMaps";
import { drawingHeight } from "../feed/FeedPost";
import { t, tPlural } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { useDrawingsDoor } from "../social/drawingsDoor";
import { useFollowsDoor } from "../social/followsDoor";
import { color, fontSize, fontWeight, MIN_TAP_SIZE, space } from "../theme/tokens";
import { fetchPastContests, themedOf, themeText } from "./contestApi";
import { closeContestPage, useAskedContest } from "./contestDoor";
import { GalleryEntry, GalleryOrder, useContestGallery } from "./ContestGallery";
import {
  enteredIn,
  type KeptContest,
  keptContest,
  refreshContest,
  useContestKept,
} from "./contestKept";
import { ContestRules } from "./ContestRules";
import { daysLeftText } from "./daysLeft";
import { PastContests } from "./PastContests";
import { useClock } from "./useClock";

/** A challenge as its page shows it: the one kept, or one of the archive. */
type Shown =
  ThemedContest | (PastContest & { theme: NonNullable<PastContest["theme"]> });

/** The challenge `contestId`, when it is the one kept on the phone. */
function themedIn(kept: KeptContest | null, contestId: string): ThemedContest | null {
  return kept !== null && kept.contest.id === contestId ? themedOf(kept.contest) : null;
}

type Props = {
  contestId: string;
  onBack: () => void;
  /** Behind a drawing opened from it: kept, with its gallery where it was. */
  hidden?: boolean;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The page of a monthly challenge (TASK-343 part B, docs/CONCORSI.md §15), over
 * the app as «Find friends» is: the theme and what it asks, its days, how
 * many take part, the prize and «How it works», the gallery «Top» | «New», and
 * at the end «Past challenges». It asks the API for the challenge as it
 * opens; one that is not the one kept is looked for in the archive (a
 * notification of results can be older than the week the API keeps it).
 */
export function ContestPage({
  contestId,
  onBack,
  hidden = false,
  fetchFn,
  apiKey,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const language = useLanguage();
  const now = useClock();
  const { apiUrl, account } = useFollowsDoor();
  const { open, openProblem } = useDrawingsDoor();
  const { state } = account;
  const signedIn = state.status === "signedIn";
  const token = signedIn ? state.session.token : null;
  const publicId = signedIn ? (state.session.user.public_id ?? null) : null;
  const kept = useContestKept();
  const themed = themedIn(kept, contestId);
  const [past, setPast] = useState<Shown | null>(null);
  const [lookedFor, setLookedFor] = useState(false);
  const [rules, setRules] = useState(false);
  const [archive, setArchive] = useState(false);
  const gallery = useContestGallery(contestId, { fetchFn, key: apiKey });

  useEffect(() => {
    let live = true;
    async function find() {
      const options = { fetchFn, key: apiKey };
      await refreshContest(apiUrl, token, publicId, options);
      if (apiUrl !== null && themedIn(keptContest(), contestId) === null) {
        const outcome = await fetchPastContests(apiUrl, token, null, options);
        const found =
          outcome.kind === "ok"
            ? outcome.value.contests.find((contest) => contest.id === contestId)
            : undefined;
        if (live && found !== undefined && found.theme !== null) {
          setPast({ ...found, theme: found.theme });
        }
      }
      if (live) {
        setLookedFor(true);
      }
    }
    void find();
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, contestId, fetchFn, publicId, token]);

  const contest: Shown | null = themed ?? past;
  const width = window.width - 2 * space.lg;
  const onOpen = signedIn ? (drawing: FeedPost) => open(drawing) : undefined;
  const paddingTop = insets.top + space.lg;
  const paddingBottom = insets.bottom + space.xl;
  const shownEntered = enteredIn(kept, publicId).length;

  const head = (
    <View style={styles.titleRow}>
      <Pressable
        style={styles.back}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("Back")}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.eyebrow} accessibilityRole="header">
        {t("Monthly challenge")}
      </Text>
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, hidden && styles.hidden]}>
      {/* Hidden, a page draws no map: it would hold up every picture. */}
      {!hidden && <FeedMapShooter width={width} height={drawingHeight(width)} />}
      {archive ? (
        <PastContests
          onBack={() => setArchive(false)}
          onOpen={onOpen}
          paddingTop={paddingTop}
          paddingBottom={paddingBottom}
          fetchFn={fetchFn}
          apiKey={apiKey}
        />
      ) : contest === null ? (
        <View style={[styles.gone, { paddingTop, paddingBottom }]}>
          {head}
          {lookedFor ? (
            <>
              <Text style={styles.description}>
                {t("This challenge is not available any more.")}
              </Text>
              <PastButton onPress={() => setArchive(true)} />
            </>
          ) : (
            <ActivityIndicator color={color.textMuted} testID="contest-page-loading" />
          )}
        </View>
      ) : (
        <FlatList<ContestEntry>
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
          data={gallery.entries}
          keyExtractor={(entry) => entry.drawing.id}
          renderItem={({ item }) => (
            <GalleryEntry entry={item} width={width} onOpen={onOpen} />
          )}
          onEndReached={gallery.more}
          onEndReachedThreshold={1}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          testID="contest-page"
          ListHeaderComponent={
            <View style={styles.about}>
              {head}
              <Text style={styles.theme} accessibilityRole="header">
                {themeText(contest.theme, language).title}
              </Text>
              <Text style={styles.description}>
                {themeText(contest.theme, language).description}
              </Text>
              <Text style={styles.facts}>
                {t("From {start} to {end}", {
                  start: dayLabel(contest.starts_at),
                  end: dayLabel(contest.ends_at),
                })}
              </Text>
              <Text style={styles.facts}>
                {contest.closed_at === null
                  ? daysLeftText(contest.ends_at, now)
                  : t("Ended")}
              </Text>
              <Text style={styles.facts}>
                {tPlural(
                  contest.entrants,
                  "{count} person taking part",
                  "{count} people taking part",
                )}
              </Text>
              {themed !== null && shownEntered > 0 && (
                <Text style={styles.own}>
                  {tPlural(
                    shownEntered,
                    "You entered {count} drawing",
                    "You entered {count} drawings",
                  )}
                </Text>
              )}
              <Text style={styles.description}>
                {t(
                  "Prize: the Winner badge on your profile and your post at the top of the Feed for a week.",
                )}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.how, pressed && styles.pressed]}
                onPress={() => setRules(true)}
                accessibilityRole="button"
              >
                <Text style={styles.howText}>{t("How it works")}</Text>
              </Pressable>
              <ContestRules
                contest={contest}
                visible={rules}
                onClose={() => setRules(false)}
              />
              <GalleryOrder value={gallery.order} onChange={gallery.setOrder} />
              {openProblem !== null && (
                <Text style={styles.problem} accessibilityRole="alert">
                  {openProblem}
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            gallery.status === "loading" ? (
              <ActivityIndicator color={color.textMuted} testID="gallery-loading" />
            ) : gallery.status === "failed" ? (
              <View style={styles.failed}>
                <Text style={styles.description} accessibilityRole="alert">
                  {t("Something went wrong.")}
                </Text>
                <Pressable
                  style={styles.how}
                  onPress={gallery.again}
                  accessibilityRole="button"
                >
                  <Text style={styles.howText}>{t("Try again")}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.description}>{t("No drawings entered yet.")}</Text>
            )
          }
          ListFooterComponent={<PastButton onPress={() => setArchive(true)} />}
        />
      )}
    </View>
  );
}

/** «Past challenges»: the way to the archive, at the end of the page. */
function PastButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.how, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.howText}>{t("Past challenges")}</Text>
    </Pressable>
  );
}

/**
 * The page where the app asks for it (`contestDoor`): `ProfileLayer` puts this
 * over the app. Behind a drawing opened from the page it stays, out of sight,
 * and back from the drawing finds it as it was.
 */
export function ContestPageHost() {
  const asked = useAskedContest();
  const { opened } = useDrawingsDoor();
  if (asked === null) {
    return null;
  }
  return (
    <ContestPage
      key={asked.id}
      contestId={asked.id}
      onBack={closeContestPage}
      hidden={opened !== null}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  hidden: {
    display: "none",
  },
  gone: {
    flex: 1,
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  content: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  about: {
    gap: space.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  eyebrow: {
    flex: 1,
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  theme: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  description: {
    color: color.text,
    fontSize: fontSize.body,
  },
  facts: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  own: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  how: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  howText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textDecorationLine: "underline",
  },
  failed: {
    gap: space.sm,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
});
