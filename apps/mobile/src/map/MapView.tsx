import type { LatLon, Stretch, Walk } from "@shaperoute/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";

import { t } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { usePocketOn } from "../navigation/pocketOn";
import { cumulative } from "../navigation/progress";
import { useRunBehind } from "../navigation/runBehind";
import { MapLoadingBar } from "../route/LoadingBar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { fromLngLat, type LngLat } from "./coordinates";
import { type MapKind, useMapKind } from "./mapKind";
import { buildMapPage, isExternalUrl } from "./mapPage";
import {
  type CanvasMode,
  clearCanvas,
  clearProgress,
  clearRejoin,
  clearRoute,
  clearStops,
  focus as focusMap,
  clearTrack,
  follow,
  pageScript,
  parsePageMessage,
  setCanvas,
  setDoubleTap,
  setKind,
  setMove,
  setPick,
  setPosition,
  showOthers,
  showProgress,
  showRejoin,
  showRoute,
  showStops,
  showTrack,
  stopFollow,
  turn as turnMap,
} from "./messages";
import { doneMetres, splitRoute } from "./routeSplit";
import type { Turn } from "./turnedMap";

/** One empty list, so the map is not told again and again of no routes. */
const NO_OTHERS: LatLon[][] = [];

/** The figure of «Draw on the map» as the map shows it (TASK-281). */
export type MapCanvas = {
  mode: CanvasMode;
  lines: LatLon[][];
  /** Line by line, whether its first side is a link, dashed (TASK-331
   * part B); the lines a finger may bend; the points of a straight line
   * being tapped. */
  links: boolean[];
  bendable: number[];
  marks: LatLon[];
  centre: LatLon | null;
  /** How much two fingers may shrink and grow the figure. */
  shrink: number;
  grow: number;
  /** A new number frames the map on the figure, or on the start without
   * one; the same one does not frame it again. */
  framing: number;
};

/** What the page of «Draw on the map» tells the app (TASK-281). */
export type CanvasEvent =
  | { type: "drawn"; line: LatLon[]; metresPerPx: number }
  | { type: "bent"; from: LatLon; to: LatLon; metresPerPx: number }
  | { type: "figure"; centre: LatLon; factor: number; done: boolean }
  | { type: "centre"; point: LatLon };

type Props = {
  /** Where the route will start; the map centres on it with a marker. */
  start: LatLon | null;
  /** The route to draw over the roads, or null for none. */
  route: LatLon[] | null;
  /** The route's walks, for a word with the pen up (TASK-198): dashed, the
   * letters alone in the route's colour. None draws the route as before. */
  walks?: Walk[] | null;
  /** A bike route's stretches with the bike on foot (TASK-206): dashed
   * over the route. None draws the route as before. */
  onFoot?: Stretch[] | null;
  /** The other routes to choose from, grey under the route (TASK-093). */
  others?: LatLon[][];
  /** The run to draw over the route, or null for none (TASK-113). */
  track?: LatLon[] | null;
  /** While navigating, the phone's position: the map follows it (TASK-049). */
  following?: LatLon | null;
  /** Where the runner is heading, in degrees clockwise from north: the
   * marker followed is an arrow turned that way (TASK-164). */
  heading?: number | null;
  /** While running the route, how far along it the runner is (TASK-224):
   * the part run stays solid yellow, the part left is dashed and blinks.
   * None draws the route whole, as before. `points` and `along` are the
   * line `alongM` is measured on, when the navigator gives it: a closed
   * route is run from where the runner joined it (TASK-273), and the line
   * run starts there. Off the route, `rejoin` is where the runner gets back
   * on it, from where they are: the map draws dots there (TASK-303). */
  progress?: {
    alongM: number;
    arrived: boolean;
    points?: LatLon[];
    along?: number[];
    rejoin?: { from: LatLon; to: LatLon } | null;
  } | null;
  /** The places of a themed route (TASK-129), or null for none. */
  stops?: { name: string; point: LatLon; passed: boolean }[] | null;
  /** A place of a themed route tapped under the map (TASK-329): the map
   * goes there. A new one for each tap; the same one is not asked twice. */
  focus?: { point: LatLon } | null;
  /** With it, a double tap on the map calls it and no longer zooms
   * (TASK-119); two fingers still do. Without, the map is as before. */
  onDoubleTap?: () => void;
  /** While true, one finger drags the route and no longer the map
   * (TASK-238): the shape of a route on the water, moved by the user. */
  moving?: boolean;
  /** The route was dragged and left: by how many degrees of longitude and
   * of latitude. The map keeps it there until `route` changes. */
  onMoved?: (by: LngLat) => void;
  /** The bearing that shows the route upright, when its shape is turned
   * (TASK-232, `bearingOf`): the map is framed on the route turned so, and
   * stays so while it is run. 0, north up, without. */
  bearing?: number;
  /** A tap on the north arrow: the map turns there. A new one for each
   * tap; the same one is not asked twice. */
  turn?: Turn | null;
  /** The map turned, by the app or by two fingers: its bearing now, in
   * whole degrees clockwise from north. */
  onTurned?: (bearing: number) => void;
  /** «Draw on the map» (TASK-281): the figure on the map and what fingers
   * do there. None gives the map its own gestures back. */
  canvas?: MapCanvas | null;
  /** A line drawn, the figure moved or sized, the map moved (TASK-281). */
  onCanvas?: (event: CanvasEvent) => void;
  /** Choosing the start on the map (TASK-292): the map framed on `start`,
   * and a pin in its middle that stays there while fingers move the map. */
  picking?: boolean;
  /** While picking: the middle of the map, each time it stops. */
  onCentre?: (point: LatLon) => void;
  /** Called when the map cannot be shown, with a reason for the log; with
   * null once the map loads after that (TASK-256), so the screen's note
   * goes away. The map itself says it could not load and offers «Retry». */
  onError: (reason: string | null) => void;
  style?: StyleProp<ViewStyle>;
};

export function MapView({
  start,
  route,
  walks = null,
  onFoot = null,
  others = NO_OTHERS,
  track = null,
  following = null,
  heading = null,
  progress = null,
  stops = null,
  focus = null,
  onDoubleTap,
  moving = false,
  onMoved,
  bearing = 0,
  turn = null,
  onTurned,
  canvas = null,
  onCanvas,
  picking = false,
  onCentre,
  onError,
  style,
}: Props) {
  const webView = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // The names on the map in the app's language: a new language loads the
  // page again, as «Retry» does, and the map is told everything again.
  const language = useLanguage();
  const page = useMemo(() => buildMapPage(language), [language]);
  // A run behind another app has no page (TASK-304, ADR-0264): iOS keeps
  // MuW and its GPS more readily when it asks less. Back in front the page
  // loads again and is told everything again, as after «Retry».
  const behind = useRunBehind();
  if (behind && ready) {
    setReady(false);
  }
  // Until the first tiles are drawn, a bar over the map (TASK-058); an error
  // takes its place.
  const [loading, setLoading] = useState(true);
  // The page said it could not load (TASK-256): in place of the bar, the
  // words and «Retry», until the page loads. `erred` remembers it across the
  // reload, so `onError(null)` follows an error reported, and only that.
  const [failed, setFailed] = useState(false);
  const erred = useRef(false);
  const routeShown = useRef(false);
  const followed = useRef(false);
  const trackShown = useRef(false);
  const stopsShown = useRef(false);
  const othersShown = useRef(false);
  const progressShown = useRef(false);
  const rejoinShown = useRef(false);
  const doubleTapAsked = useRef(false);
  const moveAsked = useRef(false);
  const turnAsked = useRef<Turn | null>(null);
  const focusAsked = useRef<{ point: LatLon } | null>(null);
  // The figure the page was told of last, and the framing it was asked.
  const canvasShown = useRef(false);
  const framed = useRef<number | null>(null);
  const pickAsked = useRef(false);
  // The map's kind, chosen with its button (TASK-264), and the last one the
  // page was told.
  const kind = useMapKind();
  const kindAsked = useRef<MapKind>("standard");
  const along = useMemo(() => (route ? cumulative(route) : null), [route]);
  // In steps, so the map is not told of every metre.
  const doneM = progress ? doneMetres(progress) : null;
  // The line the progress is measured on, when it is not the route as
  // drawn: the same shape from where the run joined it (TASK-273).
  const runPoints =
    progress?.points !== undefined && progress.points !== route
      ? progress.points
      : null;
  const runAlong = runPoints === null ? null : (progress?.along ?? null);
  // Off the route, the way back to it (TASK-303).
  const rejoinFrom = progress?.rejoin?.from ?? null;
  const rejoinTo = progress?.rejoin?.to ?? null;
  // Under the black screen of pocket mode nobody sees the blinking.
  const pocket = usePocketOn();

  const fail = (reason: string) => {
    setLoading(false);
    setFailed(true);
    erred.current = true;
    onError(reason);
  };

  const retry = () => {
    setFailed(false);
    setLoading(true);
    webView.current?.reload();
  };

  // Offline when it opened, back with the network on: the map that could
  // not load is loaded again as the app comes to the front (TASK-256).
  useEffect(() => {
    if (!failed) {
      return;
    }
    const watching = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        retry();
      }
    });
    return () => watching.remove();
  }, [failed]);

  // A new start, even at the same place, centres the map on it again.
  useEffect(() => {
    if (ready && start) {
      webView.current?.injectJavaScript(pageScript(setPosition(start)));
    }
  }, [ready, start]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    // Before the route, which frames the map and is sent last.
    // None after some: the routes of the last result go away.
    if (others.length > 0 || othersShown.current) {
      webView.current?.injectJavaScript(pageScript(showOthers(others)));
      othersShown.current = others.length > 0;
    }
  }, [ready, others]);

  // After the start, so the map frames the route rather than the start.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (route) {
      webView.current?.injectJavaScript(
        pageScript(showRoute(route, start, walks, onFoot, bearing)),
      );
      routeShown.current = true;
    } else if (routeShown.current) {
      webView.current?.injectJavaScript(pageScript(clearRoute()));
      routeShown.current = false;
    }
  }, [ready, route, start, walks, onFoot, bearing]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (track && track.length > 1) {
      webView.current?.injectJavaScript(pageScript(showTrack(track)));
      trackShown.current = true;
    } else if (trackShown.current) {
      webView.current?.injectJavaScript(pageScript(clearTrack()));
      trackShown.current = false;
    }
  }, [ready, track]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (stops && stops.length > 0) {
      webView.current?.injectJavaScript(pageScript(showStops(stops)));
      stopsShown.current = true;
    } else if (stopsShown.current) {
      webView.current?.injectJavaScript(pageScript(clearStops()));
      stopsShown.current = false;
    }
  }, [ready, stops]);

  // Navigating: the map stays on the runner. After, the whole route again.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (following) {
      webView.current?.injectJavaScript(pageScript(follow(following, heading)));
      followed.current = true;
    } else if (followed.current) {
      followed.current = false;
      webView.current?.injectJavaScript(pageScript(stopFollow()));
      if (route) {
        webView.current?.injectJavaScript(
          pageScript(showRoute(route, start, walks, onFoot, bearing)),
        );
      }
    }
    // Only a new position moves the map, and the heading comes with it; the
    // route effect above draws the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, following]);

  // Running the route: cut where the runner is. After, the route whole again.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (route && along && doneM !== null) {
      // A route joined away from its start has no walks: it is not a word.
      const split =
        runPoints !== null && runAlong !== null
          ? splitRoute(runPoints, runAlong, doneM)
          : splitRoute(route, along, doneM, walks);
      webView.current?.injectJavaScript(pageScript(showProgress(split, !pocket)));
      progressShown.current = true;
    } else if (progressShown.current) {
      webView.current?.injectJavaScript(pageScript(clearProgress()));
      progressShown.current = false;
    }
  }, [ready, route, along, walks, doneM, pocket, runPoints, runAlong]);

  // Off the route: dots from the runner to where it goes on, moved with
  // each fix (TASK-303). Back on it, or the run over, none.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (rejoinFrom !== null && rejoinTo !== null) {
      webView.current?.injectJavaScript(pageScript(showRejoin(rejoinFrom, rejoinTo)));
      rejoinShown.current = true;
    } else if (rejoinShown.current) {
      webView.current?.injectJavaScript(pageScript(clearRejoin()));
      rejoinShown.current = false;
    }
  }, [ready, rejoinFrom, rejoinTo]);

  // Asked for only where a double tap means something: elsewhere it zooms.
  const wantsDoubleTap = onDoubleTap !== undefined;
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (wantsDoubleTap || doubleTapAsked.current) {
      webView.current?.injectJavaScript(pageScript(setDoubleTap(wantsDoubleTap)));
      doubleTapAsked.current = wantsDoubleTap;
    }
  }, [ready, wantsDoubleTap]);

  // Asked for only while the user moves a shape: elsewhere a finger drags
  // the map.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (moving || moveAsked.current) {
      webView.current?.injectJavaScript(pageScript(setMove(moving)));
      moveAsked.current = moving;
    }
  }, [ready, moving]);

  // After the route, which turns the map as its drawing: a tap on the north
  // arrow is asked of the map once, not again when the page loads again.
  useEffect(() => {
    if (ready && turn !== null && turn !== turnAsked.current) {
      webView.current?.injectJavaScript(pageScript(turnMap(turn.bearing)));
    }
    turnAsked.current = turn;
  }, [ready, turn]);

  // A place tapped under the map: asked of the map once, as the north arrow.
  useEffect(() => {
    if (ready && focus !== null && focus !== focusAsked.current) {
      webView.current?.injectJavaScript(pageScript(focusMap(focus.point)));
    }
    focusAsked.current = focus;
  }, [ready, focus]);

  // After the route, which a figure takes the place of: told each new
  // figure, framed once for each new `framing`, and again when the page
  // loads again.
  useEffect(() => {
    if (!ready) {
      framed.current = null;
      return;
    }
    if (canvas) {
      webView.current?.injectJavaScript(
        pageScript(
          setCanvas({
            mode: canvas.mode,
            lines: canvas.lines,
            links: canvas.links,
            bendable: canvas.bendable,
            marks: canvas.marks,
            centre: canvas.centre,
            shrink: canvas.shrink,
            grow: canvas.grow,
            frame: canvas.framing !== framed.current,
          }),
        ),
      );
      framed.current = canvas.framing;
      canvasShown.current = true;
    } else if (canvasShown.current) {
      webView.current?.injectJavaScript(pageScript(clearCanvas()));
      canvasShown.current = false;
      framed.current = null;
    }
  }, [ready, canvas]);

  // After the start, which the map is framed on: asked for only while the
  // start is chosen on the map (TASK-292), and again when the page loads
  // again.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (picking || pickAsked.current) {
      webView.current?.injectJavaScript(pageScript(setPick(picking)));
      pickAsked.current = picking;
    }
  }, [ready, picking]);

  // A page that loads is standard: told the kind when it is another, and
  // each new kind after. The camera and the route stay as they are.
  useEffect(() => {
    if (ready && (kind !== "standard" || kindAsked.current !== "standard")) {
      webView.current?.injectJavaScript(pageScript(setKind(kind)));
      kindAsked.current = kind;
    }
  }, [ready, kind]);

  if (behind) {
    return <View style={style} />;
  }

  return (
    <View style={style}>
      <WebView
        ref={webView}
        testID="map"
        style={styles.page}
        source={{ html: page }}
        originWhitelist={["*"]}
        onLoadStart={() => {
          setReady(false);
          setLoading(true);
          // A page that loads is north-up.
          onTurned?.(0);
        }}
        onMessage={(event) => {
          const message = parsePageMessage(event.nativeEvent.data);
          if (message?.type === "ready") {
            setReady(true);
          } else if (message?.type === "loaded") {
            setLoading(false);
            setFailed(false);
            if (erred.current) {
              erred.current = false;
              onError(null);
            }
          } else if (message?.type === "doubleTap") {
            onDoubleTap?.();
          } else if (message?.type === "moved") {
            onMoved?.(message.by);
          } else if (message?.type === "turned") {
            onTurned?.(message.bearing);
          } else if (message?.type === "drawn") {
            onCanvas?.({
              type: "drawn",
              line: message.line.map(fromLngLat),
              metresPerPx: message.metresPerPx,
            });
          } else if (message?.type === "bent") {
            onCanvas?.({
              type: "bent",
              from: fromLngLat(message.from),
              to: fromLngLat(message.to),
              metresPerPx: message.metresPerPx,
            });
          } else if (message?.type === "figure") {
            onCanvas?.({
              type: "figure",
              centre: fromLngLat(message.centre),
              factor: message.factor,
              done: message.done,
            });
          } else if (message?.type === "centre") {
            const point = fromLngLat(message.lngLat);
            if (picking) {
              onCentre?.(point);
            } else {
              onCanvas?.({ type: "centre", point });
            }
          } else if (message?.type === "error") {
            fail(message.message);
          }
        }}
        onError={(event) => fail(event.nativeEvent.description)}
        onShouldStartLoadWithRequest={(request) => {
          if (isExternalUrl(request.url)) {
            void Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
        onOpenWindow={(event) => {
          if (isExternalUrl(event.nativeEvent.targetUrl)) {
            void Linking.openURL(event.nativeEvent.targetUrl);
          }
        }}
        // iOS may stop the page to free memory: without a reload it stays white.
        onContentProcessDidTerminate={() => webView.current?.reload()}
      />
      {loading && !failed && (
        <View style={styles.loading} pointerEvents="none">
          <MapLoadingBar />
        </View>
      )}
      {failed && (
        <View style={styles.failed}>
          <Text style={styles.failedText}>
            {t("The map could not be loaded. Check the network.")}
          </Text>
          <Pressable style={styles.retry} onPress={retry} accessibilityRole="button">
            <Text style={styles.retryText}>{t("Retry")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.map.background,
  },
  // In the middle of the map, still blank while it loads: clear of the way
  // back above and of the attribution below.
  loading: {
    position: "absolute",
    top: "50%",
    left: "20%",
    right: "20%",
    marginTop: -space.xs,
  },
  // Where the bar was, the words and the button, on the blank map.
  failed: {
    position: "absolute",
    top: "50%",
    left: "15%",
    right: "15%",
    marginTop: -space.xxl,
    alignItems: "center",
    gap: space.md,
  },
  failedText: {
    color: color.text,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  retry: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  retryText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
});
