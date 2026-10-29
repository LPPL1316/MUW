import type { MessageAttachment } from "@shaperoute/shared-types";
import { Image, StyleSheet, Text, View } from "react-native";

import { mediaImage } from "../api/messageMedia";
import { RouteThumb } from "../explore/RouteThumb";
import { favoriteTitle } from "../favorites/favoriteRoute";
import { t } from "../i18n";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { attachmentLine, duration } from "./attachmentText";

/** The widest a photo or a video is shown in a message. */
export const MEDIA_SIDE = 220;
/** The side of a drawing's line in a message. */
export const DRAWING_SIDE = 140;

type Props = {
  attachment: MessageAttachment;
  apiUrl: string;
  token: string;
  apiKey?: string | null;
};

/** Width and height shown, the longer side MEDIA_SIDE; a square without. */
export function shownSize(
  width: number | null,
  height: number | null,
): { width: number; height: number } {
  if (width === null || height === null || width <= 0 || height <= 0) {
    return { width: MEDIA_SIDE, height: MEDIA_SIDE };
  }
  const scale = MEDIA_SIDE / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * What a message carries, in its bubble (TASK-333): a photo, a video's
 * first picture with ▶ and its length (a dark square without one), «This
 * video has expired.», or a drawing: its line, what it draws and how long
 * it is, opened on the map with a tap (part C). The bubble is what is
 * touched, and what VoiceOver reads (attachmentLabel).
 */
export function MessageMedia({ attachment, apiUrl, token, apiKey }: Props) {
  if (attachment.kind === "drawing") {
    const card = attachment.drawing;
    if (card === null) {
      return <Text style={styles.line}>{attachmentLine("drawing")}</Text>;
    }
    return (
      <View style={styles.drawing} testID="message-drawing">
        <RouteThumb line={card.preview} width={DRAWING_SIDE} height={DRAWING_SIDE} />
        <Text style={styles.line}>{attachmentLine("drawing")}</Text>
        <Text style={styles.detail}>
          {`${favoriteTitle(card)} · ${distanceLabel(card.route_m)}`}
        </Text>
      </View>
    );
  }
  if (attachment.kind === "video" && attachment.expired) {
    return <Text style={styles.gone}>{t("This video has expired.")}</Text>;
  }
  if (attachment.media_id === null) {
    return null;
  }
  const size = shownSize(attachment.width, attachment.height);
  const picture =
    attachment.kind === "photo" || attachment.poster
      ? mediaImage(
          apiUrl,
          token,
          attachment.media_id,
          attachment.kind === "video",
          apiKey,
        )
      : null;
  return (
    <View style={[styles.frame, size]} testID="message-media">
      {picture !== null && (
        <Image style={StyleSheet.absoluteFill} source={picture} resizeMode="cover" />
      )}
      {attachment.kind === "video" && (
        <View style={styles.play}>
          <Text style={styles.playText}>▶</Text>
          <Text style={styles.length}>{duration(attachment.duration_ms ?? 0)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: color.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    alignItems: "center",
    gap: space.xs,
  },
  playText: {
    color: color.onScrim,
    fontSize: fontSize.title,
  },
  length: {
    color: color.onScrim,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  line: {
    color: color.text,
    fontSize: fontSize.body,
  },
  drawing: {
    gap: space.xs,
  },
  detail: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  gone: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontStyle: "italic",
  },
});
