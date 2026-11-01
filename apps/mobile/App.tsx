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
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useActivitiesDoor } from "./src/activities/activitiesDoor";
import { ActivityCard } from "./src/activities/ActivityCard";
import { type Drawn, sameLine } from "./src/activities/recordedRun";
import { RunEnd } from "./src/activities/RunEnd";
import { apiUrl } from "./src/api/apiUrl";
import { PickStart } from "./src/location/PickStart";
import {
  type ChosenPlace,
  chooseStart,
  showsSearch,
  type StartMode,
} from "./src/location/startMode";
import { startStatus } from "./src/location/startStatus";
import { useCurrentPosition } from "./src/location/useCurrentPosition";
import { useMayWorkAhead } from "./src/intro/firstPage";
import { ExploredCard } from "./src/explore/ExploredCard";
import { useExplored } from "./src/explore/explored";
import { prepareExplore } from "./src/explore/exploreAhead";
import { ExploreScreen } from "./src/explore/ExploreScreen";
import {
  gameCatalog,
  refreshGameCatalog,
  useGameCatalog,
} from "./src/game/gameCatalog";
import { PlayOverlay } from "./src/game/PlayOverlay";
import { PlayRow } from "./src/game/PlayRow";
import { onOpenPlay } from "./src/game/unlocks";
import {
  loadRecentCities,
  remember,
  saveRecentCities,
} from "./src/explore/recentCities";
import { mapStops } from "./src/explore/StopPhotos";
import { ThemedCard, themedGpx } from "./src/explore/ThemedCard";
import { startViewOf, useStartDirections } from "./src/explore/useStartDirections";
import { isHere, nearMeRequest } from "./src/explore/themedIdeas";
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
import { CanvasTop } from "./src/mapdraw/CanvasTop";
import { DrawOnMap } from "./src/mapdraw/DrawOnMap";
import { drawingOf, type FigureLines } from "./src/mapdraw/edit";
import { FigureTiles } from "./src/mapdraw/FigureTiles";
import {
  changedRequest,
  drawnTile,
  type FigureChoice,
  isChosen,
  NO_TILE,
  placedTile,
} from "./src/mapdraw/resultFigure";
import { useMapCanvas } from "./src/mapdraw/useMapCanvas";
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
import { APP_DISTANCE_LIMITS_KM, distanceLimitsM } from "./src/route/distance";
import {
  againDistanceM,
  againOfDrawing,
  againOfRequest,
  type DrawAgain,
  drawsAgain,
} from "./src/route/drawAgain";
import { ImageEditsContext } from "./src/route/imageEdits";
import type { ChoiceKind } from "./src/route/problems";
import { withPenUp } from "./src/route/penUpHint";
import { shapeAsked } from "./src/route/penUpShapes";
import { DrawButton, RouteChoice, RouteOutcome } from "./src/route/RoutePanel";
import { shapeName, toShape } from "./src/route/shapeWords";
import { type ExportState, useGpxExport } from "./src/route/useGpxExport";
import { useImageOutline } from "./src/route/useImageOutline";
import { drawingTrack, requestLines, type TrackInPlace } from "./src/route/figureLines";
import { NearYou } from "./src/route/NearYou";
import { useNearYou } from "./src/route/nearYouShapes";
import { samplePicture } from "./src/route/samplePictures";
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
import {
  OwnProfile,
  ProfileButton,
  ProfileLayer,
  useOwnPage,
} from "./src/screens/ProfileLayer";
import { StretchReminder } from "./src/screens/StretchReminder";
import { StretchScreen } from "./src/stretch/StretchScreen";
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
import { drawnOf, followedOf } from "./src/social/drawingRoute";
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
 * end (TASK-149), what runners publish (TASK-154, then TASK-118), the
 * account's own profile (TASK-278), the map to draw a figure on
 * (TASK-281), and the map to choose the start on (TASK-292). */
type Screen =
  | "choose"
  | "map"
  | "navigate"
  | "finish"
  | "explore"
  | "run"
  | "runFinish"
  | "feed"
  | "profile"
  | "canvas"
  | "pickStart"
  | "play";

/** The screens that are pages side by side, left to right, one swipe apart
 * (TASK-154, ADR-0124; the profile after «Explore», TASK-278); the others
 * take the whole screen. «Play», the shape game (TASK-296, ADR-0255), is
 * not among them since 2026-10-29 (the user's choice): it opens from its
 * row under the distance of «Draw», over the app. */
const PAGES: readonly Screen[] = ["feed", "choose", "explore", "profile"];

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
  /** The track of a drawing opened on the map (TASK-307): what it draws,
   * for the run saved, and the page the drawing was opened over, which
   * the end of the run goes back to, the drawing still on it. */
  drawing?: { drawn: Drawn; page: Screen };
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
    // The word even without walks: a word starts at its start, never where
    // the runner reaches it as a closed shape does (TASK-273).
    word: run.word ?? null,
    ...(run.walks !== undefined ? { walks: run.walks } : {}),
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

/** The lines «Edit the drawing» puts on the map, of a route or a drawing
 * on a card (TASK-320, TASK-331): none for lines that make no drawing
 * (`drawingOf`), and none on the water, where only the catalogue is
 * drawn. */
function cardFigure(lines: FigureLines | null, activity: Activity): FigureLines | null {
  return lines === null || activity === "paddling" || drawingOf(lines) === null
    ? null
    : lines;
}

/** The distance of a figure edited from a card: as «Draw it near me» takes
 * a shape's (`againDistanceM`, ADR-0273), the route's or the run's to the
 * tenth of a km, within the limits of the sport of «Draw». */
function cardDistanceM(distanceM: number, activity: Activity): number {
  const [lowest, highest] = APP_DISTANCE_LIMITS_KM[activity];
  const stepped = Math.round(distanceM / 100) * 100;
  return Math.min(Math.max(stepped, lowest * 1000), highest * 1000);
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
  // A run that just ended asks for the stretching first (TASK-285 part A):
  // never one opened again with the app, which ended long ago.
  const [stretchAsked, setStretchAsked] = useState(false);
  // The five exercises are on (TASK-285 part B), over «Your run».
  const [stretching, setStretching] = useState(false);
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
  const {
    opened: drawing,
    back: backFromDrawing,
    leave: leaveDrawing,
  } = useDrawingsDoor();
  // «Play» has its row in «Draw» while the API has the shape game
  // (TASK-296): asked once as the app opens, kept on the phone for the next
  // opening.
  const playOn = useGameCatalog() !== null;
  const pages = PAGES;
  useEffect(() => {
    void refreshGameCatalog(API_URL);
  }, []);
  if (screenNow === "play" && !playOn) {
    // The API said it has no game while the game was on screen.
    setScreen("choose");
  }
  const onPage = pages.includes(screenNow);
  const screen: Screen =
    (favorite !== null || activity !== null || drawing !== null) && onPage
      ? "map"
      : screenNow;
  // The fourth page asked for from elsewhere (TASK-278 part B, the user's
  // choice): from the map or the end of a run with nobody signed in (the
  // heart, «Save»), «←» goes back there, and so does signing in, with the
  // route kept or «Save» under the run. A run in progress keeps its screen.
  const ownPage = useOwnPage();
  const [askSeen, setAskSeen] = useState(ownPage.asked.n);
  const [profileFrom, setProfileFrom] = useState<Screen | null>(null);
  if (ownPage.asked.n !== askSeen) {
    setAskSeen(ownPage.asked.n);
    if (screenNow !== "run" && screenNow !== "navigate") {
      setProfileFrom(onPage || signedIn ? null : screenNow);
      setScreen("profile");
    }
  }
  if (profileFrom !== null && signedIn) {
    setProfileFrom(null);
    setScreen(profileFrom);
  }
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
  // A place searched for, or a point chosen on the map (TASK-292).
  const [place, setPlace] = useState<ChosenPlace | null>(null);
  // While the start is chosen on the map: the point under the pin.
  const [pickedCentre, setPickedCentre] = useState<LatLon | null>(null);
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
  // «Feed» opens as a route of "Explore" does (TASK-188); a tour of «Draw»
  // goes back to «Draw» (TASK-280).
  const [routeList, setRouteList] = useState<"explore" | "feed" | "choose">("explore");
  // "Explore" for any city, and a shape through a theme's places (TASK-129).
  const [exploreCity, setExploreCity] = useState<Place | null>(null);
  // The cities chosen last, kept on the phone (TASK-134).
  const [recentCities, setRecentCities] = useState<Place[]>(loadRecentCities);
  const themed = useThemedRoute(API_URL);
  const themedExport = useMemo(
    () => (themed.state.status === "done" ? themedGpx(themed.state.result) : null),
    [themed.state],
  );
  // Its places on the map, those passed by numbered as the photos under it
  // (TASK-329); a photo tapped takes the map to its place.
  const themedStops = useMemo(
    () => (themed.state.status === "done" ? mapStops(themed.state.result.stops) : null),
    [themed.state],
  );
  const [placeFocus, setPlaceFocus] = useState<{ point: LatLon } | null>(null);

  const start = useMemo(
    () => chooseStart(startMode, position, place),
    [startMode, position, place],
  );
  // One of our ideas opened far from the start: «Make it near me» asks its
  // words from the start instead of «Start».
  const farIdea =
    themed.state.status === "done" &&
    themed.state.idea !== undefined &&
    start !== null &&
    !isHere(themed.state.idea, start.point)
      ? { idea: themed.state.idea, from: start.point }
      : null;

  // One of them (ADR-0051): the kinds not chosen are not sent. An image
  // sends the outline the engine traced and the user has seen (ADR-0069),
  // with the details drawn on it (TASK-079); a figure drawn by hand is
  // asked from the map (TASK-331).
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
  // «Draw on the map» (TASK-281): the figure on the map of the start, and
  // its request. The route on the map is the figure's after its «Draw
  // route», until «Draw route» of «Draw».
  const mapDraw = useMapCanvas({
    apiUrl: API_URL,
    penUp,
    activity: sportActivity,
    limitsM: distanceLimitsM(sportActivity),
    distanceM,
    start: start?.point ?? null,
  });
  const [fromCanvas, setFromCanvas] = useState(false);
  const asked = fromCanvas ? mapDraw.request : request;
  // A new start, shape, word or distance leaves the last answer behind; so
  // does a figure moved or changed.
  const view: RouteState =
    asked && state.status !== "idle" && sameRequest(state.request, asked)
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
  // The tile of the figure of the route drawn, under it (TASK-286).
  const resultTile =
    view.status !== "done"
      ? NO_TILE
      : fromCanvas
        ? placedTile(mapDraw.placed)
        : drawnTile(view.request);
  // «Edit the drawing» on the card of a route of «Explore» (an example, a
  // search, a favorite) and of a member's drawing: the figure it puts on
  // the map. None for a word, nor for a drawing without a planned figure.
  const exploredFigure = useMemo(
    () =>
      explored?.status === "done"
        ? cardFigure(requestLines(explored.request), sportActivity)
        : null,
    [explored, sportActivity],
  );
  // A member's drawing gives its track, where it was run and as big
  // (TASK-346, ADR-0299).
  const drawingTrackInPlace = useMemo(() => {
    const track = drawing !== null ? drawingTrack(drawing) : null;
    return track !== null && cardFigure(track.lines, sportActivity) !== null
      ? track
      : null;
  }, [drawing, sportActivity]);
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
  const canvasOn = screen === "canvas";
  const pickOn = screen === "pickStart";
  // Work ahead of the user (TASK-306): once the first page shows, never
  // while running or navigating, nor with the app in the background.
  const mayWorkAhead = useMayWorkAhead(running || screen === "navigate");
  // «NEAR YOU» under the distance of «Draw», a run's only: shapes from the
  // phone's position, if the app has it (none is asked for here); without
  // it, shapes of other cities.
  const nearYou = useNearYou(
    API_URL,
    position.status === "ok"
      ? position.point
      : position.status === "loading"
        ? undefined
        : null,
    mayWorkAhead && sportActivity === "running",
  );
  // «Explore» prepared around the start until it is first opened: then
  // the page asks for itself. On the water it has its own (TASK-246).
  const [exploreSeen, setExploreSeen] = useState(false);
  useEffect(() => {
    if (screen === "explore") {
      setExploreSeen(true);
    }
  }, [screen]);
  const aheadLat = start?.point[0];
  const aheadLon = start?.point[1];
  useEffect(() => {
    if (
      !mayWorkAhead ||
      exploreSeen ||
      sport === "paddle" ||
      API_URL === null ||
      aheadLat === undefined ||
      aheadLon === undefined
    ) {
      return;
    }
    return prepareExplore(API_URL, [aheadLat, aheadLon]);
  }, [mayWorkAhead, exploreSeen, sport, aheadLat, aheadLon]);
  const turned = useTurnedMap(
    reviewing || running || freeFinishing || theming || canvasOn || pickOn
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
      setScreen(exploreRun?.drawing?.page ?? "map");
      return;
    }
    setFinished(finishedRun(run, run.status !== "arrived"));
    setStretchAsked(true);
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
    setStretchAsked(true);
    setScreen("runFinish");
  }

  /** What the route of a run draws, while the app still has that route: a
   * run left from another opening has only its line. */
  function drawnBy(route: LatLon[]): Drawn | null {
    // The track of a drawing says what it draws (TASK-307).
    if (exploreRun?.drawing !== undefined && sameLine(exploreRun.points, route)) {
      return exploreRun.drawing.drawn;
    }
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
    // A drawing's track goes back to the drawing (TASK-307).
    if (exploreRun?.drawing !== undefined) {
      setScreen(exploreRun.drawing.page);
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

  /** «Start» on a drawing opened on the map (TASK-307): its track is the
   * route, followed without directions, since a GPS line is not on the
   * roads of the graph that /route-directions knows. On the water, the
   * notice first, as for any route there. The drawing stays open: the end
   * of the run goes back to it, and «Back» from it to where it was. */
  function onStartDrawing() {
    if (drawing === null) {
      return;
    }
    const route = followedOf(drawing);
    // The page under the drawing («Feed», a profile's), or the map it was
    // opened over from «Profile».
    const page = screenNow;
    const run = () => {
      startDirections.reset();
      setExploreRun({
        ...route,
        directions: NO_DIRECTIONS,
        drawing: { drawn: drawnOf(drawing), page },
      });
      setScreen("navigate");
    };
    if (route.activity === "paddling") {
      paddleNotice.ask(run);
      return;
    }
    run();
  }

  /** «Draw it near me» (TASK-313): the shape or the word of a route of
   * «Explore» or of a drawing, chosen in «Draw» at the same distance, and
   * the route or the drawing left. The start stays «Draw»'s: «Draw route»
   * asks the engine for the route there. */
  function onDrawAgain(again: DrawAgain) {
    if (again.kind === "shape") {
      setKind("shape");
      setShapeText(shapeName(again.shape));
    } else {
      setKind("word");
      setWordText(again.word);
      setLetterStyle(again.style);
    }
    distance.choose(againDistanceM(again, sportActivity));
    closeExplore();
    leaveDrawing();
    setScreen("choose");
  }

  /** The button's action for `again`, when «Draw» can draw it. */
  function drawAgainOf(again: DrawAgain | null): (() => void) | undefined {
    return drawsAgain(again, sportActivity) ? () => onDrawAgain(again) : undefined;
  }

  /** «Edit the drawing» (TASK-320): `lines` on the map of «Draw on the map»
   * as a drawing, in the middle of the start, as long as `distanceM`
   * (TASK-331). Drawing on it, moving it and «Draw route» are the map's;
   * nothing is asked before «Draw route», and «←» goes to «Draw». */
  function onEditLines(lines: FigureLines, distanceM: number) {
    Keyboard.dismiss();
    if (mapDraw.edit(lines, distanceM)) {
      setScreen("canvas");
    }
  }

  /** «Edit the drawing» on a member's drawing (TASK-346, ADR-0299): its
   * track on the map where it was run and as big, to change there; the
   * drawing is left as «Draw it near me» leaves it. */
  function editTrackOf(track: TrackInPlace | null): (() => void) | undefined {
    if (track === null) {
      return undefined;
    }
    return () => {
      Keyboard.dismiss();
      closeExplore();
      leaveDrawing();
      if (mapDraw.editInPlace(track.lines, track.centre, track.unitM)) {
        setScreen("canvas");
      }
    };
  }

  /** «Edit the drawing» on a card: the figure of the route of «Explore», at
   * the distance «Draw it near me» would choose; the route is left as «Draw
   * it near me» leaves it. */
  function onEditCard(lines: FigureLines, distanceM: number) {
    closeExplore();
    leaveDrawing();
    onEditLines(lines, cardDistanceM(distanceM, sportActivity));
  }

  /** The button's action for `lines`, when the card has them. */
  function editCardOf(
    lines: FigureLines | null,
    distanceM: number,
  ): (() => void) | undefined {
    return lines !== null ? () => onEditCard(lines, distanceM) : undefined;
  }

  function onDraw() {
    // The decimal pad has no return key: drawing closes it.
    Keyboard.dismiss();
    // The drawn route takes the map back from "Explore".
    closeExplore();
    setFromCanvas(false);
    // The same route already drawn is shown again, not asked for again.
    if (request && (fromCanvas || view.status !== "done")) {
      draw(request);
    }
    setScreen("map");
  }

  /** «Freehand» in «Draw» (TASK-281, TASK-340): the map of the start, to
   * draw on. */
  function onOpenCanvas() {
    Keyboard.dismiss();
    mapDraw.open();
    setScreen("canvas");
  }

  /** «Choose on the map» (TASK-292): the map of the start, with the pin
   * in its middle; the map says where the middle is. */
  function onOpenPick() {
    Keyboard.dismiss();
    setPickedCentre(null);
    setScreen("pickStart");
  }

  /** «Start here»: the point under the pin is the start, as a place
   * searched for is, and «Draw» is back. */
  function onPicked(point: LatLon) {
    setPlace({ point, label: null });
    setStartMode("place");
    setScreen("choose");
  }

  /** «Draw route» on the map: the route of the figure, shown as one of
   * «Draw»; «←» comes back to the figure as it was. */
  function onDrawCanvas() {
    if (mapDraw.request === null) {
      return;
    }
    closeExplore();
    setFromCanvas(true);
    // The same figure already drawn is shown again, not asked for again.
    if (!fromCanvas || view.status !== "done") {
      draw(mapDraw.request);
    }
    setScreen("map");
  }

  /** A tile under the route drawn (TASK-286): its shape or picture in place
   * of the figure, from the same start and as long, asked at once. From
   * «Draw» it becomes the choice of «Draw»; from the map it takes the place
   * of the figure there. */
  function onChangeFigure(choice: FigureChoice) {
    if (view.status !== "done" || isChosen(choice, resultTile)) {
      return;
    }
    if (fromCanvas) {
      const changed = mapDraw.changeTo(choice, view.request.distance_m);
      if (changed) {
        draw(changed);
      }
      return;
    }
    if (choice.kind === "shape") {
      setKind("shape");
      setShapeText(shapeName(choice.shape));
    } else {
      setKind("image");
      image.show(samplePicture(choice.sample), choice.sample.outline);
    }
    draw(changedRequest(view.request, choice, penUp));
  }

  /** A run of «My activities» leaves the map for the list it came from. */
  function onActivityList() {
    closeActivity();
    showActivities();
  }

  function onBack() {
    // The start chosen on the map stays as it was (TASK-292).
    if (pickOn) {
      setScreen("choose");
      return;
    }
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
    // The route of a figure goes back to the figure (TASK-281).
    setScreen(fromCanvas ? "canvas" : "choose");
  }

  function onPickShape(picked: Shape) {
    setShapeText(shapeName(picked));
    setScreen("choose");
  }

  // The page on screen; -1 while the map, a run or «Play» takes the whole
  // screen.
  const page = pages.indexOf(screen);

  // The card of a shape unlocked, or its notification, asks for «Play»
  // (TASK-296): only while a page is on screen, never over a run; already
  // open, it stays as it is.
  const latestPage = useRef({ onPage, showPage });
  latestPage.current = { onPage, showPage };
  useEffect(
    () =>
      onOpenPlay(() => {
        if (latestPage.current.onPage && gameCatalog() !== null) {
          latestPage.current.showPage("play");
        }
      }),
    [],
  );

  /** Another page, by a swipe, its name or the profile's circle. */
  function showPage(next: Screen) {
    // A keyboard left open would follow to the next page.
    Keyboard.dismiss();
    if (screenNow === "profile" && next !== "profile") {
      // Out of the profile: whatever it was asked for waits no more.
      ownPage.leave();
      setProfileFrom(null);
    }
    setScreen(next);
  }

  /** «←» of the fourth page asked for from the map or the end of a run:
   * back there, nothing kept (TASK-278 part B). */
  function backFromProfile() {
    if (profileFrom === null) {
      return;
    }
    Keyboard.dismiss();
    ownPage.leave();
    setProfileFrom(null);
    setScreen(profileFrom);
  }

  return (
    <View style={styles.screen}>
      <MapScreen
        active={
          screen === "map" ||
          canvasOn ||
          pickOn ||
          navigating ||
          finishing ||
          running ||
          freeFinishing
        }
        onBack={onBack}
        mapError={mapError}
        banner={
          canvasOn ? (
            <CanvasTop
              place={start?.source === "search" ? start.label : null}
              onBack={() => setScreen("choose")}
            />
          ) : finishing ? (
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
              // While the start is chosen on the map the pin is the
              // page's: a GPS that answers does not move the map (TASK-292).
              pickOn
                ? null
                : running
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
            stops={theming ? themedStops : null}
            focus={theming ? placeFocus : null}
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
                      : canvasOn || pickOn
                        ? null
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
                    : canvasOn || pickOn
                      ? null
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
                  : canvasOn || pickOn
                    ? null
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
            // «Draw on the map» (TASK-281): the figure, and the fingers.
            canvas={canvasOn ? mapDraw.canvas : null}
            onCanvas={mapDraw.onCanvas}
            // «Choose on the map» (TASK-292): the pin in the middle.
            picking={pickOn}
            onCentre={setPickedCentre}
            onError={setMapError}
            // A run of «My activities» takes the map from whatever was on it.
            {...(reviewing ? reviewed : null)}
          />
        }
      >
        {pickOn ? (
          <PickStart centre={pickedCentre} onStart={onPicked} />
        ) : canvasOn ? (
          <DrawOnMap
            mode={mapDraw.mode}
            onMode={mapDraw.setMode}
            placed={mapDraw.placed}
            onPick={mapDraw.pick}
            onSample={mapDraw.pickSample}
            photo={mapDraw.photo}
            onPhoto={mapDraw.choosePhoto}
            onUndo={mapDraw.undo}
            canUndo={mapDraw.canUndo}
            onRedo={mapDraw.redo}
            canRedo={mapDraw.canRedo}
            onClear={mapDraw.clear}
            distanceM={mapDraw.distanceM}
            problem={mapDraw.problem}
            onDraw={mapDraw.request === null ? null : onDrawCanvas}
          />
        ) : reviewing && activity !== null ? (
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
          <DrawingCard
            drawing={drawing}
            onBack={backFromDrawing}
            onStart={onStartDrawing}
            onDrawAgain={drawAgainOf(againOfDrawing(drawing))}
            onEditDrawing={editTrackOf(drawingTrackInPlace)}
          />
        ) : (finishing || freeFinishing) && stretchAsked ? (
          // «Stretch» opens the exercises (part B) over «Your run», where
          // they leave the runner; «Skip» goes there at once.
          <StretchReminder
            onSkip={() => setStretchAsked(false)}
            onStretch={() => {
              setStretchAsked(false);
              setStretching(true);
            }}
          />
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
              setScreen(routeList);
            }}
            onNearMe={
              farIdea === null
                ? undefined
                : () => themed.ask(nearMeRequest(farIdea.idea, farIdea.from))
            }
            apiUrl={API_URL}
            onPlace={(point) => setPlaceFocus({ point })}
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
            onDrawAgain={
              explored.status === "done"
                ? drawAgainOf(againOfRequest(explored.request))
                : undefined
            }
            onEditDrawing={
              explored.status === "done"
                ? editCardOf(exploredFigure, explored.request.distance_m)
                : undefined
            }
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
              setScreen(fromCanvas ? "canvas" : "choose");
            }}
            exporting={exporting}
            onExport={() => {
              if (view.status === "done" && chosen !== null) {
                gpx.exportGpx(view.request, chosen);
              }
            }}
            onTryDistance={(distance_m) => {
              // The figure on the map grows or shrinks to it (TASK-281).
              if (fromCanvas) {
                const sized = mapDraw.sizeTo(distance_m);
                if (sized) {
                  draw(sized);
                }
                return;
              }
              distance.choose(distance_m);
              if (request) {
                draw({ ...request, distance_m });
              }
            }}
            onPickShape={onPickShape}
            onRetry={retry}
            onLiftPen={() => {
              // A word in one line that did not come out (TASK-311 B): the
              // switch turns on, and the word is drawn with the pen up.
              setPenUp(true);
              if (view.status === "done" || view.status === "failed") {
                draw(withPenUp(view.request));
              }
            }}
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
            figures={
              <FigureTiles
                chosen={resultTile}
                onChoose={onChangeFigure}
                // On the water only the shapes, as in «Draw».
                pictures={sportActivity !== "paddling"}
                testID="result-figures"
              />
            }
          />
        )}
        {/* Under the card of a run that ended: «Save» or «Discard», with an
            account (TASK-172). */}
        {(finishing || freeFinishing) && (
          <RunEnd onSave={onSaveRun} onDiscard={onDiscardRun} />
        )}
        {/* The stretching, over the whole screen, until done or skipped
            (TASK-285 part B). */}
        {stretching && <StretchScreen onLeave={() => setStretching(false)} />}
      </MapScreen>
      {/* Over the map, opposite the way back: keep the route shown. */}
      <FavoriteHeart route={onMap} />
      {page !== -1 && (
        <Pager
          page={page}
          onPage={(index) => showPage(pages[index])}
          action={
            // The sport at the left of the way to «Profile» (TASK-205),
            // whose circle is the name of the profile's page (TASK-278).
            <View style={styles.actions}>
              <SportButton />
              <ProfileButton
                selected={screen === "profile"}
                onPress={() => showPage("profile")}
              />
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
                  status={startStatus(startMode, position, start)}
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
                  onPickOnMap={onOpenPick}
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
                      onFreehand={onOpenCanvas}
                    />
                  </ImageEditsContext.Provider>
                  {/* The shape game, right under the distance (the user's
                      choice of 2026-10-29), while the API has it. */}
                  {playOn && <PlayRow onPress={() => showPage("play")} />}
                  {/* Shapes ready to run near the phone, or in other cities
                      (TASK-306): one opens as a route of «Explore», and «←»
                      comes back here. */}
                  {sportActivity === "running" && (
                    <NearYou
                      cards={nearYou}
                      onOpen={(route) => {
                        Keyboard.dismiss();
                        closeExplore();
                        openExplored(route);
                        setRouteList("choose");
                        setScreen("map");
                      }}
                    />
                  )}
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
                    onIdea={(idea) => {
                      Keyboard.dismiss();
                      closeExplore();
                      // Planned already: it opens at once, nothing asked.
                      themed.show(idea);
                      setRouteList("explore");
                      setScreen("map");
                    }}
                  />
                ),
            },
            {
              // The account's own profile, after «Explore» (TASK-278): no
              // name in the header, where its circle is.
              title: pageTitle("profile"),
              unnamed: true,
              lazy: true,
              render: () => (
                <OwnProfile
                  active={screen === "profile"}
                  onBack={profileFrom !== null ? backFromProfile : undefined}
                />
              ),
            },
          ]}
        />
      )}
      {/* The shape game (TASK-296, ADR-0255) over the app, opened from its
          row in «Draw»: «←» goes back there. */}
      {screen === "play" && (
        <PlayOverlay
          onBack={() => setScreen("choose")}
          onSignIn={() => showPage("profile")}
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
