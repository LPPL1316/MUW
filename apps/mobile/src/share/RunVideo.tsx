import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { t } from "../i18n";
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
import type { VideoScene } from "./videoScene";

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
 * Modal, where iOS keeps it on screen. The music's file is read while the
 * pictures are made, and goes into the MP4 as its second track. On a map
 * look the page draws the map first (TASK-351); when it cannot, within its
 * own time, the `fallback` scene is made instead.
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
  const fallbackJson = useMemo(() => JSON.stringify(fallback), [fallback]);
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
            makeCall(message.ok ? sceneJson : fallbackJson),
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
    <WebView
      ref={webView}
      testID="run-video"
      // The WebView's own container grows (flex 1): kept out of the layout too.
      containerStyle={styles.hidden}
      style={styles.hidden}
      pointerEvents="none"
      source={{ html: VIDEO_PAGE, baseUrl: VIDEO_PAGE_BASE }}
      originWhitelist={["*"]}
      javaScriptEnabled
      onMessage={(event) => receive(event.nativeEvent.data)}
      onContentProcessDidTerminate={() => end("failed")}
      onRenderProcessGone={() => end("failed")}
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    left: -10,
    top: -10,
  },
});
