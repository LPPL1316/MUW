import type { ProfileBadge } from "@shaperoute/shared-types";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Avatar } from "./Avatar";
import { BadgeRow } from "./BadgeRow";

export const PROFILE_AVATAR_SIZE = 2 * MIN_TAP_SIZE;

/** The «+» on the circle: small, the whole circle takes the tap. */
const PLUS_SIZE = space.xl + space.xs;

/** The circle as the button that changes one's own picture (TASK-207). */
export type PhotoButton = {
  /** The ways to change it are open under the header. */
  open: boolean;
  /** A change is on its way: no tap. */
  busy: boolean;
  onPress: () => void;
};

type Props = {
  username: string;
  /** "" without one: no line. */
  bio: string;
  /** The picture as an `Image` shows it; null: the initial. */
  photo: string | null;
  /** A line under the name: the email on one's own, the drawings on another's. */
  detail: string;
  /** One's own profile: the circle changes the picture; left out, it does not. */
  photoButton?: PhotoButton;
  /** It won a contest (`contest_wins` ≥ 1): the «Winner» badge under the name. */
  winner?: boolean;
  /**
   * The badges it earned (TASK-341), after «Winner»; null or left out from an
   * API older than TASK-341. On one's own (`photoButton` given) also those
   * still to earn, dimmed.
   */
  badges?: readonly ProfileBadge[] | null;
};

/**
 * Who a profile is (TASK-116): the picture, the name, a line about it and
 * the bio. The same on one's own «Profile» and on another member's; on
 * one's own the circle has a «+» and changes the picture (TASK-207). Who
 * won a contest has the «Winner» badge under the name, for good (TASK-299),
 * and the badges of the drawings follow it (TASK-341).
 */
export function ProfileHeader({
  username,
  bio,
  photo,
  detail,
  photoButton,
  winner = false,
  badges = null,
}: Props) {
  const avatar = <Avatar name={username} size={PROFILE_AVATAR_SIZE} photo={photo} />;
  return (
    <View style={styles.who}>
      {photoButton === undefined ? (
        avatar
      ) : (
        <Pressable
          style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
          onPress={photoButton.onPress}
          disabled={photoButton.busy}
          accessibilityRole="button"
          // One name for the circle: the letter and the «+» are not read.
          accessibilityLabel={t("Profile picture")}
          accessibilityState={{
            expanded: photoButton.open,
            disabled: photoButton.busy,
            busy: photoButton.busy,
          }}
        >
          {avatar}
          <View style={styles.plus} testID="photo-plus">
            <Text style={styles.plusText}>+</Text>
          </View>
        </Pressable>
      )}
      <Text style={styles.username}>{username}</Text>
      <BadgeRow winner={winner} badges={badges} own={photoButton !== undefined} />
      <Text style={styles.detail}>{detail}</Text>
      {bio !== "" && <Text style={styles.bio}>{bio}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  who: {
    alignItems: "center",
    gap: space.xs,
    paddingBottom: space.sm,
  },
  circle: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
  },
  pressed: {
    opacity: 0.6,
  },
  // White on the dark ring of the page: the yellow belongs to the route.
  plus: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.background,
    backgroundColor: color.text,
  },
  plusText: {
    color: color.background,
    fontSize: fontSize.input + space.xs,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.input + space.sm,
  },
  username: {
    marginTop: space.sm,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  detail: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  bio: {
    marginTop: space.sm,
    color: color.text,
    fontSize: fontSize.body,
    textAlign: "center",
  },
});
