import type { MessageAttachment } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { cachedMedia, mediaImage } from "../api/messageMedia";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { attachmentLabel } from "./attachmentText";
import { playerPage } from "./videoPage";

const PLAYER_FILE = "message-player.html";

type Props = {
  attachment: MessageAttachment;
  apiUrl: string;
  token: string;
  apiKey?: string | null;
  onClose: () => void;
  /** The tests' own: where a file of the message is, once downloaded. */
  cached?: typeof cachedMedia;
  share?: (uri: string, mimeType: string) => Promise<void>;
};

async function shareFile(uri: string, mimeType: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: t("Share") });
  }
}

/** The page of the player beside the video in the cache; null when it
 * cannot be written. */
function playerFile(videoUri: string): string | null {
  try {
    const file = new File(Paths.cache, PLAYER_FILE);
    file.create({ overwrite: true });
    file.write(playerPage(videoUri));
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * A photo or a video of a message on the whole screen (TASK-333): the
 * photo as the API keeps it, the video downloaded into the cache and played
 * in a WebView with the phone's controls. «Share» opens the phone's sheet,
 * from which it is saved too; «Close» goes back to the conversation.
 */
export function MediaViewer({
  attachment,
  apiUrl,
  token,
  apiKey,
  onClose,
  cached = cachedMedia,
  share = shareFile,
}: Props) {
  const insets = useSafeAreaInsets();
  const video = attachment.kind === "video";
  // The video's file, then its player; null while it comes, "" if it cannot.
  const [player, setPlayer] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const options = apiKey === undefined ? {} : { key: apiKey };

  useEffect(() => {
    if (!video) {
      return;
    }
    let live = true;
    void cached(apiUrl, token, attachment, options).then((uri) => {
      if (live) {
        setPlayer(uri === null ? "" : (playerFile(uri) ?? ""));
      }
    });
    return () => {
      live = false;
    };
    // The attachment's id says which file: asked once for each.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, token, attachment.media_id, video]);

  function shareIt() {
    setSharing(true);
    setProblem(null);
    void cached(apiUrl, token, attachment, options).then(async (uri) => {
      if (uri === null) {
        setSharing(false);
        setProblem(t("No connection. Try again when you are online."));
        return;
      }
      try {
        await share(uri, video ? "video/mp4" : "image/jpeg");
      } catch {
        // The sheet closed or could not open: nothing to say.
      }
      setSharing(false);
    });
  }

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.media}>
          {!video && attachment.media_id !== null ? (
            <Image
              style={styles.fill}
              resizeMode="contain"
              source={mediaImage(apiUrl, token, attachment.media_id, false, apiKey)}
              accessibilityLabel={attachmentLabel(attachment)}
            />
          ) : player === null ? (
            <Text style={styles.note}>{t("Loading…")}</Text>
          ) : player === "" ? (
            <Text style={styles.note}>
              {t("No connection. Try again when you are online.")}
            </Text>
          ) : (
            <WebView
              testID="message-video-player"
              style={styles.fill}
              containerStyle={styles.fill}
              source={{ uri: player }}
              originWhitelist={["*"]}
              allowingReadAccessToURL={Paths.cache.uri}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              accessibilityLabel={attachmentLabel(attachment)}
            />
          )}
        </View>
        {problem !== null && (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        )}
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (pressed || sharing) && styles.pressed,
            ]}
            onPress={shareIt}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityState={{ disabled: sharing }}
          >
            <Text style={styles.buttonText}>{t("Share")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t("Close")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Dark whatever the tone: a photo or a video reads best on it.
  screen: {
    flex: 1,
    backgroundColor: color.scrim,
  },
  media: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    flex: 1,
    alignSelf: "stretch",
    backgroundColor: color.scrim,
  },
  note: {
    color: color.onScrim,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.onScrim,
    fontSize: fontSize.body,
    textAlign: "center",
    paddingHorizontal: space.lg,
  },
  buttons: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.onScrim,
  },
  buttonText: {
    color: color.onScrim,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.6,
  },
});
