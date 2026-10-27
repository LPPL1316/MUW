import type { FeedPost as Post } from "@shaperoute/shared-types";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FeedPost } from "../feed/FeedPost";
import { shownPost } from "../feed/feedPosts";
import { t } from "../i18n";
import { useBlockedNow } from "../social/blockedNow";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { WinnerBadge } from "./WinnerBadge";

type Props = {
  /** The winning drawing, as the contest has it. */
  drawing: Post;
  /** How wide the post is, as the others of «Feed». */
  width: number;
  /** Opens it whole; left out (nobody signed in), it is not a button. */
  onOpen?: () => void;
};

/**
 * The contest at the top of «Feed» for the week after its winner was
 * proclaimed (TASK-299 part B, docs/CONCORSI.md §7): «{name} won the MuW
 * contest» with the «Winner» badge, over the winning post drawn as the
 * posts of «Feed», with its map. Gone at once when its author is blocked.
 */
export function WinnerCard({ drawing, width, onOpen }: Props) {
  const blocked = useBlockedNow(drawing.author.public_id);
  const post = useMemo(() => shownPost(drawing), [drawing]);
  if (blocked) {
    return null;
  }
  return (
    <View style={styles.winner} testID="winner-card">
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {t("{name} won the MuW contest", { name: drawing.author.username })}
        </Text>
        <WinnerBadge />
      </View>
      <FeedPost post={post} width={width} onOpen={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  winner: {
    gap: space.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
});
