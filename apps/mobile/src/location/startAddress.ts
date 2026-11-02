import type { LatLon } from "@shaperoute/shared-types";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

/**
 * The start of «Draw» by the name of its street (TASK-361): «Via Roma,
 * Levico Terme» in place of «Starting from your position.». The phone's own
 * geocoder answers (Apple's on an iPhone, Google's on Android), through
 * expo-location, which the app already has: no key, no service of ours.
 * Without an answer the line stays as it was.
 */

/** What the phone's geocoder says of a point: the fields used here. */
export type Address = Pick<
  Location.LocationGeocodedAddress,
  "street" | "streetNumber" | "name" | "city" | "district" | "subregion"
>;

/**
 * «Via Roma, Levico Terme»: the street and the town. No house number: the
 * GPS is not that precise, and a wrong number reads as a mistake. Without a
 * street, the place's name (a square, a park); without a town, the
 * district or the province. Null when the answer names nothing.
 */
export function addressLine(address: Address): string | null {
  const street = clean(address.street) ?? clean(address.name);
  const town =
    clean(address.city) ?? clean(address.district) ?? clean(address.subregion);
  const parts = [street, town].filter(
    (part, index, all): part is string => part !== null && all.indexOf(part) === index,
  );
  return parts.length === 0 ? null : parts.join(", ");
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  // iOS names a point with no street by its number alone: not a name.
  return trimmed === "" || /^\d+[a-z]?$/i.test(trimmed) ? null : trimmed;
}

/** A GPS that moves less than this keeps the name it has: no new question. */
export const RENAME_AFTER_M = 75;

/** Metres between two points close to each other. */
export function metresBetween([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const toRad = Math.PI / 180;
  const x = (lon2 - lon1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad);
  const y = (lat2 - lat1) * toRad;
  return Math.hypot(x, y) * 6_371_000;
}

type Geocode = (point: LatLon) => Promise<Address[]>;

// Async, so a phone without a geocoder answers «no name», not a crash.
const phoneGeocoder: Geocode = async ([latitude, longitude]) =>
  Location.reverseGeocodeAsync({ latitude, longitude });

/**
 * The name of `point`'s street, asked again only once the point has moved
 * `RENAME_AFTER_M`; null until the answer, or with none. `point` null (no
 * GPS start) asks nothing.
 */
export function useStartAddress(
  point: LatLon | null,
  geocode: Geocode = phoneGeocoder,
): string | null {
  const [line, setLine] = useState<string | null>(null);
  // The point named last, and which question is the latest: an answer to
  // an older one, or one after the screen went, is dropped.
  const named = useRef<LatLon | null>(null);
  const asked = useRef(0);
  useEffect(
    () => () => {
      asked.current = -1;
    },
    [],
  );
  const lat = point?.[0];
  const lon = point?.[1];
  useEffect(() => {
    if (lat === undefined || lon === undefined) {
      return;
    }
    const here: LatLon = [lat, lon];
    if (named.current !== null && metresBetween(named.current, here) < RENAME_AFTER_M) {
      return;
    }
    named.current = here;
    asked.current += 1;
    const question = asked.current;
    geocode(here)
      .then((answers) => {
        if (asked.current === question) {
          setLine(answers.length > 0 ? addressLine(answers[0]) : null);
        }
      })
      .catch(() => {
        if (asked.current === question) {
          setLine(null);
        }
      });
  }, [lat, lon, geocode]);
  return point === null ? null : line;
}
