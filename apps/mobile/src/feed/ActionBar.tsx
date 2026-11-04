import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isOnSnow } from "../activities/snow";
import { t } from "../i18n";
import { SharePost } from "../share/SharePost";
import type { PostRun } from "../share/postRun";
import { useFollowsDoor } from "../social/followsDoor";
import { color, font, fontWeight, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { Tap } from "../ui/Tap";
import { useDrawAgainDoor } from "./drawAgainDoor";
import type { ShownPost } from "./feedPosts";

/**
 * A member's drawing as its post shows it. What the card has is already cut
 * (ADR-0114), and the post cuts it again: nothing but less leaves the phone.
 * No key: this picture is not kept as the post of a run of the account.
 */
export function postOfDrawing({ drawing }: Pick<ShownPost, "drawing">): PostRun {
  return {
    key: null,
    title: drawing.title,
    track: drawing.track_preview,
    distanceM: drawing.distance_m,
    durationMs: drawing.duration_s * 1000,
    ...(drawing.activity === undefined ? {} : { activity: drawing.activity }),
    ...(drawing.rotation_deg == null ? {} : { rotationDeg: drawing.rotation_deg }),
  };
}

type Props = {
  post: ShownPost;
  /** Opens the drawing whole, where its comments and six reactions are. */
  onOpen: () => void;
};

/**
 * What can be done from a member's card (TASK-355): its comments and its
 * reactions open the drawing; «Share» only on one's own, since a drawing of
 * somebody else leaves the app only with a consent nobody has asked for
 * (the user's choice); «Draw it near me» in yellow, the card's one yellow
 * command, when «Draw» can draw its figure. Beside the card's button and
 * not inside it, or a screen reader would never reach them.
 */
export function ActionBar({ post, onOpen }: Props) {
  const { account } = useFollowsDoor();
  const drawAgain = useDrawAgainDoor()(post.drawing);
  const [sharing, setSharing] = useState<PostRun | null>(null);
  const { state } = account;
  const mine =
    state.status === "signedIn" &&
    state.session.user.public_id === post.drawing.author.public_id;
  return (
    <>
      <Hairline />
      <View style={styles.bar} testID="feed-actions">
        <Tap style={styles.action} onPress={onOpen} accessibilityRole="button">
          <Text style={styles.actionText}>{t("Comments")}</Text>
        </Tap>
        <Tap style={styles.action} onPress={onOpen} accessibilityRole="button">
          <Text style={styles.actionText}>{t("Reactions")}</Text>
        </Tap>
        {mine && (
          <Tap
            style={styles.action}
            onPress={() => setSharing(postOfDrawing(post))}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t("Share")}</Text>
          </Tap>
        )}
        {/* Not on the snow: no route to draw again (TASK-375). */}
        {drawAgain !== undefined && !isOnSnow(post.drawing.activity) && (
          <Tap style={styles.again} onPress={drawAgain} accessibilityRole="button">
            <Text style={styles.againText} numberOfLines={1}>
              {t("Draw it near me")}
            </Text>
          </Tap>
        )}
      </View>
      {sharing !== null && <SharePost run={sharing} onClose={() => setSharing(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
    padding: space.sm,
  },
  action: {
    minHeight: MIN_TAP_SIZE,
    minWidth: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  actionText: {
    ...font.small,
    color: color.text,
  },
  // Takes what the others leave, or a line of its own in a longer language.
  again: {
    flexGrow: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  againText: {
    ...font.small,
    color: color.onAccent,
    fontWeight: fontWeight.bold,
  },
});
