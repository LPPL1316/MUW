import type { StylePost as Post, StyleTag } from "@shaperoute/shared-types";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { styleImageSource } from "../api/style";
import { appLanguage } from "../i18n/language";
import { useFollowsDoor } from "../social/followsDoor";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { StyleProductSheet } from "./StyleProductSheet";
import { STORE_NAMES, styleWords } from "./styleWords";

/** The photos are 4:5, as the prompts ask (`out/TASK-384/image-prompts.md`). */
const PHOTO_RATIO = 5 / 4;
/** The dot as it is seen; the finger has `MIN_TAP_SIZE` around it. */
const DOT = 18;

type Props = {
  post: Post;
  /** How wide the card is, as a post. */
  width: number;
};

/** The title in the app's language, in English when the post has none. */
export function styleTitle(post: Pick<Post, "title">): string {
  return post.title[appLanguage()] ?? post.title.en ?? "";
}

/**
 * A MuW Style post (TASK-384, ADR-0326): MuW's logo and name where a
 * runner's would be, the photo made with AI, its title, and under it, always,
 * the two labels the user approved: made with AI, and an ad with affiliate
 * links. A dot on each product; a touch opens it in a sheet. Nothing of a
 * person: no name, no age, no likes or comments.
 */
export function StylePost({ post, width }: Props) {
  const { apiUrl } = useFollowsDoor();
  const [open, setOpen] = useState<StyleTag | null>(null);
  const words = styleWords();
  const title = styleTitle(post);
  const photoWidth = width;
  const photoHeight = Math.round(photoWidth * PHOTO_RATIO);
  return (
    <View style={styles.card} testID="style-post">
      <View style={styles.who}>
        <Image
          style={styles.logo}
          source={require("../../assets/icon.png")}
          accessible={false}
        />
        <View style={styles.names}>
          <Text style={styles.name}>MuW</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      <View style={{ width: photoWidth, height: photoHeight }}>
        {apiUrl !== null && (
          <Image
            style={StyleSheet.absoluteFill}
            source={styleImageSource(apiUrl, post)}
            resizeMode="cover"
            accessibilityLabel={`${words.aiLabel}. ${title}`}
            testID="style-photo"
          />
        )}
        {post.tags.map((tag) => (
          <Pressable
            key={tag.id}
            style={[
              styles.dotTap,
              {
                left: tag.x * photoWidth - MIN_TAP_SIZE / 2,
                top: tag.y * photoHeight - MIN_TAP_SIZE / 2,
              },
            ]}
            onPress={() => setOpen(tag)}
            accessibilityRole="button"
            accessibilityLabel={`${tag.brand} ${tag.product_name}, ${STORE_NAMES[tag.retailer]}`}
            testID={`style-dot-${tag.id}`}
          >
            <View style={styles.dot} />
          </Pressable>
        ))}
      </View>
      <View style={styles.labels} testID="style-labels">
        <Text style={styles.label}>{words.aiLabel}</Text>
        <Text style={styles.label}>{words.adLabel}</Text>
      </View>
      {open !== null && (
        <StyleProductSheet tag={open} apiUrl={apiUrl} onClose={() => setOpen(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  who: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
  },
  // Square, as the app's icon is and as on MuW's routes (`MuwPost`).
  logo: {
    width: MIN_TAP_SIZE - space.sm,
    height: MIN_TAP_SIZE - space.sm,
    borderRadius: radius.sm,
  },
  names: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  title: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
  dotTap: {
    position: "absolute",
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  // White with a dark edge: seen on any photo, light or dark.
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: color.scrim,
    backgroundColor: color.onScrim,
  },
  labels: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    padding: space.md,
  },
  // Plain words on a raised surface: never hidden, never small print.
  label: {
    ...font.small,
    color: color.text,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    overflow: "hidden",
  },
});
