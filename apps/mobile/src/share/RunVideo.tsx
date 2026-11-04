import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { t } from "../i18n";
import { color } from "../theme/tokens";
import type { AudioTrack } from "./m4a";
import { mp4Of, type VideoSample } from "./mp4";
import {
  bytesOfBase64,
  pageMessageOf,
  samplesOf,
  VIDEO_FILE,
  VIDEO_SILENCE_MS,
  type VideoOutcome,
} from "./videoFile";
import { type Music, musicTrack } from "./videoMusic";
import {
  makeCall,
  type PageTimes,
  prepareMapCall,
  VIDEO_PAGE,
  VIDEO_PAGE_BASE,
} from "./videoPage";
import { MAP_HEIGHT, MAP_WIDTH } from "./videoMap";
import { type VideoScene, withNote } from "./videoScene";

type Props = {
  scene: VideoScene;
  /** The same post on the yellow of before, for when the map does not come
   * (TASK-351): the video always comes out. */
  fallback: VideoScene;
  /** The track that goes with the pictures; null for none (TASK-301). */
  music: Music | null;
  /** How much of the video is made, from 0 to 1. */
  onProgress: (share: number) => void;
  /** Once, when the share sheet closes or the video could not be made. */
  onEnd: (outcome: VideoOutcome) => void;
  /** How long the page's steps took, in milliseconds, once the pictures are
   * all made: the map, its picture, the encoding (TASK-351's measures). */
  onTimes?: (ms: PageTimes) => void;
};

/**
 * Makes the video of a post and opens the share sheet with it (TASK-295,
 * ADR-0254): a hidden WebView (videoPage) draws and encodes the pictures,
 * the app puts them in an MP4 file in the cache folder and shares it.
 * Instagram is in the sheet (Reels, Story), and «Save Video» keeps it in
 * Photos. Mounted while the video is made; it lives inside the post's
 * Modal, at the size of the map it draws (360 × 640 points), under a cover
 * of the screen's own colour: a page out of sight, or see-through, may get
 * nothing drawn on a phone, and the map never came (TASK-351's fixes of
 * 2026-11-03 and 2026-11-04); the Feed's map page is kept the same way,
 * under what covers it. The music's file is read while the pictures are
 * made, and goes into the MP4 as its second track. On a map look the page
 * draws the map first (TASK-351); when it cannot, within its own time, the
 * `fallback` scene is made instead, with a line saying why at its foot,
 * while the cause on the phone is looked for (to take out after).
 */
export function RunVideo({
  scene,
  fallback,
  music,
  onProgress,
  onEnd,
  onTimes,
}: Props) {
  const webView = useRef<WebView>(null);
  const avcC = useRef<Uint8Array | null>(null);
  const samples = useRef<VideoSample[]>([]);
  const ended = useRef(false);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneJson = useMemo(() => JSON.stringify(scene), [scene]);
  const mapJson = useMemo(
    () => (scene.map === null ? null : JSON.stringify(scene.map)),
    [scene],
  );
  // The music's packets, read once while the pictures are made; null when
  // they could not be read.
  const [audio] = useState<Promise<AudioTrack | null> | null>(() =>
    music === null ? null : musicTrack(music).catch(() => null),
  );
  // The latest callbacks, for the timer and the page's messages.
  const callbacks = useRef({ onProgress, onEnd, onTimes });
  useEffect(() => {
    callbacks.current = { onProgress, onEnd, onTimes };
  });

  function end(outcome: VideoOutcome) {
    if (silence.current !== null) {
      clearTimeout(silence.current);
      silence.current = null;
    }
    if (!ended.current) {
      ended.current = true;
      callbacks.current.onEnd(outcome);
    }
  }

  /** Waits for the page again: with no word for too long, it is given up. */
  function listen() {
    if (silence.current !== null) {
      clearTimeout(silence.current);
    }
    silence.current = setTimeout(() => end("failed"), VIDEO_SILENCE_MS);
  }

  useEffect(() => {
    listen();
    return () => {
      ended.current = true;
      if (silence.current !== null) {
        clearTimeout(silence.current);
      }
    };
    // Once, for the life of this video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function share() {
    if (silence.current !== null) {
      clearTimeout(silence.current);
      silence.current = null;
    }
    try {
      if (avcC.current === null) {
        throw new Error("no avcC");
      }
      const sound = audio === null ? undefined : await audio;
      if (sound === null) {
        throw new Error("no music");
      }
      const bytes = mp4Of(
        {
          width: scene.width,
          height: scene.height,
          fps: scene.fps,
          avcC: avcC.current,
          samples: samples.current,
        },
        sound,
      );
      samples.current = [];
      const file = new File(Paths.cache, VIDEO_FILE);
      file.create({ overwrite: true });
      file.write(bytes);
      await Sharing.shareAsync(file.uri, {
        mimeType: "video/mp4",
        UTI: "public.mpeg-4",
        dialogTitle: t("Share"),
      });
    } catch {
      // The file not made, or the sheet not opened: nothing was shared.
      end("failed");
      return;
    }
    end("shared");
  }

  function receive(data: string) {
    if (ended.current) {
      return;
    }
    const message = pageMessageOf(data);
    if (message === null) {
      return;
    }
    listen();
    try {
      switch (message.type) {
        case "ready":
          if (message.codec === null) {
            end("unsupported");
          } else if (mapJson === null) {
            webView.current?.injectJavaScript(makeCall(sceneJson));
          } else {
            webView.current?.injectJavaScript(prepareMapCall(mapJson));
          }
          break;
        case "waiting":
          // Tiles still coming: the page is alive.
          break;
        case "map":
          webView.current?.injectJavaScript(
            makeCall(
              message.ok
                ? sceneJson
                : JSON.stringify(
                    withNote(
                      fallback,
                      `no map: ${message.why ?? "?"} ${JSON.stringify(message.ms)}`,
                    ),
                  ),
            ),
          );
          break;
        case "config":
          avcC.current = bytesOfBase64(message.avcC);
          break;
        case "chunks":
          samples.current.push(...samplesOf(message));
          break;
        case "progress":
          callbacks.current.onProgress(message.frames / scene.frames.length);
          break;
        case "done":
          callbacks.current.onProgress(1);
          callbacks.current.onTimes?.(message.ms);
          void share();
          break;
        case "failed":
          end("failed");
          break;
      }
    } catch {
      end("failed");
    }
  }

  return (
    <View
      style={styles.page}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WebView
        ref={webView}
        testID="run-video"
        containerStyle={styles.web}
        style={styles.web}
        source={{ html: VIDEO_PAGE, baseUrl: VIDEO_PAGE_BASE }}
        originWhitelist={["*"]}
        javaScriptEnabled
        scrollEnabled={false}
        onMessage={(event) => receive(event.nativeEvent.data)}
        onContentProcessDidTerminate={() => end("failed")}
        onRenderProcessGone={() => end("failed")}
      />
      <View style={styles.cover} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The page at the size of its map, in the window and drawn, at the top
  // corner of the post's screen, where the cover and the screen's own
  // content lie over it (SharePost mounts it first).
  page: {
    position: "absolute",
    left: 0,
    top: 0,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  web: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: color.background,
  },
  cover: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.background,
  },
});
