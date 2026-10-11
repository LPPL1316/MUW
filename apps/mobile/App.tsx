import type {
  Activity,
  Direction,
  LatLon,
  LetterStyle,
  OutlinePoint,
  PenUpShape,
  Shape,
  Stretch,
  Walk,
} from "@shaperoute/shared-types";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useActivitiesDoor } from "./src/activities/activitiesDoor";
import { ActivityCard } from "./src/activities/ActivityCard";
import { type Drawn, sameLine } from "./src/activities/recordedRun";
import { RunEnd } from "./src/activities/RunEnd";
import { apiUrl } from "./src/api/apiUrl";
import {
  chooseStart,
  showsSearch,
  type Start,
  type StartMode,
} from "./src/location/startMode";
import {
  type PositionState,
  useCurrentPosition,
} from "./src/location/useCurrentPosition";
import { ExploredCard } from "./src/explore/ExploredCard";
import { useExplored } from "./src/explore/explored";
import { ExploreScreen } from "./src/explore/ExploreScreen";
import {
  loadRecentCities,
  remember,
  saveRecentCities,
} from "./src/explore/recentCities";
import { ThemedCard, themedGpx } from "./src/explore/ThemedCard";
import { startViewOf, useStartDirections } from "./src/explore/useStartDirections";
import { useThemedRoute } from "./src/explore/useThemedRoute";
import { FavoriteHeart } from "./src/favorites/FavoriteHeart";
import {
  drawnKeepable,
  exploredKeepable,
  themedKeepable,
} from "./src/favorites/favoriteRoute";
import { useFavoritesDoor } from "./src/favorites/favoritesDoor";
import { fetchPostRoute, postRoute } from "./src/feed/feedRoute";
import { PhoneEngineView } from "./src/engine/PhoneEngineView";
import { usePhoneZones } from "./src/engine/usePhoneZones";
import { ZoneNotice } from "./src/engine/ZoneNotice";
import { useLanguage } from "./src/i18n/useLanguage";
import { MapView } from "./src/map/MapView";
import { NorthArrow } from "./src/map/NorthArrow";
import { useTurnedMap } from "./src/map/turnedMap";
import {
  canResume,
  endFreeRun,
  type FreeRun,
  isFreeRun,
  pendingFreeRun,
} from "./src/navigation/freeRun";
import { headingDeg } from "./src/navigation/runStats";
import {
  clearRun,
  endRun,
  interruptedRun,
  loadRun,
  pendingRun,
  type SavedRun,
  type ScorableRun,
} from "./src/navigation/trackStore";
import { trackOf, useFreeRun } from "./src/navigation/useFreeRun";
import { trackOfNavigation, useNavigation } from "./src/navigation/useNavigation";
import type { Place } from "./src/places/photon";
import { choicesOf, type Picked, pickedIndex } from "./src/route/choices";
import { ImageEditsContext } from "./src/route/imageEdits";
import type { ChoiceKind } from "./src/route/problems";
import { shapeAsked } from "./src/route/penUpShapes";
import { DrawButton, RouteChoice, RouteOutcome } from "./src/route/RoutePanel";
import { shapeName, toShape } from "./src/route/shapeWords";
import { type ExportState, useGpxExport } from "./src/route/useGpxExport";
import { useImageOutline } from "./src/route/useImageOutline";
import {
  type AnyRouteRequest,
  type RouteState,
  sameRequest,
  useRouteRequest,
} from "./src/route/useRouteRequest";
import { useShapeReading } from "./src/route/useShapeReading";
import { checkWord } from "./src/route/wordInput";
import { ChooseScreen } from "./src/screens/ChooseScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { FinishBanner, FinishCard } from "./src/screens/FinishScreen";
import {
  FreeFinishBanner,
  FreeFinishCard,
  FreeRunBanner,
  FreeRunCard,
} from "./src/screens/FreeRunScreen";
import { MapScreen } from "./src/screens/MapScreen";
import { NavigationBanner, NavigationCard } from "./src/screens/NavigateScreen";
import { Pager } from "./src/screens/Pager";
import { pageTitle } from "./src/screens/pageTitles";
import { ProfileButton, ProfileLayer } from "./src/screens/ProfileLayer";
import { PaddleExplore } from "./src/paddle/PaddleExplore";
import { MoveShape } from "./src/paddle/MoveShape";
import { PaddleNotice } from "./src/paddle/PaddleNotice";
import { distanceOnSpot, SPOT_SEARCH_HINT, spotPlaces } from "./src/paddle/placeSpots";
import { usePaddleNotice } from "./src/paddle/safetyNotice";
import { useMoveExample } from "./src/paddle/useMoveExample";
import { useMoveShape } from "./src/paddle/useMoveShape";
import { activityOf, withoutRouteLabel } from "./src/settings/sport";
import { SportButton } from "./src/settings/SportButton";
import { useSport } from "./src/settings/useSport";
import { DrawingCard } from "./src/social/DrawingCard";
import { drawingDoubleTapped } from "./src/social/DrawingReactions";
import { useDrawingsDoor } from "./src/social/drawingsDoor";
import { color, space, statusBarStyle } from "./src/theme/tokens";
import { useDrawDistance } from "./src/units/useDrawDistance";
import { useUnits } from "./src/units/useUnits";

/** A route without directions: one list, so navigation does not restart. */
const NO_DIRECTIONS: Direction[] = [];
/** No other routes on the map: one list, so the map is not told again. */
const NO_OTHERS: LatLon[][] = [];

/** The API on the PC that serves the app (ADR-0031); null if unknown. */
const API_URL = apiUrl();

/** The screens (TASK-051): what to draw, the map with the route, the
 * turn-by-turn along it (TASK-049), the run with its score (TASK-113), the
 * best routes near the start (TASK-126), a run without a route with its
 * end (TASK-149), and what runners publish (TASK-154, then TASK-118). */
type Screen =
  "choose" | "map" | "navigate" | "finish" | "explore" | "run" | "runFinish" | "feed";

/** The screens that are pages side by side, left to right, one swipe apart
 * (TASK-154, ADR-0124); the others take the whole screen. */
const PAGES: readonly Screen[] = ["feed", "choose", "explore"];

/** A run that ended, shown on the finish screen. */
type Finished = {
  run: ScorableRun;
  /** Its points, once: a new list would draw the line again. */
  line: ScorableRun["route"];
  /** Stopped just now, its route still on screen: it can go on. */
  resumable: boolean;
};

/** A route of "Explore" run with the directions asked for it (TASK-145). */
type ExploreRun = {
  points: LatLon[];
  directions: Direction[];
  similarity: number;
  /** A favorite of a word with the pen up (TASK-199): its walks and word. */
  walks?: Walk[];
  word?: string | null;
  /** A bike route (TASK-206): its stretches with the bike on foot. */
  on_foot?: Stretch[];
  /** What it is for (TASK-216): a favorite kept by bike is followed by bike. */
  activity?: Activity;
  /** How far its shape is turned (TASK-232): the map stays turned as it. */
  rotation_deg?: number;
  /** The route of a run the app was closed during, opened again with the
   * app (TASK-272): it has no card of "Explore" to go back to. */
  reopened?: true;
};

/** A run the app was closed during, lately, if any (TASK-272): it opens
 * again, paused. */
function leftRunning(): SavedRun | null {
  return interruptedRun(loadRun(), Date.now());
}

/** The route of a run opened again with the app (TASK-272), as its file
 * keeps it: followed as it was, with its turns, its word, its stretches
 * on foot. */
function reopenedRoute(run: SavedRun): ExploreRun {
  return {
    points: run.route,
    directions: run.directions ?? NO_DIRECTIONS,
    // Always there: a run of a route without it is not opened again.
    similarity: run.similarity ?? 0,
    ...(run.walks !== undefined ? { walks: run.walks, word: run.word ?? null } : {}),
    ...(run.on_foot !== undefined ? { on_foot: run.on_foot } : {}),
    ...(run.activity !== undefined ? { activity: run.activity } : {}),
    ...(run.rotation_deg !== undefined ? { rotation_deg: run.rotation_deg } : {}),
    reopened: true,
  };
}

function finishedRun(run: ScorableRun, resumable: boolean): Finished {
  return { run, line: run.track.fixes.map((fix) => fix.point), resumable };
}

/** A run left without its score when the app was last open, if any. */
function leftRun(): Finished | null {
  const run = pendingRun();
  return run === null ? null : finishedRun(run, false);
}

/** A run without a route that ended (TASK-149). */
type FreeFinished = {
  run: FreeRun;
  /** Its points, once: a new list would draw the line again. */
  line: LatLon[];
  /** «Run» again would go on with its track. */
  resumable: boolean;
};

function freeFinishedRun(run: FreeRun, resumable: boolean): FreeFinished {
  return { run, line: run.track.fixes.map((fix) => fix.point), resumable };
}

/** A run without a route left when the app was last open, if any. */
function leftFreeRun(): FreeFinished | null {
  const run = pendingFreeRun();
  return run === null ? null : freeFinishedRun(run, canResume(run, Date.now()));
}

export default function App() {
  // A new language from «Settings» renders the whole app again in it (TASK-210).
  useLanguage();
  // And so do new units (TASK-182 part E).
  useUnits();
  return (
    <SafeAreaProvider>
      {/* The account, and «Profile» over the app (TASK-115, TASK-154). */}
      <ProfileLayer apiUrl={API_URL}>
        <MuW />
      </ProfileLayer>
      {/* Light on the dark tone, dark on the light one, on any phone
          setting (TASK-263). */}
      <StatusBar style={statusBarStyle} />
      {/* Routes drawn on the phone, out of sight (TASK-214). */}
      <PhoneEngineView />
    </SafeAreaProvider>
  );
}

function MuW() {
  // A run the app was closed during opens again, paused, on its run screen
  // (TASK-272, ADR-0240: the user's choice).
  const [reopened] = useState(leftRunning);
  // Else a run still waiting for its score comes first (TASK-113).
  const [finished, setFinished] = useState<Finished | null>(() =>
    reopened === null ? leftRun() : null,
  );
  // Or a run without a route, closed with the app (TASK-149).
  const [freeFinished, setFreeFinished] = useState<FreeFinished | null>(() =>
    reopened === null && finished === null ? leftFreeRun() : null,
  );
  const [screenNow, setScreen] = useState<Screen>(() =>
    reopened !== null
      ? isFreeRun(reopened)
        ? "run"
        : "navigate"
      : finished !== null
        ? "finish"
        : freeFinished !== null
          ? "runFinish"
          : "choose",
  );
  // A favorite opened from «Profile» (TASK-171) takes the map at once, over
  // the page it was opened from, as a route of "Explore" does.
  const {
    opened: favorite,
    close: closeFavorite,
    showList: showFavorites,
  } = useFavoritesDoor();
  // And so does a run opened from «My activities» (TASK-172).
  const {
    opened: activity,
    close: closeActivity,
    showList: showActivities,
    remove: removeActivity,
    record: recordRun,
    signedIn,
  } = useActivitiesDoor();
  // And so does a drawing opened from a profile (TASK-117).
  const { opened: drawing, back: backFromDrawing } = useDrawingsDoor();
  const onPage = PAGES.includes(screenNow);
  const screen: Screen =
    (favorite !== null || activity !== null || drawing !== null) && onPage
      ? "map"
      : screenNow;
  // A run of «My activities» on the map, as the end of a run shows one: its
  // route, and over it what was run. Or a drawing: the run cut as the
  // others see it, in the route's yellow as in «Feed», the map framed on it.
  const reviewing = screen === "map" && (activity !== null || drawing !== null);
  const reviewed = useMemo(
    () =>
      activity !== null
        ? {
            start: activity.track[0] ?? null,
            route: activity.points,
            // A word with the pen up, dashed as at the end of the run
            // (TASK-199); none from an API older than that.
            walks: activity.walks ?? null,
            others: NO_OTHERS,
            track: activity.track,
          }
        : drawing !== null
          ? {
              start: null,
              route: drawing.track.length > 1 ? drawing.track : null,
              walks: null,
              others: NO_OTHERS,
              track: null,
            }
          : null,
    [activity, drawing],
  );
  const { position, refresh } = useCurrentPosition();
  // The size of the first maps of the phone while they download (TASK-214).
  const firstMaps = usePhoneZones(position, API_URL);
  const [startMode, setStartMode] = useState<StartMode>("gps");
  const [place, setPlace] = useState<Place | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  // «Retry» under «Draw» mounts the map again (TASK-259): its own «Retry»
  // is hidden there. If it fails again, it says so again.
  const [mapTries, setMapTries] = useState(0);
  const [kind, setKind] = useState<ChoiceKind>("shape");
  const [shapeText, setShapeText] = useState("heart");
  const tableShape = toShape(shapeText);
  const shapeReading = useShapeReading(API_URL);
  // The table first; the AI only for other words (ADR-0012).
  const reading =
    tableShape === null && shapeText.trim() !== ""
      ? shapeReading.stateOf(shapeText)
      : null;
  const shape = tableShape ?? (reading?.status === "read" ? reading.shape : null);
  // The sport of «Settings» (TASK-190): «Bike» asks for routes a bike may
  // ride, at its own distances; «Explore», «Feed» and the run stay a run's.
  // «Paddle» asks for a shape on the water, and has its own «Explore»
  // (TASK-191).
  const sport = useSport();
  const sportActivity = activityOf(sport);
  // The distance typed, or the metres the app chose (TASK-182 part E): in
  // the app's units, brought within the limits of a sport just chosen.
  const distance = useDrawDistance(sportActivity);
  const distanceM = distance.metres;
  const [wordText, setWordText] = useState("");
  const wordCheck = checkWord(wordText, distanceM, sportActivity);
  const [letterStyle, setLetterStyle] = useState<LetterStyle>("round");
  // The pen lifted between the letters (TASK-198), on until switched off:
  // the user's choice (TASK-202). An API older than TASK-197 refuses it.
  // The same switch for the pieces of a shape that has them (TASK-223).
  const [penUp, setPenUp] = useState(true);
  const image = useImageOutline(API_URL);
  // Past RouteChoice to the image panel (TASK-079).
  const { edits, add, undo } = image;
  const imageEdits = useMemo(() => ({ ...edits, add, undo }), [edits, add, undo]);
  const { draw, cancel, retry, state } = useRouteRequest(API_URL);
  const gpx = useGpxExport(API_URL);
  const {
    explored: exploredRoute,
    open: openExplored,
    close: closeExplored,
    redraw: redrawExplored,
  } = useExplored(API_URL);
  const explored = favorite ?? exploredRoute;
  // The page a route was opened from, where «←» goes back to: a drawing of
  // «Feed» opens as a route of "Explore" does (TASK-188).
  const [routeList, setRouteList] = useState<"explore" | "feed">("explore");
  // "Explore" for any city, and a shape through a theme's places (TASK-129).
  const [exploreCity, setExploreCity] = useState<Place | null>(null);
  // The cities chosen last, kept on the phone (TASK-134).
  const [recentCities, setRecentCities] = useState<Place[]>(loadRecentCities);
  const themed = useThemedRoute(API_URL);
  const themedExport = useMemo(
    () => (themed.state.status === "done" ? themedGpx(themed.state.result) : null),
    [themed.state],
  );

  const start = useMemo(
    () => chooseStart(startMode, position, place),
    [startMode, position, place],
  );

  // One of them (ADR-0051): the kinds not chosen are not sent. An image
  // sends the outline the engine traced and the user has seen (ADR-0069),
  // with the details drawn on it (TASK-079).
  // On the water only a shape of the catalogue is drawn (TASK-191): a word or
  // a picture chosen before «Paddle» waits for another sport.
  const drawKind: ChoiceKind = sportActivity === "paddling" ? "shape" : kind;
  const drawn:
    | { shape: Shape }
    | { shape: PenUpShape; pen_up: true }
    | { word: string; style: LetterStyle; pen_up?: true }
    | { outline: OutlinePoint[]; strokes?: OutlinePoint[][] }
    | null =
    drawKind === "shape"
      ? shape !== null
        ? // A shape in pieces with the pen up, on the roads (TASK-223).
          shapeAsked(shape, penUp, sportActivity)
        : null
      : drawKind === "word"
        ? wordCheck.ok
          ? {
              word: wordCheck.word,
              style: letterStyle,
              // Only when on: a request without it is the one of before.
              ...(penUp ? { pen_up: true as const } : {}),
            }
          : null
        : image.state.status === "traced"
          ? {
              outline: image.state.outline.points,
              strokes: image.state.outline.strokes,
            }
          : null;
  const request: AnyRouteRequest | null =
    start && drawn !== null && distanceM !== null
      ? { start: start.point, ...drawn, distance_m: distanceM, activity: sportActivity }
      : null;
  // A new start, shape, word or distance leaves the last answer behind.
  const view: RouteState =
    request && state.status !== "idle" && sameRequest(state.request, request)
      ? state
      : { status: "idle" };
  // The routes to choose from (TASK-093): what follows shows, runs and
  // exports the one chosen; a new result starts from the engine's.
  const [picked, setPicked] = useState<Picked>(null);
  const answer = view.status === "done" ? view.result : null;
  const choices = useMemo(() => (answer ? choicesOf(answer) : []), [answer]);
  const chosenIndex = pickedIndex(picked, answer);
  const chosen = choices[chosenIndex] ?? null;
  const shown: RouteState =
    view.status === "done" && chosen !== null ? { ...view, result: chosen } : view;
  const others = useMemo(
    () =>
      choices.length < 2
        ? NO_OTHERS
        : choices.filter((_, i) => i !== chosenIndex).map((other) => other.points),
    [choices, chosenIndex],
  );
  // The export state of another route does not belong on screen.
  const exporting: ExportState =
    chosen !== null && gpx.state.status !== "idle" && gpx.state.result === chosen
      ? gpx.state
      : { status: "idle" };
  const themedExporting: ExportState =
    themedExport !== null &&
    gpx.state.status !== "idle" &&
    gpx.state.result === themedExport.result
      ? gpx.state
      : { status: "idle" };

  // Start on a route of "Explore": its directions are asked for first,
  // then it is the route followed, in place of the drawn one (TASK-145).
  const startDirections = useStartDirections(API_URL);
  // Start on the water: the safety notice first, the first time (TASK-191).
  const paddleNotice = usePaddleNotice();
  // A run opened again with the app follows the route of its file (TASK-272).
  const [exploreRun, setExploreRun] = useState<ExploreRun | null>(() =>
    reopened !== null && !isFreeRun(reopened) ? reopenedRoute(reopened) : null,
  );
  const followed = exploreRun ?? chosen;
  // The shape of a drawn route on the water, moved with a finger (TASK-238).
  const move = useMoveShape(view, chosen, draw);
  // Only with the drawn route on the map, not one of "Explore" or a theme's.
  const movingShape =
    move.moving &&
    screen === "map" &&
    !reviewing &&
    explored === null &&
    themed.state.status === "idle";
  // And that of an example of "Explore" on the water (TASK-244): not of a
  // favorite, nor of a drawing of «Feed».
  const moveExample = useMoveExample(
    API_URL,
    favorite === null && routeList === "explore" ? exploredRoute : null,
    redrawExplored,
  );
  const movingExample =
    moveExample.moving && screen === "map" && !reviewing && explored !== null;
  // The walks of a drawn word with the pen up (TASK-198), or of a favorite
  // (TASK-199); a route of "Explore" has none.
  const followedWalks =
    exploreRun === null ? (chosen?.walks ?? null) : (exploreRun.walks ?? null);
  // The stretches with the bike on foot of a bike route (TASK-206).
  const followedOnFoot =
    exploreRun === null ? (chosen?.on_foot ?? null) : (exploreRun.on_foot ?? null);
  // What the route followed is for: a bike route is followed by bike (TASK-216).
  const followedActivity =
    exploreRun === null
      ? view.status === "done"
        ? view.request.activity
        : undefined
      : exploreRun.activity;
  // How far the shape of the route followed is turned (TASK-232): a drawn
  // route, and one of "Explore" that says how it is turned, an example
  // drawn for a place. Any other route, and a route that does not say,
  // keeps north up.
  const followedRotation =
    exploreRun === null
      ? (chosen?.rotation_deg ?? null)
      : (exploreRun.rotation_deg ?? null);
  const navigating = screen === "navigate" && followed !== null;
  const navigation = useNavigation(
    followed?.points ?? null,
    followed?.directions ?? NO_DIRECTIONS,
    navigating,
    followed?.similarity,
    {
      walks: followedWalks ?? undefined,
      word: exploreRun === null ? chosen?.word : (exploreRun.word ?? null),
      onFoot: followedOnFoot ?? undefined,
      activity: followedActivity,
      // Kept with the run: its drawing in «My activities» and its post are
      // turned back too (TASK-232 part C).
      rotationDeg: followedRotation ?? undefined,
    },
  );
  const finishing = screen === "finish" && finished !== null;
  // A run without a route (TASK-149): the map follows the runner and draws
  // the line run so far.
  const running = screen === "run";
  const freeRun = useFreeRun(running);
  const freeTrack = trackOf(freeRun);
  const freeLine = useMemo(() => freeTrack.fixes.map((fix) => fix.point), [freeTrack]);
  const freeStart =
    freeTrack.fixes[0]?.point ?? (position.status === "ok" ? position.point : null);
  const freeFinishing = screen === "runFinish" && freeFinished !== null;
  // Where the runner is heading, with a route or without (TASK-164): the
  // arrow on the map.
  const runTrack = navigating ? trackOfNavigation(navigation) : freeTrack;
  const heading = useMemo(() => headingDeg(runTrack), [runTrack]);
  // A route of "Explore" on the map, in place of the drawn one (TASK-126).
  const theming =
    screen === "map" &&
    !reviewing &&
    explored === null &&
    themed.state.status !== "idle";
  const exploring = screen === "map" && !reviewing && explored !== null;
  // A route whose shape is turned turns the map, so the drawing is upright
  // (TASK-232): choosing it, running it and at its end.
  const turned = useTurnedMap(
    reviewing || running || freeFinishing || theming
      ? null
      : exploring
        ? explored.status === "done"
          ? (explored.result.rotation_deg ?? null)
          : null
        : finishing
          ? followed !== null && sameLine(finished.run.route, followed.points)
            ? followedRotation
            : null
          : exploreRun === null
            ? (followedRotation ?? move.left?.rotationDeg ?? null)
            : followedRotation,
  );
  const exploredExport: ExportState =
    explored?.status === "done" &&
    gpx.state.status !== "idle" &&
    gpx.state.result === explored.result
      ? gpx.state
      : { status: "idle" };
  // The route on the map as a favorite keeps it (TASK-171), made once per
  // route: the heart knows it by its key.
  const startPlace = start?.source === "search" ? start.label : null;
  const drawnRequest = view.status === "done" ? view.request : null;
  const drawnFavorite = useMemo(
    () =>
      drawnRequest && chosen ? drawnKeepable(drawnRequest, chosen, startPlace) : null,
    [drawnRequest, chosen, startPlace],
  );
  const exploredFavorite = useMemo(
    () =>
      exploredRoute?.status === "done"
        ? exploredKeepable(exploredRoute.route, exploredRoute.detail)
        : null,
    [exploredRoute],
  );
  const themedFavorite = useMemo(
    () => (themed.state.status === "done" ? themedKeepable(themed.state.result) : null),
    [themed.state],
  );
  const onMap =
    screen !== "map" || reviewing
      ? null
      : theming
        ? themedFavorite
        : exploring
          ? (favorite?.keepable ?? exploredFavorite)
          : drawnFavorite;

  /** Stop or Finish: the run ends, and with a line to judge shows its score. */
  function onEndRun() {
    const run = endRun();
    if (run === null) {
      setScreen("map");
      return;
    }
    setFinished(finishedRun(run, run.status !== "arrived"));
    setScreen("finish");
  }

  /** Stop on a run without a route: its end, when there is a line to show. */
  function onStopFreeRun() {
    const run = endFreeRun();
    if (run === null) {
      setScreen("choose");
      return;
    }
    setFreeFinished(freeFinishedRun(run, true));
    setScreen("runFinish");
  }

  /** What the route of a run draws, while the app still has that route: a
   * run left from another opening has only its line. */
  function drawnBy(route: LatLon[]): Drawn | null {
    const kept = [
      drawnFavorite,
      exploredFavorite,
      themedFavorite,
      favorite?.keepable ?? null,
    ].find((known) => known != null && sameLine(known.request.points, route));
    return kept?.request ?? null;
  }

  /** The end of a run without a route leaves the screen. */
  function leaveFreeFinish() {
    setFreeFinished(null);
    setScreen("choose");
  }

  /** «Done», with nobody signed in: with no score to wait for, the run
   * leaves the phone at once. */
  function onFreeDone() {
    clearRun();
    leaveFreeFinish();
  }

  /** The end of a run along a route leaves the screen. */
  function leaveFinish() {
    setFinished(null);
    // A run opened again with the app has no card to go back to (TASK-272).
    if (exploreRun?.reopened === true) {
      setExploreRun(null);
      setScreen("choose");
      return;
    }
    // A run of "Explore" goes back to its route's card.
    setScreen(exploreRun !== null || view.status === "done" ? "map" : "choose");
  }

  /** «Done», with nobody signed in: with no score to wait for (TASK-241),
   * the run leaves the phone at once. */
  function onFinishDone() {
    clearRun();
    leaveFinish();
  }

  /** «Save» (TASK-172): the run that ended goes to «My activities», where
   * the API scores it by itself, and leaves the screen. False when the
   * phone could not keep it: the run stays where it is. */
  function onSaveRun(): boolean {
    const kept =
      finished !== null
        ? recordRun(finished.run, drawnBy(finished.run.route))
        : freeFinished !== null && recordRun(freeFinished.run, null);
    if (kept) {
      onDiscardRun();
    }
    return kept;
  }

  /** «Discard», or what follows «Save»: the run leaves the file of the run
   * in progress, with its score or without, and the screen. */
  function onDiscardRun() {
    clearRun();
    if (finished !== null) {
      leaveFinish();
    } else {
      leaveFreeFinish();
    }
  }

  /** "Explore" leaves the map: its route, its directions, its run. */
  function closeExplore() {
    closeExplored();
    closeFavorite();
    themed.close();
    startDirections.reset();
    setExploreRun(null);
  }

  /** Start on a route of "Explore": its directions first (TASK-145). A
   * favorite of a word with the pen up brings its walks (TASK-199), a bike
   * route its stretches with the bike on foot (TASK-206), and is followed
   * by bike (TASK-216). On the water there are none to ask for (TASK-191):
   * the notice, then the run. */
  function onStartExplore(
    route: {
      points: LatLon[];
      similarity: number;
      walks?: Walk[];
      word?: string | null;
      on_foot?: Stretch[];
      rotation_deg?: number;
    },
    activity?: Activity,
  ) {
    // Turned on the map, it stays turned while it is run (TASK-232).
    const turn =
      route.rotation_deg !== undefined ? { rotation_deg: route.rotation_deg } : {};
    if (activity === "paddling") {
      paddleNotice.ask(() => {
        startDirections.reset();
        setExploreRun({
          points: route.points,
          directions: NO_DIRECTIONS,
          similarity: route.similarity,
          activity,
          ...turn,
          // A shape in pieces: the pen up between them (TASK-226).
          ...(route.walks !== undefined && route.walks.length > 0
            ? { walks: route.walks, word: null }
            : {}),
        });
        setScreen("navigate");
      });
      return;
    }
    startDirections.start(route.points, (directions) => {
      setExploreRun({
        points: route.points,
        directions,
        similarity: route.similarity,
        ...(route.walks !== undefined && route.walks.length > 0
          ? { walks: route.walks, word: route.word ?? null }
          : {}),
        ...(route.on_foot !== undefined && route.on_foot.length > 0
          ? { on_foot: route.on_foot }
          : {}),
        ...(activity !== undefined ? { activity } : {}),
        ...turn,
      });
      setScreen("navigate");
    });
  }

  function onDraw() {
    // The decimal pad has no return key: drawing closes it.
    Keyboard.dismiss();
    // The drawn route takes the map back from "Explore".
    closeExplore();
    // The same route already drawn is shown again, not asked for again.
    if (request && view.status !== "done") {
      draw(request);
    }
    setScreen("map");
  }

  /** A run of «My activities» leaves the map for the list it came from. */
  function onActivityList() {
    closeActivity();
    showActivities();
  }

  function onBack() {
    if (reviewing) {
      if (activity !== null) {
        onActivityList();
      } else {
        backFromDrawing();
      }
      return;
    }
    if (favorite !== null) {
      // Back to the list it was opened from, over the page left under it.
      closeExplore();
      if (!onPage) {
        setScreen("choose");
      }
      showFavorites();
      return;
    }
    if (theming || exploring) {
      closeExplore();
      setScreen(routeList);
      return;
    }
    // Nobody is left watching the wait: drop it, as Cancel does.
    if (view.status === "waiting") {
      cancel();
    }
    setScreen("choose");
  }

  function onPickShape(picked: Shape) {
    setShapeText(shapeName(picked));
    setScreen("choose");
  }

  // The page on screen; -1 while the map or a run takes the whole screen.
  const page = PAGES.indexOf(screen);

  return (
    <View style={styles.screen}>
      <MapScreen
        active={screen === "map" || navigating || finishing || running || freeFinishing}
        onBack={onBack}
        mapError={mapError}
        banner={
          finishing ? (
            <FinishBanner />
          ) : freeFinishing ? (
            <FreeFinishBanner />
          ) : running ? (
            <FreeRunBanner state={freeRun} />
          ) : navigating ? (
            <NavigationBanner state={navigation} />
          ) : undefined
        }
        compass={
          turned.arrow ? (
            <NorthArrow shown={turned.shown} onPress={turned.onArrow} />
          ) : undefined
        }
        map={
          <MapView
            key={mapTries}
            style={styles.map}
            start={
              running
                ? freeStart
                : freeFinishing
                  ? (freeFinished.line[0] ?? null)
                  : theming
                    ? themed.state.status === "done"
                      ? themed.state.result.centre
                      : null
                    : exploring
                      ? explored.route.start
                      : (exploreRun?.points[0] ?? start?.point ?? null)
            }
            stops={
              theming && themed.state.status === "done"
                ? themed.state.result.stops
                : null
            }
            route={
              finishing
                ? finished.run.route
                : running || freeFinishing
                  ? null
                  : theming
                    ? themed.state.status === "done"
                      ? themed.state.result.points
                      : null
                    : exploring
                      ? explored.status === "done"
                        ? explored.detail.points
                        : null
                      : // A shape left elsewhere stays there while it is drawn.
                        (followed?.points ?? move.left?.points ?? null)
            }
            walks={
              finishing
                ? finished.run.walks
                : running || freeFinishing || theming
                  ? null
                  : exploring
                    ? // A favorite of a word with the pen up (TASK-199).
                      explored.status === "done"
                      ? (explored.result.walks ?? null)
                      : null
                    : (followedWalks ?? move.left?.walks ?? null)
            }
            onFoot={
              finishing || running || freeFinishing || theming
                ? null
                : exploring
                  ? // A favorite of a bike route (TASK-206).
                    explored.status === "done"
                    ? (explored.result.on_foot ?? null)
                    : null
                  : (followedOnFoot ?? move.left?.onFoot ?? null)
            }
            // Only while choosing, a drawn route or an example of "Explore"
            // (TASK-155): running, or on a themed route, one route is the route.
            others={
              screen !== "map" || theming
                ? NO_OTHERS
                : exploring
                  ? explored.status === "done"
                    ? explored.others
                    : NO_OTHERS
                  : others
            }
            track={
              finishing
                ? finished.line
                : freeFinishing
                  ? freeFinished.line
                  : running
                    ? freeLine
                    : null
            }
            following={
              navigating && navigation.status === "following"
                ? navigation.position
                : running && freeRun.status === "running"
                  ? freeRun.position
                  : null
            }
            heading={heading}
            // Running the route: the part run solid, the part left dashed
            // and blinking (TASK-224).
            progress={
              navigating && navigation.status === "following"
                ? navigation.navigation
                : null
            }
            // On a drawing a double tap is its super like, not a zoom (TASK-119).
            onDoubleTap={
              reviewing && drawing !== null ? drawingDoubleTapped : undefined
            }
            moving={movingShape || movingExample}
            onMoved={movingExample ? moveExample.onMoved : move.onMoved}
            bearing={turned.bearing}
            turn={turned.turn}
            onTurned={turned.onTurned}
            onError={setMapError}
            // A run of «My activities» takes the map from whatever was on it.
            {...(reviewing ? reviewed : null)}
          />
        }
      >
        {reviewing && activity !== null ? (
          <ActivityCard
            // A new card for each run: «Delete» asks again.
            key={activity.id}
            activity={activity}
            onList={onActivityList}
            onDelete={() => {
              removeActivity(activity.id);
              onActivityList();
            }}
          />
        ) : reviewing && drawing !== null ? (
          <DrawingCard drawing={drawing} onBack={backFromDrawing} />
        ) : freeFinishing ? (
          <FreeFinishCard
            run={freeFinished.run}
            onResume={
              freeFinished.resumable
                ? () => {
                    setFreeFinished(null);
                    setScreen("run");
                  }
                : undefined
            }
            // With an account the way out is «Save» or «Discard», below.
            onDone={signedIn ? undefined : onFreeDone}
          />
        ) : running ? (
          <FreeRunCard
            running={freeRun.status === "running"}
            track={freeTrack}
            onStop={onStopFreeRun}
          />
        ) : theming ? (
          <ThemedCard
            state={themed.state}
            exporting={themedExporting}
            onExport={() => {
              if (themedExport !== null) {
                gpx.exportGpx(themedExport.request, themedExport.result);
              }
            }}
            onCancel={() => {
              closeExplore();
              setScreen("explore");
            }}
            start={startViewOf(
              startDirections.state,
              themed.state.status === "done" ? themed.state.result.points : null,
            )}
            onStart={() => {
              if (themed.state.status === "done") {
                onStartExplore(themed.state.result);
              }
            }}
          />
        ) : exploring ? (
          <ExploredCard
            explored={explored}
            exporting={exploredExport}
            onExport={() => {
              if (explored.status === "done") {
                gpx.exportGpx(explored.request, explored.result);
              }
            }}
            // The list it came from: "Explore", or the favorites.
            onList={onBack}
            start={startViewOf(
              startDirections.state,
              explored.status === "done" ? explored.result.points : null,
            )}
            onStart={() => {
              if (explored.status === "done") {
                onStartExplore(explored.result, explored.request.activity);
              }
            }}
            move={moveExample}
          />
        ) : finishing ? (
          <FinishCard
            run={finished.run}
            onDone={signedIn ? undefined : onFinishDone}
            onResume={
              finished.resumable && (exploreRun !== null || view.status === "done")
                ? () => {
                    setFinished(null);
                    setScreen("navigate");
                  }
                : undefined
            }
          />
        ) : navigating ? (
          <NavigationCard
            navigation={
              navigation.status === "following" ? navigation.navigation : null
            }
            track={trackOfNavigation(navigation)}
            onStop={onEndRun}
            activity={followedActivity}
          />
        ) : movingShape ? (
          <MoveShape onCancel={move.cancel} />
        ) : (
          <RouteOutcome
            view={shown}
            onCancel={() => {
              cancel();
              setScreen("choose");
            }}
            exporting={exporting}
            onExport={() => {
              if (view.status === "done" && chosen !== null) {
                gpx.exportGpx(view.request, chosen);
              }
            }}
            onTryDistance={(distance_m) => {
              distance.choose(distance_m);
              if (request) {
                draw({ ...request, distance_m });
              }
            }}
            onPickShape={onPickShape}
            onRetry={retry}
            onStart={() => {
              if (view.status === "done" && view.request.activity === "paddling") {
                paddleNotice.ask(() => setScreen("navigate"));
              } else {
                setScreen("navigate");
              }
            }}
            onMove={move.available ? move.begin : undefined}
            movedElsewhere={move.elsewhere}
            choices={choices}
            chosen={chosenIndex}
            onChoose={(index) => answer && setPicked({ of: answer, index })}
          />
        )}
        {/* Under the card of a run that ended: «Save» or «Discard», with an
            account (TASK-172). */}
        {(finishing || freeFinishing) && (
          <RunEnd onSave={onSaveRun} onDiscard={onDiscardRun} />
        )}
      </MapScreen>
      {/* Over the map, opposite the way back: keep the route shown. */}
      <FavoriteHeart route={onMap} />
      {page !== -1 && (
        <Pager
          page={page}
          onPage={(index) => {
            // A keyboard left open would follow to the next page.
            Keyboard.dismiss();
            setScreen(PAGES[index]);
          }}
          action={
            // The sport at the left of the way to «Profile» (TASK-205).
            <View style={styles.actions}>
              <SportButton />
              <ProfileButton />
            </View>
          }
          pages={[
            {
              title: pageTitle("feed"),
              render: () => (
                <FeedScreen
                  active={screen === "feed"}
                  // For the drawings nearby (TASK-118), as «Explore».
                  near={start?.point ?? null}
                  onOpen={(post) => {
                    closeExplore();
                    openExplored(postRoute(post), fetchPostRoute(post));
                    setRouteList("feed");
                    setScreen("map");
                  }}
                />
              ),
            },
            {
              title: pageTitle("draw"),
              render: () => (
                <ChooseScreen
                  status={statusText(startMode, position, start)}
                  denied={startMode === "gps" && position.status === "denied"}
                  mode={startMode}
                  onMode={(mode) => {
                    setStartMode(mode);
                    if (mode === "gps") {
                      // Asked again, as the old button did: the permission may be on now.
                      refresh();
                    }
                  }}
                  searching={showsSearch(startMode, position)}
                  onPlace={(chosen) => {
                    setPlace(chosen);
                    // A small lake's shapes fit at less than 2 km (TASK-240).
                    const fits = distanceOnSpot(chosen, distanceM);
                    if (fits !== null) {
                      distance.choose(fits);
                    }
                  }}
                  near={
                    position.status === "ok" ? position.point : (place?.point ?? null)
                  }
                  // On the water the search knows the lakes and the beaches.
                  suggest={sportActivity === "paddling" ? spotPlaces : undefined}
                  searchHint={
                    sportActivity === "paddling" ? SPOT_SEARCH_HINT : undefined
                  }
                  mapError={mapError}
                  onMapRetry={() => {
                    setMapError(null);
                    setMapTries((tries) => tries + 1);
                  }}
                  footer={
                    <>
                      <ZoneNotice bytes={firstMaps} />
                      <DrawButton enabled={request !== null} onDraw={onDraw} />
                    </>
                  }
                  onRun={() => {
                    Keyboard.dismiss();
                    setScreen("run");
                  }}
                  runLabel={withoutRouteLabel(sport)}
                >
                  <ImageEditsContext.Provider value={imageEdits}>
                    <RouteChoice
                      kind={drawKind}
                      onKind={setKind}
                      shapeText={shapeText}
                      shape={shape}
                      onShapeText={setShapeText}
                      reading={reading}
                      onShapeDone={() => {
                        if (reading) {
                          shapeReading.read(shapeText);
                        }
                      }}
                      wordText={wordText}
                      onWordText={setWordText}
                      wordCheck={wordCheck}
                      letterStyle={letterStyle}
                      onLetterStyle={setLetterStyle}
                      penUp={penUp}
                      onPenUp={setPenUp}
                      image={image.state}
                      onChooseImage={image.choose}
                      distanceText={distance.text}
                      distanceM={distanceM}
                      onDistanceText={distance.type}
                      activity={sportActivity}
                    />
                  </ImageEditsContext.Provider>
                </ChooseScreen>
              ),
            },
            {
              title: pageTitle("explore"),
              // It asks the API for its routes as it opens: not before.
              lazy: true,
              render: () =>
                // On the water, the lakes and the beaches (TASK-191).
                sport === "paddle" ? (
                  <PaddleExplore
                    apiUrl={API_URL}
                    near={start?.point ?? null}
                    onOpen={(route) => {
                      closeExplore();
                      openExplored(route);
                      setRouteList("explore");
                      setScreen("map");
                    }}
                  />
                ) : (
                  <ExploreScreen
                    apiUrl={API_URL}
                    near={start?.point ?? null}
                    onOpen={(route) => {
                      closeExplore();
                      openExplored(route);
                      setRouteList("explore");
                      setScreen("map");
                    }}
                    city={exploreCity}
                    onCity={(city) => {
                      setExploreCity(city);
                      if (city !== null) {
                        const recent = remember(recentCities, city);
                        setRecentCities(recent);
                        saveRecentCities(recent);
                      }
                    }}
                    recent={recentCities}
                    onAsk={(request) => {
                      Keyboard.dismiss();
                      closeExplore();
                      themed.ask(request);
                      setRouteList("explore");
                      setScreen("map");
                    }}
                  />
                ),
            },
          ]}
        />
      )}
      {/* Before the first «Start» on the water (TASK-191). */}
      <PaddleNotice
        visible={paddleNotice.asking}
        onAccept={paddleNotice.accept}
        onDismiss={paddleNotice.dismiss}
      />
    </View>
  );
}

function statusText(
  mode: StartMode,
  position: PositionState,
  start: Start | null,
): string {
  if (start?.source === "gps") {
    return "Starting from your position.";
  }
  if (start?.source === "search") {
    return `Starting from ${start.label}.`;
  }
  if (mode === "place") {
    return "Search for a city or street to start from.";
  }
  switch (position.status) {
    case "denied":
      return "Location is off for MuW. Allow it in Settings, or search for a place to start from.";
    case "unavailable":
      return "Your position is not available right now. Search for a place to start from.";
    default:
      return "Finding your position…";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  map: {
    flex: 1,
    // Under the page while the WebView starts, so it never flashes white.
    backgroundColor: color.map.background,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
});
