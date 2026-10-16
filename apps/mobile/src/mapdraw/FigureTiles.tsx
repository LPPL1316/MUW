import { SHAPES } from "@shaperoute/shared-types";
import { Image, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import { SAMPLE_PICTURES } from "../route/samplePictures";
import { SHAPE_SIGNS } from "../route/ShapeTiles";
import { shapeName } from "../route/shapeWords";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import type { ChosenTile, FigureChoice } from "./resultFigure";

type Props = {
  /** The tile of the figure there is, marked by its border. */
  chosen: ChosenTile;
  onChoose: (choice: FigureChoice) => void;
  /** The ready-made pictures after the shapes; none on the water. */
  pictures?: boolean;
  /** «+ photo» first, a picture of the phone: only on the map to draw on. */
  onPhoto?: () => void;
  /** A photo being traced: «+ photo» waits. */
  photoBusy?: boolean;
  testID?: string;
};

/**
 * The figures as a row of tiles that slides sideways (TASK-281, TASK-286):
 * the 17 shapes of the catalogue by their signs and the 12 ready-made
 * pictures of «Draw» (TASK-280). The same tiles on the map of «Draw on the
 * map», where «+ photo» comes first, and under the route drawn.
 */
export function FigureTiles({
  chosen,
  onChoose,
  pictures = true,
  onPhoto,
  photoBusy = false,
  testID,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {onPhoto && (
        <Pressable
          style={[styles.tile, styles.photo]}
          onPress={onPhoto}
          disabled={photoBusy}
          accessibilityRole="button"
        >
          <Text style={styles.photoText}>{t("+ photo")}</Text>
        </Pressable>
      )}
      {SHAPES.map((shape) => {
        const selected = shape === chosen.shape;
        return (
          <Pressable
            key={shape}
            style={[styles.tile, selected && styles.selected]}
            onPress={() => onChoose({ kind: "shape", shape })}
            accessibilityRole="button"
            accessibilityLabel={shapeName(shape)}
            accessibilityState={{ selected }}
          >
            <Text style={styles.sign}>{SHAPE_SIGNS[shape]}</Text>
          </Pressable>
        );
      })}
      {pictures &&
        SAMPLE_PICTURES.map((sample) => {
          const selected = sample.id === chosen.sample;
          return (
            <Pressable
              key={sample.id}
              style={[styles.tile, selected && styles.selected]}
              onPress={() => onChoose({ kind: "picture", sample })}
              accessibilityRole="button"
              accessibilityLabel={t(sample.name)}
              accessibilityState={{ selected }}
            >
              <Image source={sample.source} style={styles.picture} />
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

const TILE = MIN_TAP_SIZE + space.md;

const styles = StyleSheet.create({
  row: {
    gap: space.sm,
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  // Chosen is told by the border, not by yellow: that is the route's.
  selected: {
    borderColor: color.text,
  },
  photo: {
    width: TILE + space.xl,
    borderColor: color.borderStrong,
  },
  photoText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  sign: {
    color: color.text,
    fontSize: fontSize.title,
  },
  picture: {
    width: TILE - space.md,
    height: TILE - space.md,
    borderRadius: radius.sm,
  },
});
