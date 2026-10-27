import type { GameMe } from "@shaperoute/shared-types";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { decimal, t } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { Segmented } from "../screens/Segmented";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { inUnits } from "../units/format";
import { useUnits } from "../units/useUnits";
import { type RequestedChallenge, useRequestedChallenge } from "./challengeDoor";
import { ChallengesTab } from "./ChallengesTab";
import { useGameCatalog } from "./gameCatalog";
import { ShapeCard } from "./ShapeCard";
import { useGameMe } from "./useGameMe";

type Props = {
  /** The page is on screen: the account's game is asked for. */
  active: boolean;
  /** «Sign in to collect shapes.» touched: the way to the account. */
  onSignIn: () => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
  /** The clock of a challenge's countdown; the tests give theirs. */
  now?: () => number;
};

/** The two tabs of the page (TASK-296 part D). */
export type PlayTab = "collection" | "challenges";

const COLUMNS = 2;

/**
 * «Play» (TASK-296 parts B and D, ADR-0255; docs/GIOCO.md §9): two tabs.
 * «Collection»: the shapes of the API's catalog in a grid, the unlocked
 * ones in the yellow with their day, the others in grey with what they ask
 * and how far along the account is. Without an account the shapes are
 * shown as they are, with the way to sign in above them. «Challenges»: the
 * account's teams and their challenges (`ChallengesTab`); a challenge's
 * notification touched opens the page on it. The page exists only while
 * the API has the game (`gameCatalog`): the app shows it then.
 */
export function PlayScreen({ active, onSignIn, fetchFn, apiKey, now }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const units = useUnits();
  const language = useLanguage();
  const catalog = useGameCatalog();
  const [tab, setTab] = useState<PlayTab>("collection");
  // A challenge asked for from outside (a notification): its tab, once
  // per request; the tab opens the challenge itself.
  const requested = useRequestedChallenge();
  const [seen, setSeen] = useState<RequestedChallenge | null>(null);
  if (requested !== null && requested !== seen) {
    setSeen(requested);
    setTab("challenges");
  }
  const collection = tab === "collection";
  const { shown, refresh } = useGameMe(active && collection, { fetchFn, key: apiKey });
  const cardWidth = (width - space.md * (COLUMNS + 1)) / COLUMNS;
  const me: GameMe | null = shown.status === "ready" ? shown.me : null;
  const states = new Map(me?.shapes.map((state) => [state.id, state]) ?? []);
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + space.lg },
      ]}
      keyboardShouldPersistTaps="handled"
      testID="play-screen"
    >
      <Segmented
        options={[
          { value: "collection", label: t("Collection") },
          { value: "challenges", label: t("Challenges") },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />
      {!collection && (
        <ChallengesTab
          active={active}
          onSignIn={onSignIn}
          fetchFn={fetchFn}
          apiKey={apiKey}
          now={now}
        />
      )}
      {collection && shown.status === "off" && (
        <Pressable
          style={styles.notice}
          onPress={onSignIn}
          accessibilityRole="button"
          testID="play-sign-in"
        >
          <Text style={styles.noticeText}>{t("Sign in to collect shapes.")}</Text>
        </Pressable>
      )}
      {collection && shown.status === "loading" && (
        <ActivityIndicator color={color.textMuted} style={styles.wait} />
      )}
      {collection && shown.status === "failed" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{shown.problem}</Text>
          <Pressable
            style={styles.retry}
            onPress={refresh}
            accessibilityRole="button"
            testID="play-retry"
          >
            <Text style={styles.retryText}>{t("Try again")}</Text>
          </Pressable>
        </View>
      )}
      {collection && me !== null && (
        <Text style={styles.totals} testID="play-totals">
          {t("{distance} counted so far", {
            distance: `${decimal(inUnits(me.counted_m, units))} ${units}`,
          })}
        </Text>
      )}
      {collection &&
        (catalog === null ? (
          <Text style={styles.noticeText}>
            {t("The game is not available right now.")}
          </Text>
        ) : (
          <View style={styles.grid}>
            {catalog.shapes.map((shape) => (
              <ShapeCard
                key={shape.id}
                shape={shape}
                state={states.get(shape.id) ?? null}
                me={me}
                width={cardWidth}
                units={units}
                language={language}
              />
            ))}
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    padding: space.md,
    gap: space.md,
  },
  // On the page's background the track wants a surface to show.
  tabs: {
    backgroundColor: color.surface,
  },
  notice: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    gap: space.sm,
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  noticeText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  wait: {
    marginVertical: space.sm,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  retryText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  totals: {
    color: color.textMuted,
    fontSize: fontSize.label,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
});
