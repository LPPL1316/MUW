import type { LatLon, MessageDrawing } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Activity, fetchActivities, fetchActivity } from "../api/activities";
import { type Favorite, fetchFavorite, fetchFavorites } from "../api/favorites";
import { whereAndWhat } from "../activities/activityText";
import { RouteThumb } from "../explore/RouteThumb";
import { favoriteHeading } from "../favorites/favoriteRoute";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { drawingOfFavorite, drawingOfRun } from "./messageDrawing";

/** The side of a drawing's line in the list. */
const THUMB_SIDE = 48;

type Tab = "favorites" | "activities";

/** One row: what it draws, its line, and how to fetch it whole. */
type Row = {
  id: string;
  title: string;
  line: LatLon[];
  whole: () => Promise<MessageDrawing | null>;
};

type Props = {
  apiUrl: string;
  token: string;
  onPick: (drawing: MessageDrawing) => void;
  onClose: () => void;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Drawing» of the «+» of a conversation (TASK-333, the user's choice 5): a
 * favorite, or a run of «My activities», chosen and fetched whole; a run
 * goes cut at its ends, as the Feed shows it.
 */
export function DrawingPicker({
  apiUrl,
  token,
  onPick,
  onClose,
  fetchFn,
  apiKey,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("favorites");
  const [rows, setRows] = useState<Record<Tab, Row[] | null>>({
    favorites: null,
    activities: null,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const options = { fetchFn, key: apiKey };
    const favoriteRow = (favorite: Favorite): Row => ({
      id: favorite.id,
      title: favoriteHeading(favorite),
      line: favorite.preview,
      whole: () =>
        fetchFavorite(apiUrl, token, favorite.id, options).then((outcome) =>
          outcome.kind === "ok" ? drawingOfFavorite(outcome.value) : null,
        ),
    });
    const runRow = (run: Activity): Row => ({
      id: run.id,
      title: `${whereAndWhat(run, run.route_preview !== null)} · ${distanceLabel(run.distance_m)}`,
      line: run.track_preview,
      whole: () =>
        fetchActivity(apiUrl, token, run.id, options).then((outcome) =>
          outcome.kind === "ok" ? drawingOfRun(outcome.value) : null,
        ),
    });
    void Promise.all([
      fetchFavorites(apiUrl, token, options),
      fetchActivities(apiUrl, token, null, options),
    ]).then(([favorites, runs]) => {
      if (!live) {
        return;
      }
      setRows({
        favorites: favorites.kind === "ok" ? favorites.value.map(favoriteRow) : [],
        activities:
          runs.kind === "ok"
            ? runs.value.activities
                .filter((run) => run.track_preview.length > 1)
                .map(runRow)
            : [],
      });
    });
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, fetchFn, token]);

  function pick(row: Row) {
    setBusy(row.id);
    setProblem(null);
    void row.whole().then((drawing) => {
      setBusy(null);
      if (drawing === null) {
        setProblem(t("No connection. Try again when you are online."));
        return;
      }
      onPick(drawing);
    });
  }

  const shown = rows[tab];
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Send a drawing")}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>{t("Close")}</Text>
          </Pressable>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["favorites", "activities"] as const).map((which) => (
            <Pressable
              key={which}
              style={[styles.tab, tab === which && styles.tabOn]}
              onPress={() => setTab(which)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === which }}
            >
              <Text style={styles.tabText}>
                {which === "favorites" ? t("Favorites") : t("My activities")}
              </Text>
            </Pressable>
          ))}
        </View>
        {problem !== null && (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        )}
        {shown === null ? (
          <Text style={styles.note}>{t("Loading…")}</Text>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(row) => row.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  (pressed || busy === item.id) && styles.pressed,
                ]}
                onPress={() => pick(item)}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityState={{ disabled: busy !== null }}
              >
                <RouteThumb line={item.line} width={THUMB_SIDE} height={THUMB_SIDE} />
                <Text style={styles.rowText} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: color.background,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  close: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  closeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  tabs: {
    flexDirection: "row",
    gap: space.sm,
  },
  tab: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabOn: {
    backgroundColor: color.surfaceRaised,
    borderColor: color.borderStrong,
  },
  tabText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  row: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
