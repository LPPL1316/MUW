import type { DrawingDetail, DrawingPhoto } from "@shaperoute/shared-types";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { dayLabel } from "../activities/activityText";
import { useWinnerDrawingId } from "../contest/contestKept";
import { WinnerBadge } from "../contest/WinnerBadge";
import { ExploreStart } from "../explore/ExploreStart";
import type { StartView } from "../explore/useStartDirections";
import { t } from "../i18n";
import { ImportedMark } from "../imports/ImportedMark";
import { drawingOfDrawing } from "../messages/messageDrawing";
import { SendDrawingButton } from "../messages/SendDrawingButton";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { Tap } from "../ui/Tap";
import { runDistanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { DrawingComments } from "./DrawingComments";
import { DrawingReactions } from "./DrawingReactions";
import { followable } from "./drawingRoute";
import { useDrawingsDoor } from "./drawingsDoor";
import { useFollowsDoor } from "./followsDoor";
import { activityName } from "./PublicParts";
import { useDrawingGpx } from "./useDrawingGpx";

type Props = {
  drawing: DrawingDetail;
  /** Back to «Profile», where it was opened. */
  onBack: () => void;
  /** Runs its track (TASK-307); without it there is no «Start». */
  onStart?: () => void;
  /** «Draw it near me» (TASK-313): its shape or word chosen in «Draw»;
   * without it, a drawing «Draw» cannot choose, there is no button. */
  onDrawAgain?: () => void;
  /** «Edit the drawing» (TASK-320): its figure on the map of «Draw on the
   * map» (TASK-331); without it, an emoji or a drawing that gives no
   * figure, there is no button. */
  onEditDrawing?: () => void;
};

/** «Start» on a drawing asks for nothing first: it is never loading. */
const READY: StartView = { status: "idle" };

/** The height of the photos under the map; the width follows each. */
export const PHOTO_HEIGHT = 160;

/**
 * A drawing on the map (TASK-117), under it: its title (without one, the
 * day it was run), the day, what it was and the km (the miles with
 * «Miles», TASK-182); then its photos, to scroll sideways, how it went,
 * and the names tagged, each of which opens its profile (TASK-208). Never
 * the score (TASK-241, the user's choice), nor the time of day: the
 * others see the drawing, not when somebody runs. Its comments open from
 * a button (TASK-120), and next to it are its reactions (TASK-119). Under
 * them «Start», to run the track as the map shows it, without turn
 * directions, and «Export GPX», the same track as a file (TASK-307);
 * after them «Draw it near me», its shape or word in «Draw» (TASK-313),
 * and «Edit the drawing», its figure on the map (TASK-320, TASK-331).
 * The drawing that won the contest kept on the phone has the «Winner» band
 * on top (TASK-299). An activity added from a file of another app says
 * «Imported» under its facts (TASK-312). The title is the card's, medium
 * and not bold, the reactions and the buttons come after a hairline and
 * answer the finger through `Tap` (TASK-339, ADR-0293).
 */
export function DrawingCard({
  drawing,
  onBack,
  onStart,
  onDrawAgain,
  onEditDrawing,
}: Props) {
  const day = dayLabel(drawing.started_at);
  const units = useUnits();
  const { photoSource } = useDrawingsDoor();
  const { openProfile } = useFollowsDoor();
  const { exporting, exportGpx } = useDrawingGpx();
  const exported = exporting(drawing.id);
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
          {drawing.source !== undefined && drawing.source !== "muw" && <ImportedMark />}
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
            <Tap
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
            </Tap>
          ))}
        </View>
      )}
      {/* The reactions and the actions, after a hairline. */}
      <Hairline />
      <DrawingReactions
        drawingId={drawing.id}
        onSuperLiked={() => setSuperLikes((count) => count + 1)}
        beside={<DrawingComments key={superLikes} drawingId={drawing.id} />}
      />
      {followable(drawing) && onStart !== undefined && (
        <>
          <ExploreStart start={READY} onStart={onStart} />
          <Text style={styles.message}>
            {t("This route has no turn directions: follow the line on the map.")}
          </Text>
        </>
      )}
      {followable(drawing) && (
        <Tap
          style={styles.button}
          onPress={() => exportGpx(drawing)}
          disabled={exported === "preparing"}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {exported === "preparing" ? t("Preparing GPX…") : t("Export GPX")}
          </Text>
        </Tap>
      )}
      {exported === "failed" && (
        <Text style={styles.error}>{t("The GPX could not be made. Try again.")}</Text>
      )}
      {/* «Send to a friend» (TASK-333): the track as the map shows it, in a
          message. */}
      {followable(drawing) && (
        <SendDrawingButton
          drawing={() => drawingOfDrawing(drawing)}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      )}
      {onDrawAgain !== undefined && (
        <Tap style={styles.button} onPress={onDrawAgain} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("Draw it near me")}</Text>
        </Tap>
      )}
      {onEditDrawing !== undefined && (
        <Tap style={styles.button} onPress={onEditDrawing} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("Edit the drawing")}</Text>
        </Tap>
      )}
      <Tap style={styles.button} onPress={onBack} accessibilityRole="button">
        <Text style={styles.buttonText}>{t("Back to the profile")}</Text>
      </Tap>
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
  // The card's title, medium and not bold (ADR-0293).
  title: {
    ...font.cardTitle,
    color: color.text,
  },
  message: {
    ...font.small,
    color: color.textMuted,
  },
  error: {
    ...font.small,
    color: color.error,
  },
  facts: {
    ...font.body,
    color: color.text,
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
    ...font.body,
    color: color.text,
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
  // A name is medium, not bold.
  tagText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
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
