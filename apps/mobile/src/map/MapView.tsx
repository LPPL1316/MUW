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
import { MapLoadingBar } from "../route/LoadingBar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import type { LngLat } from "./coordinates";
import { type MapKind, useMapKind } from "./mapKind";
import { buildMapPage, isExternalUrl } from "./mapPage";
import {
  clearProgress,
  clearRoute,
  clearStops,
  clearTrack,
  follow,
  pageScript,
  parsePageMessage,
  setDoubleTap,
  setKind,
  setMove,
  setPosition,
  showOthers,
  showProgress,
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
   * run starts there. */
  progress?: {
    alongM: number;
    arrived: boolean;
    points?: LatLon[];
    along?: number[];
  } | null;
  /** The places of a themed route (TASK-129), or null for none. */
  stops?: { name: string; point: LatLon; passed: boolean }[] | null;
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
  onDoubleTap,
  moving = false,
  onMoved,
  bearing = 0,
  turn = null,
  onTurned,
  onError,
  style,
}: Props) {
  const webView = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // The names on the map in the app's language: a new language loads the
  // page again, as «Retry» does, and the map is told everything again.
  const language = useLanguage();
  const page = useMemo(() => buildMapPage(language), [language]);
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
  const doubleTapAsked = useRef(false);
  const moveAsked = useRef(false);
  const turnAsked = useRef<Turn | null>(null);
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

  // A page that loads is standard: told the kind when it is another, and
  // each new kind after. The camera and the route stay as they are.
  useEffect(() => {
    if (ready && (kind !== "standard" || kindAsked.current !== "standard")) {
      webView.current?.injectJavaScript(pageScript(setKind(kind)));
      kindAsked.current = kind;
    }
  }, [ready, kind]);

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
