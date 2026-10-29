import type { LatLon } from "@shaperoute/shared-types";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { subscribeLanguage } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { color } from "../theme/tokens";
import {
  buildFeedMapPage,
  feedMapScript,
  lineCamera,
  parseFeedMapMessage,
  type Shoot,
} from "./feedMapPage";

/** A picture that has not come by now is given up on: the next one is asked. */
export const SHOT_TIMEOUT_MS = 20_000;

type Want = Omit<Shoot, "type">;

// The pictures taken, and those still to take, in the order they were asked
// for. Kept for as long as the app runs: «Feed» is taken down and put back
// every time the map takes the screen, and a picture is not taken twice.
const images = new Map<string, string>();
let queue: readonly Want[] = [];
const listeners = new Set<() => void>();
// The shooters on screen, in the order they came. The first takes the
// pictures and the others wait: one map page at a time, wherever it is
// (TASK-332). «Feed» has one; a profile over the big map, where «Feed» is
// taken down, has its own.
let shooters: readonly object[] = [];

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function tell() {
  listeners.forEach((listener) => listener());
}

function want(shot: Want) {
  if (images.has(shot.key) || queue.some((each) => each.key === shot.key)) {
    return;
  }
  queue = [...queue, shot];
  tell();
}

/** The picture came (or, with null, did not): on to the next one. */
function settle(key: string, image: string | null) {
  if (image !== null) {
    images.set(key, image);
  }
  queue = queue.filter((each) => each.key !== key);
  tell();
}

/** The page cannot take pictures: nobody waits for one. A drawing that comes
 * back on screen asks again. */
function giveUp() {
  queue = [];
  tell();
}

/** For tests: no picture taken, none to take. */
export function forgetFeedMaps() {
  images.clear();
  queue = [];
  tell();
}

/** Whether this shooter is the one that takes the pictures now. */
function useTurn(): boolean {
  const [me] = useState(() => ({}));
  useEffect(() => {
    shooters = [...shooters, me];
    tell();
    return () => {
      shooters = shooters.filter((each) => each !== me);
      tell();
    };
  }, [me]);
  return useSyncExternalStore(subscribe, () => shooters[0] === me);
}

/**
 * The map to lay under `line` drawn by `thumbSegments` in a box `width` ×
 * `height` with `pad`: a picture, or null until `FeedMapShooter` has taken
 * it. Without a map the drawing is as it was, a line on the dark. With a
 * `bearing` the map is turned (TASK-232): it lies under
 * `turnedLine(line, bearing)`, and is another picture than the one north up.
 * In another language than English the places are named in it (TASK-210):
 * another picture too.
 */
export function useFeedMap(
  id: string,
  line: LatLon[],
  width: number,
  height: number,
  pad: number,
  bearing: number = 0,
): string | null {
  const turned = bearing === 0 ? "" : `@${bearing}`;
  const language = useLanguage();
  const named = language === "en" ? "" : `/${language}`;
  const key = `${id}:${width}x${height}${turned}${named}`;
  const camera = useMemo(
    () => lineCamera(line, width, height, pad, bearing),
    [line, width, height, pad, bearing],
  );
  useEffect(() => {
    if (camera !== null) {
      want({ key, ...camera, width, height });
    }
  }, [key, camera, width, height]);
  return useSyncExternalStore(subscribe, () => images.get(key) ?? null);
}

type Props = {
  /** How large the page is: as a drawing of the list above it. */
  width: number;
  height: number;
};

/**
 * Takes the pictures `useFeedMap` asks for (TASK-162, ADR-0131), one at a
 * time, with a map page that nobody sees: it goes under something opaque,
 * and is there only while a picture is waited for. With another shooter
 * on screen since before, that one takes them and this one waits (TASK-332).
 */
export function FeedMapShooter({ width, height }: Props) {
  // A new language: the pictures still to take are asked again in it.
  useEffect(() => subscribeLanguage(giveUp), []);
  const mine = useTurn();
  const next = useSyncExternalStore(subscribe, () => queue[0] ?? null);
  if (!mine || next === null) {
    return null;
  }
  return <Page next={next} width={width} height={height} />;
}

function Page({ next, width, height }: Props & { next: Want }) {
  const webView = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const language = useLanguage();
  const page = useMemo(() => buildFeedMapPage(language), [language]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    webView.current?.injectJavaScript(feedMapScript({ type: "shoot", ...next }));
    const timer = setTimeout(() => settle(next.key, null), SHOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, next]);

  return (
    <View
      style={[styles.page, { width, height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WebView
        ref={webView}
        testID="feed-map-page"
        style={styles.web}
        source={{ html: page }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        onLoadStart={() => setReady(false)}
        onMessage={(event) => {
          const message = parseFeedMapMessage(event.nativeEvent.data);
          if (message?.type === "ready") {
            setReady(true);
          } else if (message?.type === "shot") {
            settle(message.key, message.image);
          } else if (message?.type === "miss") {
            settle(message.key, null);
          } else if (message?.type === "error") {
            giveUp();
          }
        }}
        onError={giveUp}
        // iOS may stop the page to free memory: loaded again, it is asked again.
        onContentProcessDidTerminate={() => webView.current?.reload()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  web: {
    flex: 1,
    backgroundColor: color.map.background,
  },
});
