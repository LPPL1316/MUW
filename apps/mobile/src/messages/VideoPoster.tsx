import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { bytesOfBase64 } from "../share/videoFile";
import { POSTER_WAIT_MS, posterMessageOf, posterPage, sharedFolder } from "./videoPage";

const PAGE_FILE = "message-poster.html";

type Props = {
  /** The video chosen, on the phone. */
  videoUri: string;
  /** Once: the JPEG of its first picture in the cache, or null without. */
  onPoster: (jpegUri: string | null) => void;
};

/** The page beside the cache, for `videoUri`; null when it cannot be
 * written. */
function pageFor(videoUri: string): string | null {
  try {
    const file = new File(Paths.cache, PAGE_FILE);
    file.create({ overwrite: true });
    file.write(posterPage(videoUri));
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * Makes the first picture of a video about to be sent (TASK-333, ADR-0289,
 * point 6) in a hidden WebView, as the run's video is made (RunVideo): the
 * video goes without one when the page cannot read it in time. One for each
 * video: the conversation gives it the video's address as its key.
 */
export function VideoPoster({ videoUri, onPoster }: Props) {
  const [page] = useState(() => pageFor(videoUri));
  const done = useRef(false);
  const told = useRef(onPoster);
  useEffect(() => {
    told.current = onPoster;
  });

  const end = useCallback((jpegUri: string | null) => {
    if (!done.current) {
      done.current = true;
      told.current(jpegUri);
    }
  }, []);

  useEffect(() => {
    if (page === null) {
      end(null);
      return;
    }
    const timer = setTimeout(() => end(null), POSTER_WAIT_MS);
    return () => clearTimeout(timer);
  }, [end, page]);

  function receive(data: string) {
    const message = posterMessageOf(data);
    if (message === null) {
      return;
    }
    if (message.type === "failed") {
      end(null);
      return;
    }
    try {
      const file = new File(Paths.cache, `message-poster-${Date.now()}.jpg`);
      file.create({ overwrite: true });
      file.write(bytesOfBase64(message.jpeg));
      end(file.uri);
    } catch {
      end(null);
    }
  }

  if (page === null) {
    return null;
  }
  return (
    <WebView
      testID="video-poster"
      containerStyle={styles.hidden}
      style={styles.hidden}
      pointerEvents="none"
      source={{ uri: page }}
      originWhitelist={["*"]}
      allowingReadAccessToURL={sharedFolder(page, videoUri)}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      onMessage={(event) => receive(event.nativeEvent.data)}
      onError={() => end(null)}
      onContentProcessDidTerminate={() => end(null)}
      onRenderProcessGone={() => end(null)}
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
