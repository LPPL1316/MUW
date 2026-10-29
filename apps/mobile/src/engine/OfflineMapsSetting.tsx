import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { apiUrl } from "../api/apiUrl";
import { t } from "../i18n";
import { PlaceSearch } from "../places/PlaceSearch";
import type { FindPlaces } from "../places/placeFinder";
import { activityOf, loadSport } from "../settings/sport";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import {
  addPlace,
  ASK_AGAIN_MS,
  forgetPlaces,
  type KeptPlace,
  keepPlaces,
  MAX_PLACES,
  readPlaces,
  removePlace,
  watchPlaces,
} from "./keptPlaces";
import { sizeText } from "./sizeText";
import { deleteZones, NETWORKS, savedBytes, savedZones, watchZones } from "./zones";

type Props = {
  /** The API that prepares the places; null without one. */
  baseUrl?: string | null;
  keep?: (baseUrl: string) => Promise<void>;
  /** Where «Add a place» finds places (PlaceSearch's, by default). */
  find?: FindPlaces;
};

/**
 * «Offline maps» in «Settings» (TASK-214, part C): the space the zones of
 * the engine on the phone take, with «Delete», and under it how they
 * download. The texts are the user's choice of 2026-10-03. The size follows
 * the zones while the page is open; after «Delete» the phone downloads its
 * maps again at the next opening, as after the install.
 *
 * Under it the places the user keeps (TASK-334, `keptPlaces.ts`), each with
 * its size or how it is going and «✕», and «Add a place», which finds a town
 * by name: the user's choice of 2026-10-29. While a place is being prepared
 * the server is asked again every ASK_AGAIN_MS. «Delete» deletes the places
 * too.
 */
export function OfflineMapsSetting({
  baseUrl = apiUrl(),
  keep = keepPlaces,
  find,
}: Props) {
  const [bytes, setBytes] = useState(() => savedBytes());
  const [places, setPlaces] = useState(() => readPlaces());
  const [adding, setAdding] = useState(false);
  useEffect(
    () =>
      watchZones(() => {
        setBytes(savedBytes());
        setPlaces(readPlaces());
      }),
    [],
  );
  useEffect(() => watchPlaces(() => setPlaces(readPlaces())), []);
  const waiting = places.some((place) => place.status === "preparing");
  useEffect(() => {
    if (baseUrl === null) {
      return;
    }
    void keep(baseUrl);
    if (!waiting) {
      return;
    }
    const timer = setInterval(() => void keep(baseUrl), ASK_AGAIN_MS);
    return () => clearInterval(timer);
  }, [baseUrl, keep, waiting]);

  function deleteAll() {
    forgetPlaces();
    deleteZones();
  }

  const zoneBytes = new Map(savedZones().map((zone) => [zone.name, zone.bytes]));
  const full = places.length >= MAX_PLACES;
  return (
    <View style={styles.setting}>
      <View style={styles.menu}>
        <View style={styles.row}>
          <Text style={styles.emoji}>🗺️</Text>
          <Text style={styles.rowText}>
            {t("Offline maps: {size}", { size: sizeText(bytes) })}
          </Text>
          {(bytes > 0 || places.length > 0) && (
            <Pressable
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              onPress={deleteAll}
              accessibilityRole="button"
            >
              <Text style={styles.deleteText}>{t("Delete")}</Text>
            </Pressable>
          )}
        </View>
        {places.map((place, index) => (
          <View
            key={`${place.network} ${place.point.join(" ")}`}
            style={[styles.row, styles.divided]}
          >
            <Text style={styles.emoji}>{place.status === "ready" ? "📍" : "⏳"}</Text>
            <Text style={styles.rowText} numberOfLines={1}>
              {placeLine(place, zoneBytes)}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              onPress={() => removePlace(index)}
              accessibilityRole="button"
              accessibilityLabel={t("Remove {name}", { name: shortName(place) })}
            >
              <Text style={styles.deleteText}>✕</Text>
            </Pressable>
          </View>
        ))}
        {!full && (
          <Pressable
            style={({ pressed }) => [
              styles.row,
              styles.divided,
              pressed && styles.pressed,
            ]}
            onPress={() => setAdding((now) => !now)}
            accessibilityRole="button"
            accessibilityLabel={t("Add a place")}
            accessibilityState={{ expanded: adding }}
          >
            <Text style={styles.emoji}>＋</Text>
            <Text style={styles.rowText}>{t("Add a place")}</Text>
          </Pressable>
        )}
        {adding && !full && (
          <View style={[styles.search, styles.divided]}>
            <PlaceSearch
              find={find}
              onSelect={(place) => {
                // The sport's network; with paddling, whose routes are the
                // server's, the foot one, first in networksInOrder too.
                addPlace(
                  place.label,
                  place.point,
                  NETWORKS[activityOf(loadSport())] ?? "foot",
                );
                setAdding(false);
              }}
            />
          </View>
        )}
      </View>
      <Text style={styles.note}>{t("Maps download on Wi-Fi and mobile data.")}</Text>
      <Text style={styles.note}>
        {full
          ? t("Up to {count} places.", { count: MAX_PLACES })
          : t(
              "Places you add stay on the phone, so shapes there are drawn faster, even without signal.",
            )}
      </Text>
    </View>
  );
}

/** The town of a place as the search wrote it: «Levico Terme, Trentino»
 * shows «Levico Terme». */
function shortName(place: KeptPlace): string {
  return place.label.split(",")[0].trim() || place.label;
}

function placeLine(place: KeptPlace, zoneBytes: ReadonlyMap<string, number>): string {
  const name = shortName(place);
  if (place.status === "ready" && place.zone !== null) {
    return `${name} · ${sizeText(zoneBytes.get(place.zone) ?? 0)}`;
  }
  if (place.status === "later") {
    return `${name} · ${t("Trying again later")}`;
  }
  return `${name} · ${t("Preparing the map…")}`;
}

// The rows of «Settings» (`../profile/SettingsPage`), so the row sits among
// the others as one of them.
const styles = StyleSheet.create({
  setting: {
    gap: space.sm,
  },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  search: {
    padding: space.md,
  },
  emoji: {
    fontSize: fontSize.input + space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  // Neutral: the yellow belongs to the route (docs/UI.md, «Il tema»).
  delete: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  deleteText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.6,
  },
  note: {
    paddingHorizontal: space.md,
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});
