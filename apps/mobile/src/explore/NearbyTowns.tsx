import type { LatLon } from "@shaperoute/shared-types";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { keyHeaders } from "../api/apiUrl";
import { t } from "../i18n";
import type { Place } from "../places/photon";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { awayNumber } from "../units/format";
import { useUnits } from "../units/useUnits";
import { fetchNearbyCities, knownNearby, type NearbyCity } from "./nearbyCities";
import { type SampleOptions, useNearbySamples } from "./nearbySamples";
import { cityShort } from "./presets";
import { CardMapsCredit, type CardPhoto, RouteCard } from "./RouteCard";

/** A card's share of the section: two whole and the edge of the third, so
 * the row is seen to go on. */
const CARD_SHARE = 0.42;

type Props = {
  apiUrl: string | null;
  /** The start «Near me» is about. */
  near: LatLon | null;
  /** How wide the page is between its margins. */
  width: number;
  /** A town tapped: it opens as a city chosen. */
  onCity: (city: Place) => void;
  /** Injected in tests. */
  fetchFn?: typeof fetch;
  request?: SampleOptions["request"];
  /** The credit of the maps under the drawings, unless the page has it. */
  credit?: boolean;
};

/** «2.9 km» from the start; a town further than 10 km without decimals. */
export function awayKm(awayM: number): string {
  return awayNumber(awayM, "km");
}

/**
 * Under «Near me» (TASK-236): the towns around the start, six at most, a
 * card each in a row to scroll. A card shows the town's photo, with its
 * credit (TASK-283, the user's choice); a town without one, or whose photo
 * does not load, a shape drawn in it, when the API has drawn it. A tap
 * opens the town as a city of «Explore». Nothing while the towns are not
 * known, and where there are none.
 */
export function NearbyTowns({
  apiUrl,
  near,
  width,
  onCity,
  fetchFn,
  request,
  credit = true,
}: Props) {
  // The cards say how far in the app's units, at once (TASK-182).
  const miles = useUnits() === "mi";
  const lat = near?.[0];
  const lon = near?.[1];
  const [fetched, setFetched] = useState<{ key: string; towns: NearbyCity[] } | null>(
    null,
  );
  const key =
    apiUrl === null || lat === undefined || lon === undefined
      ? null
      : `${apiUrl} ${lat},${lon}`;
  useEffect(() => {
    if (key === null || apiUrl === null || lat === undefined || lon === undefined) {
      return;
    }
    const controller = new AbortController();
    void fetchNearbyCities(apiUrl, [lat, lon], {
      ...(fetchFn ? { fetchFn } : {}),
      signal: controller.signal,
    }).then((towns) => {
      if (!controller.signal.aborted && towns !== null) {
        // The same towns again are no news: nothing is drawn again.
        setFetched((was) =>
          was?.key === key && was.towns === towns ? was : { key, towns },
        );
      }
    });
    return () => controller.abort();
  }, [key, apiUrl, lat, lon, fetchFn]);
  // Fetched before, in this run of the app: there at once, no empty moment.
  const towns =
    key === null || apiUrl === null || lat === undefined || lon === undefined
      ? NO_TOWNS
      : fetched?.key === key
        ? fetched.towns
        : (knownNearby(apiUrl, [lat, lon]) ?? NO_TOWNS);
  // Drawn anyway: the town opens with its shapes ready.
  const samples = useNearbySamples(apiUrl, towns, { request });
  // The photos that did not load: their towns go back to the drawing.
  const [broken, setBroken] = useState<ReadonlySet<string>>(NO_PHOTOS);
  // One source a photo, as long as the towns are the same: a new one
  // would have the photo read again.
  const photos = useMemo(() => {
    const found = new Map<string, CardPhoto["source"]>();
    for (const town of towns) {
      if (town.photo !== undefined && apiUrl !== null) {
        found.set(town.photo.url, {
          uri: `${apiUrl}${town.photo.url}`,
          headers: keyHeaders(),
        });
      }
    }
    return found;
  }, [towns, apiUrl]);
  if (towns.length === 0) {
    return null;
  }
  const card = Math.round(width * CARD_SHARE);
  const photoOf = (town: NearbyCity): CardPhoto | undefined => {
    const source = town.photo && photos.get(town.photo.url);
    if (
      town.photo === undefined ||
      source === undefined ||
      broken.has(town.photo.url)
    ) {
      return undefined;
    }
    const url = town.photo.url;
    return {
      source,
      credit: town.photo.credit,
      onError: () => setBroken((was) => new Set(was).add(url)),
    };
  };
  const drawn = towns.some((town, i) => {
    const sample = samples[i];
    return (
      photoOf(town) === undefined &&
      (sample.status === "ready" || sample.status === "drawing") &&
      sample.route !== null
    );
  });
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("NEARBY TOWNS")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {towns.map((town, i) => {
            const sample = samples[i];
            const route =
              sample.status === "ready" || sample.status === "drawing"
                ? sample.route
                : null;
            const photo = photoOf(town);
            const name = cityShort(town.label);
            const away = miles
              ? t("{mi} mi away", { mi: awayNumber(town.away_m, "mi") })
              : t("{km} km away", { km: awayKm(town.away_m) });
            return (
              <RouteCard
                key={town.label}
                width={card}
                line={route?.preview ?? null}
                rotationDeg={route?.rotation_deg}
                title={name}
                detail={
                  photo === undefined && route === null && sample.status !== "failed"
                    ? `${away} · ${t("Drawing…")}`
                    : away
                }
                map
                photo={photo}
                onPress={() => onCity({ label: town.label, point: town.point })}
                accessibilityLabel={
                  miles
                    ? t("{town}, {mi} mi away", {
                        town: name,
                        mi: awayNumber(town.away_m, "mi"),
                      })
                    : t("{town}, {km} km away", {
                        town: name,
                        km: awayKm(town.away_m),
                      })
                }
              />
            );
          })}
        </View>
      </ScrollView>
      {credit && drawn && <CardMapsCredit />}
    </View>
  );
}

const NO_TOWNS: NearbyCity[] = [];
const NO_PHOTOS: ReadonlySet<string> = new Set();

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: "row",
    gap: space.md,
  },
});
