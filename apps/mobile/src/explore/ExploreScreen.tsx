import type { LatLon } from "@shaperoute/shared-types";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { decimal, t } from "../i18n";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { distanceLabel, nearDistanceLabel, wholeDistanceLabel } from "../units/format";
import { type Units, appUnits } from "../units/units";
import { useUnits } from "../units/useUnits";
import {
  cityName,
  fetchRecommended,
  NEAR_RADIUS_M,
  type RecommendedRoute,
  routeTitle,
} from "./recommendedRoutes";
import { HeartBadge } from "../intro/HeartBadge";
import type { Place } from "../places/photon";
import { AskForRoute } from "./AskForRoute";
import type { ThemedIdea } from "./themedIdeas";
import { IdeasFromEurope } from "./IdeasFromEurope";
import {
  addedExamples,
  cityKey,
  firstExamples,
  shapesOf,
  useCityExamples,
  wordsOf,
} from "./exampleRoutes";
import { CityExamples } from "./CityExamples";
import { CityWords } from "./CityWords";
import { listAhead } from "./exploreAhead";
import { CityPicker } from "./ExploreTools";
import { NearbyTowns } from "./NearbyTowns";
import { byPlace, OWN_RADIUS_M } from "./ownRoutes";
import { cityShort } from "./presets";
import { RecommendedRow } from "./RecommendedRow";
import { CardMapsCredit, cardWidth, RouteCard } from "./RouteCard";
import type { ThemedRequest } from "./themedRoutes";
import { stillDrawing, useWaited, WhileDrawing } from "./WhileDrawing";

type ListState =
  | { status: "loading" }
  | { status: "done"; routes: RecommendedRoute[] }
  | { status: "failed" };

type Props = {
  apiUrl: string | null;
  /** Where the routes should start near: the start of the first screen. */
  near: LatLon | null;
  /** A way back, when the screen is not a page beside the others
   * (TASK-154): there the names in the header are the way. */
  onBack?: () => void;
  onOpen: (route: RecommendedRoute) => void;
  /** A city searched for (TASK-129): the list and the request start there. */
  city?: Place | null;
  onCity?: (city: Place | null) => void;
  /** The cities chosen last, first among the chips (TASK-134). */
  recent?: Place[];
  /** A shape through the places of a theme (TASK-129). */
  onAsk?: (request: ThemedRequest) => void;
  /** One of our ideas in the cities of Europe, opened as it is. */
  onIdea?: (idea: ThemedIdea) => void;
};

const NO_ROUTES: RecommendedRoute[] = [];
/**
 * The name the city's own routes give it: the catalog says "milano" where
 * the search says "Milan". From the route starting nearest the centre;
 * none when even that one starts in another town.
 */
export function ownCityName(routes: RecommendedRoute[]): string | undefined {
  const nearest = routes.reduce<RecommendedRoute | undefined>(
    (best, route) => (best === undefined || route.away_m < best.away_m ? route : best),
    undefined,
  );
  return nearest !== undefined && nearest.away_m <= OWN_RADIUS_M
    ? nearest.city
    : undefined;
}

/** "21 km", in the app's units (TASK-182: "13 mi"). */
export function kmLabel(distanceM: number): string {
  return wholeDistanceLabel(distanceM);
}

/** "640 m away", "1.4 km away"; with miles, "650 ft away", "0.9 mi away";
 * in the app's language, with its comma: «a 1,4 km» (TASK-210, part H). */
export function awayText(awayM: number): string {
  return t("{distance} away", { distance: nearDistanceLabel(awayM, appUnits()) });
}

/**
 * "Explore" (TASK-092 variant C, TASK-126): the best routes already planned
 * near the start, all of them, the best first: nothing to filter (TASK-176).
 * A route opens on the map.
 */
export function ExploreScreen({
  apiUrl,
  near: start,
  onBack,
  onOpen,
  city = null,
  onCity,
  recent = [],
  onAsk,
  onIdea,
}: Props) {
  // A city searched for takes the place of the start (TASK-129).
  const near = city?.point ?? start;
  const insets = useSafeAreaInsets();
  // The cards are written again when «Settings» changes the units (TASK-182).
  const units = useUnits();
  // What the page has between its side margins: two cards side by side.
  const { width } = useWindowDimensions();
  const contentWidth = width - 2 * space.lg;
  const card = cardWidth(contentWidth);
  // The answer for one start: another start shows "loading" until its own.
  const [answer, setAnswer] = useState<{ key: string; list: ListState } | null>(null);
  const lat = near?.[0];
  const lon = near?.[1];
  const key =
    apiUrl === null || lat === undefined || lon === undefined
      ? null
      : `${apiUrl} ${lat},${lon}`;
  // The list fetched as the app opened (TASK-306), read once a start: it is
  // not asked again.
  const ahead = useMemo(() => (key === null ? undefined : listAhead(key)), [key]);

  useEffect(() => {
    if (
      key === null ||
      apiUrl === null ||
      lat === undefined ||
      lon === undefined ||
      ahead !== undefined
    ) {
      return;
    }
    const controller = new AbortController();
    void fetchRecommended(apiUrl, [lat, lon], { signal: controller.signal }).then(
      (outcome) => {
        if (!controller.signal.aborted) {
          setAnswer({
            key,
            list:
              outcome.kind === "routes"
                ? { status: "done", routes: outcome.routes }
                : { status: "failed" },
          });
        }
      },
    );
    return () => controller.abort();
  }, [key, apiUrl, lat, lon, ahead]);

  const list: ListState =
    key === null
      ? { status: "failed" }
      : answer?.key === key
        ? answer.list
        : ahead !== undefined
          ? { status: "done", routes: ahead }
          : { status: "loading" };
  const routes = list.status === "done" ? list.routes : NO_ROUTES;
  // Near a chosen city, its own routes and its neighbours' (TASK-192):
  // Caldonazzo has Levico's within "near you", and none starting in it.
  // Near the start they are all one list.
  const chosen = city !== null;
  const { own, nearby } = useMemo(
    () => (chosen ? byPlace(routes) : { own: routes, nearby: NO_ROUTES }),
    [chosen, routes],
  );
  // A chosen city has shapes drawn at once, and they go on while a route is
  // open on the map. Without routes of its own they are its examples
  // (TASK-143); with them, the shapes it has none of, added to its cards
  // while those are looked at (TASK-176).
  const drawnCity = city !== null && list.status === "done" ? city : null;
  // Its words are not written again either (TASK-279).
  const has = useMemo(
    () => (own.length === 0 ? undefined : [...shapesOf(own), ...wordsOf(own)]),
    [own],
  );
  const { examples, words, retry } = useCityExamples(apiUrl, drawnCity, { has });
  const examplesCity = has === undefined ? drawnCity : null;
  const added =
    has === undefined || examples === null ? [] : addedExamples(examples, has);
  // The city's routes, then the shapes drawn for it now: the same cards,
  // and the same name for the city, on the card and then on the map.
  const ownName = useMemo(() => ownCityName(own), [own]);
  const cards = [
    ...own,
    ...added.flatMap((example) =>
      example.status === "ready"
        ? [ownName === undefined ? example.route : { ...example.route, city: ownName }]
        : [],
    ),
  ];
  // While the first are drawn, drawings of «Feed» to look at (TASK-163): the
  // other shapes arrive when there is already something to choose.
  const examplesKey = examplesCity === null ? null : cityKey(examplesCity.point);
  const drawing = stillDrawing(examples === null ? null : firstExamples(examples));
  // With the neighbours' routes under the examples there is already
  // something to look at: the feed stays out.
  const waited = useWaited(nearby.length > 0 ? null : examplesKey, drawing);
  // The examples' section has the maps' credit once one of them is ready.
  const credited =
    examplesCity !== null &&
    examples !== null &&
    examples.some((example) => example.status === "ready");
  // After the city's shapes, its words (TASK-279), named as its cards; the
  // row has the maps' credit when nothing above it has.
  const wordsRow = words !== null && (
    <CityWords
      words={words.map((word) =>
        word.status === "ready" && ownName !== undefined
          ? { ...word, route: { ...word.route, city: ownName } }
          : word,
      )}
      width={contentWidth}
      onOpen={onOpen}
      credit={routes.length === 0 && !credited}
    />
  );
  const routeCard = (route: RecommendedRoute, width: number = card) => (
    <RouteCard
      key={route.id}
      width={width}
      line={route.preview}
      rotationDeg={route.rotation_deg}
      title={`${capitalised(routeTitle(route))} · ${distanceLabel(route.route_m, units)}`}
      detail={`${cityName(route.city)} · ${awayText(route.away_m)}`}
      match={route.similarity}
      map
      onPress={() => onOpen(route)}
      accessibilityLabel={`${routeTitle(route)}, ${kmLabel(route.route_m)}, ${awayText(route.away_m)}`}
    />
  );

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        {onBack && (
          <Pressable
            style={styles.back}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t("Back")}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
        )}
        <View style={styles.titles}>
          <Text style={styles.title}>{t("Best near you")}</Text>
          <Text style={styles.subtitle}>
            {t("Starting within {distance} of {place}", {
              distance: kmOrMiles(NEAR_RADIUS_M, units),
              place: city?.label ?? t("your start"),
            })}
          </Text>
        </View>
        {/* The sign of Sgrava, under the button of «Profile» and as wide
            (TASK-222, ADR-0184): a picture, not a button. */}
        <HeartBadge size={MIN_TAP_SIZE} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + space.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {onCity && (
          <CityPicker apiUrl={apiUrl} city={city} onCity={onCity} recent={recent} />
        )}
        {/* Under «Near me», the towns around the start (TASK-236); the page
            has the maps' credit when it has routes. */}
        {onCity && city === null && (
          <NearbyTowns
            apiUrl={apiUrl}
            near={start}
            width={contentWidth}
            onCity={onCity}
            credit={routes.length === 0}
          />
        )}
        {examplesCity !== null && examples !== null && (
          <CityExamples
            city={examplesCity}
            examples={examples}
            onOpen={onOpen}
            onRetry={retry}
            width={contentWidth}
          />
        )}
        {examplesCity !== null && wordsRow}
        {examplesKey !== null && waited && (
          <WhileDrawing cityKey={examplesKey} drawing={drawing} />
        )}
        {list.status === "loading" && (
          <Text style={styles.note}>{t("Loading routes…")}</Text>
        )}
        {list.status === "failed" && (
          <Text style={styles.note}>
            {near === null
              ? t("Choose a start first: the routes are the ones near it.")
              : t("The routes could not load. Check the connection and try again.")}
          </Text>
        )}
        {list.status === "done" && routes.length === 0 && examplesCity === null && (
          <Text style={styles.note}>
            {t(
              "No recommended routes near this start yet. Draw one: the best ones will show up here.",
            )}
          </Text>
        )}
        {/* Above the cards: there it is read without scrolling to their end. */}
        {routes.length > 0 && !credited && <CardMapsCredit />}
        {/* The ones the API recommends, in a row above all of them
            (TASK-092, ADR-0229); only with an account, else nothing. */}
        {list.status === "done" && routes.length > 0 && (
          <RecommendedRow
            apiUrl={apiUrl}
            near={near}
            width={contentWidth}
            card={routeCard}
          />
        )}
        {/* The drawing first: two cards side by side (TASK-167). */}
        {own.length > 0 && (
          <View style={styles.grid}>
            {cards.map((route) => routeCard(route))}
            {/* The shape being drawn for the city: the next card, on its way. */}
            {added.map(
              (example) =>
                example.status === "drawing" && (
                  <RouteCard
                    key={example.shape}
                    width={card}
                    line={null}
                    title={capitalised(
                      routeTitle({ shape: example.shape, word: null }),
                    )}
                    detail={t("Drawing…")}
                  />
                ),
            )}
          </View>
        )}
        {own.length > 0 && wordsRow}
        {/* The neighbours' routes, under the city's own: alternatives a short
            run away (TASK-192). */}
        {city !== null && nearby.length > 0 && (
          <Text style={styles.label}>
            {t("NEAR {city}", { city: cityShort(city.label).toUpperCase() })}
          </Text>
        )}
        {nearby.length > 0 && (
          <View style={styles.grid}>{nearby.map((route) => routeCard(route))}</View>
        )}
        {/* Under the routes already there, and open, with our ideas in it
            (the user's choice of 2026-10-29). */}
        {onAsk && (
          <AskForRoute
            city={city}
            where={city?.label ?? t("your start")}
            onAsk={(text) => onAsk({ text, centre: near, city: city?.label ?? null })}
            ideas={
              onIdea && (
                // Their maps after those of the routes above them.
                <IdeasFromEurope
                  width={contentWidth - 2 * space.md}
                  onIdea={onIdea}
                  maps={list.status !== "loading"}
                  apiUrl={apiUrl}
                />
              )
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  titles: {
    flex: 1,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  list: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
    paddingVertical: space.lg,
  },
  // As the label of the examples' section (CityExamples).
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    marginTop: space.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
});

/** "5 km", "2.5 km" (with the language's comma); with miles, "3.1 mi". */
export function kmOrMiles(metres: number, units: Units): string {
  if (units === "mi") {
    return distanceLabel(metres, "mi");
  }
  const km = metres / 1000;
  return `${decimal(km, Number.isInteger(km) ? 0 : 1)} km`;
}
