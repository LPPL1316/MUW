import type { DrawingDetail, DrawingPhoto } from "@shaperoute/shared-types";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { dayLabel } from "../activities/activityText";
import { useWinnerDrawingId } from "../contest/contestKept";
import { WinnerBadge } from "../contest/WinnerBadge";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { runDistanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { DrawingComments } from "./DrawingComments";
import { DrawingReactions } from "./DrawingReactions";
import { useDrawingsDoor } from "./drawingsDoor";
import { useFollowsDoor } from "./followsDoor";
import { activityName } from "./PublicParts";

type Props = {
  drawing: DrawingDetail;
  /** Back to «Profile», where it was opened. */
  onBack: () => void;
};

/** The height of the photos under the map; the width follows each. */
export const PHOTO_HEIGHT = 160;

/**
 * A drawing on the map (TASK-117), under it: its title (without one, the
 * day it was run), the day, what it was and the km (the miles with
 * «Miles», TASK-182); then its photos, to scroll sideways, how it went,
 * and the names tagged, each of which opens its profile (TASK-208). Never
 * the score (TASK-241, the user's choice), nor the time of day: the
 * others see the drawing, not when somebody runs. Its comments open from
 * a button (TASK-120), and next to it are its reactions (TASK-119). The
 * drawing that won the contest kept on the phone has the «Winner» band on
 * top (TASK-299).
 */
export function DrawingCard({ drawing, onBack }: Props) {
  const day = dayLabel(drawing.started_at);
  const units = useUnits();
  const { photoSource } = useDrawingsDoor();
  const { openProfile } = useFollowsDoor();
  const won = useWinnerDrawingId() === drawing.id;
  // A super like goes with a comment: the comments are asked for again.
  const [superLikes, setSuperLikes] = useState(0);
  const photos = drawing.photos ?? [];
  const tags = drawing.tags ?? [];
  const facts = [
    ...(drawing.activity === undefined ? [] : [activityName(drawing.activity)]),
    runDistanceLabel(drawing.distance_m, units),
  ].join(" · ");
  return (
    <View style={styles.card}>
      {won && <WinnerBadge band />}
      <View style={styles.row}>
        <View style={styles.words}>
          <Text style={styles.title}>{drawing.title ?? day}</Text>
          {drawing.title !== null && <Text style={styles.message}>{day}</Text>}
          <Text style={styles.facts}>{facts}</Text>
        </View>
      </View>
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
        >
          {photos.map((photo) => (
            <Photo key={photo.n} photo={photo} source={photoSource(photo)} />
          ))}
        </ScrollView>
      )}
      {drawing.description != null && drawing.description !== "" && (
        <Text style={styles.description}>{drawing.description}</Text>
      )}
      {tags.length > 0 && (
        <View style={styles.tags} accessibilityLabel={t("Tagged")}>
          {tags.map((tag) => (
            <Pressable
              key={tag.public_id}
              style={styles.tag}
              onPress={() =>
                openProfile({
                  public_id: tag.public_id,
                  username: tag.username,
                  photo: null,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("{name}'s profile", { name: tag.username })}
            >
              <Text style={styles.tagText}>{tag.username}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <DrawingReactions
        drawingId={drawing.id}
        onSuperLiked={() => setSuperLikes((count) => count + 1)}
        beside={<DrawingComments key={superLikes} drawingId={drawing.id} />}
      />
      <Pressable style={styles.button} onPress={onBack} accessibilityRole="button">
        <Text style={styles.buttonText}>{t("Back to the profile")}</Text>
      </Pressable>
    </View>
  );
}

function Photo({
  photo,
  source,
}: {
  photo: DrawingPhoto;
  source: { uri: string; headers?: Record<string, string> } | null;
}) {
  if (source === null) {
    return null;
  }
  const width = Math.round((PHOTO_HEIGHT * photo.width) / Math.max(photo.height, 1));
  return (
    <Image
      source={source}
      style={[styles.photo, { width }]}
      accessibilityLabel={t("Photo {n}", { n: photo.n })}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  words: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  facts: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  photos: {
    gap: space.sm,
  },
  photo: {
    height: PHOTO_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
  },
  description: {
    color: color.text,
    fontSize: fontSize.body,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  tag: {
    minHeight: MIN_TAP_SIZE - space.sm,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  tagText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
