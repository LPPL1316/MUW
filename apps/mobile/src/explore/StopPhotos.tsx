import type { LatLon } from "@shaperoute/shared-types";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { keyHeaders } from "../api/apiUrl";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import type { TownPhoto } from "./nearbyCities";
import { apiPhoto, usePlacePhotos } from "./placePhotos";
import { creditParts } from "./RouteCard";
import type { ThemedStop } from "./themedRoutes";

/** A place passed by, numbered in the order the route meets it. */
export type NumberedStop = ThemedStop & { n: number };

/** The places passed by, «1», «2»…: as the map and the row number them. */
export function passedStops(stops: readonly ThemedStop[]): NumberedStop[] {
  return stops.filter((s) => s.passed).map((s, i) => ({ ...s, n: i + 1 }));
}

/** The places for the map: those passed by named with their number,
 * «1 Colosseum», as in the row of photos under it. */
export function mapStops(stops: readonly ThemedStop[]): ThemedStop[] {
  let n = 0;
  return stops.map((s) => (s.passed ? { ...s, name: `${(n += 1)} ${s.name}` } : s));
}

/** A card of the row: two stand side by side and a third peeks in. */
const CARD_WIDTH = 150;
const PHOTO_HEIGHT = 100;

type Props = {
  /** Every place of the route; those passed by have a card. */
  stops: readonly ThemedStop[];
  apiUrl: string | null;
  /** A tap on a card: the map goes to its place. */
  onPlace?: (point: LatLon) => void;
  fetchFn?: typeof fetch;
};

/**
 * Under the map of a themed route (TASK-329, the user's choice of
 * 2026-10-29): the places it passes by, in a row that slides sideways, each
 * with its real photo and the credit its licence asks for written small on
 * it, as the towns' cards (ADR-0243); a place without a free photo, or whose
 * photo does not load, has its name alone. A route the API planned has the
 * photos on its places, `null` for none; an idea's places have no `photo`
 * at all, and ask the API for theirs by their items.
 */
export function StopPhotos({ stops, apiUrl, onPlace, fetchFn }: Props) {
  const passed = useMemo(() => passedStops(stops), [stops]);
  const asked = useMemo(
    () =>
      passed.flatMap((s) =>
        s.photo === undefined && typeof s.wikidata === "string" ? [s.wikidata] : [],
      ),
    [passed],
  );
  const fetched = usePlacePhotos(apiUrl, asked, fetchFn);
  // The photos that did not load: their places keep the name alone.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const photos = useMemo(
    () =>
      passed.map((s): TownPhoto | null => {
        const photo =
          apiPhoto(s.photo) ??
          (typeof s.wikidata === "string" ? fetched.get(s.wikidata) : undefined);
        return photo ?? null;
      }),
    [passed, fetched],
  );
  // One source a photo, as long as the places are the same: a new one
  // would have the photo read again.
  const sources = useMemo(
    () =>
      new Map(
        photos.flatMap((p) =>
          p === null || apiUrl === null
            ? []
            : [[p.url, { uri: `${apiUrl}${p.url}`, headers: keyHeaders() }] as const],
        ),
      ),
    [photos, apiUrl],
  );
  if (passed.length === 0) {
    return null;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="stop-photos">
      <View style={styles.row}>
        {passed.map((stop, i) => {
          const photo = photos[i];
          const source = photo === null ? undefined : sources.get(photo.url);
          const shown =
            photo !== null && source !== undefined && !broken.has(photo.url);
          const label = `${stop.n} ${stop.name}`;
          return (
            <Pressable
              key={stop.n}
              style={({ pressed }) => [
                styles.card,
                !shown && styles.nameAlone,
                pressed && styles.pressed,
              ]}
              onPress={onPlace && (() => onPlace(stop.point))}
              disabled={onPlace === undefined}
              accessibilityRole="button"
              accessibilityLabel={label}
              testID="stop-photo"
            >
              {shown && (
                <View style={styles.photo}>
                  <Image
                    testID="stop-photo-image"
                    style={StyleSheet.absoluteFill}
                    source={source}
                    resizeMode="cover"
                    onError={() => setBroken((was) => new Set(was).add(photo.url))}
                    accessible={false}
                  />
                  {photo.credit !== null && (
                    <View style={styles.credit} pointerEvents="none">
                      <View style={[StyleSheet.absoluteFill, styles.creditShade]} />
                      {creditParts(photo.credit).map((part, k) => (
                        <Text
                          key={k}
                          style={[
                            styles.creditText,
                            k === 0 ? styles.creditWho : styles.creditLicence,
                          ]}
                          numberOfLines={1}
                        >
                          {part}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
              <Text style={styles.name} numberOfLines={shown ? 2 : 4}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  // As a card of «Explore».
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  // Without a photo, the name fills the card.
  nameAlone: {
    minHeight: PHOTO_HEIGHT,
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
  },
  pressed: {
    opacity: 0.6,
  },
  photo: {
    width: "100%",
    height: PHOTO_HEIGHT,
    backgroundColor: color.surfaceRaised,
  },
  name: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  // The credit small in its corner, as on the towns' cards (TASK-283).
  credit: {
    position: "absolute",
    right: 0,
    bottom: 0,
    maxWidth: "100%",
    flexDirection: "row",
    paddingHorizontal: space.xs,
    paddingVertical: 1,
    borderTopLeftRadius: radius.sm / 2,
    overflow: "hidden",
  },
  creditShade: {
    backgroundColor: color.scrim,
    opacity: 0.6,
  },
  creditText: {
    color: color.onScrim,
    fontSize: fontSize.label,
  },
  creditWho: {
    flexShrink: 1,
  },
  creditLicence: {
    marginLeft: space.xs,
  },
});
