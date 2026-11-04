import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fitLines, type Segment } from "../activities/fitLines";
import { t } from "../i18n";
import { bearingOf } from "../map/turnedMap";
import {
  color,
  fontSize,
  fontWeight,
  radius,
  route,
  routeCasingOf,
  space,
} from "../theme/tokens";
import { type PostRun, withoutEnds } from "./postRun";
import { styleName, stylePalette, VIDEO_STYLES, type VideoStyle } from "./videoStyle";

/** A tile has the video's shape, 9 wide and 16 tall: three fit in a row. */
const TILE_WIDTH = 104;
const TILE_HEIGHT = 185;
/** The drawing's place in the tile, as in the video (videoScene): in from
 * the sides, between the title's room and the numbers'. */
const SIDE = 0.08;
const DRAWING_TOP = 0.2;
const DRAWING_BOTTOM = 0.7;
/** The line in the tile, in points. */
const LINE = 2;

type Props = {
  run: PostRun;
  /** The style the video gets. */
  style: VideoStyle;
  onChange: (style: VideoStyle) => void;
};

/** One straight piece of the drawing, as a turned View (as PostImage). */
function placed(s: Segment, thickness: number) {
  return {
    left: s.left,
    top: s.top - thickness / 2,
    width: s.length + thickness / 2,
    height: thickness,
    borderRadius: thickness / 2,
    transform: [{ rotate: `${s.angle}deg` }],
  };
}

/**
 * «Style» in «Share your run» (TASK-351, ADR-0303): a tile for each style
 * of the video, with the run's drawing in the style's colours on its map's
 * ground, one of them chosen; «Night» when the post opens. The tiles are
 * the video's shape, so what they show is where the drawing will be.
 */
export function StyleRow({ run, style, onChange }: Props) {
  const bearing = bearingOf(run.rotationDeg);
  const [segments] = useMemo(
    () =>
      fitLines(
        [withoutEnds(run.track)],
        TILE_WIDTH * (1 - 2 * SIDE),
        TILE_HEIGHT * (DRAWING_BOTTOM - DRAWING_TOP),
        LINE,
        bearing,
      ),
    [run.track, bearing],
  );
  // The route's dark edge on the light map (ADR-0231), scaled to the tile's line.
  const casing = routeCasingOf("light");
  const edge =
    casing === null ? null : LINE + (casing.width - route.width) * (LINE / route.width);

  return (
    <>
      <Text style={styles.label}>{t("Style")}</Text>
      <View style={styles.tiles} accessibilityRole="radiogroup">
        {VIDEO_STYLES.map((each) => {
          const on = each === style;
          const palette = stylePalette(each);
          return (
            <View key={each} style={styles.choice}>
              <Pressable
                style={[
                  styles.tile,
                  { backgroundColor: palette.map.background },
                  on && styles.tileOn,
                ]}
                onPress={() => onChange(each)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={styleName(each)}
              >
                <View style={styles.drawing} pointerEvents="none">
                  {each === "day" &&
                    casing !== null &&
                    edge !== null &&
                    segments.map((s, i) => (
                      <View
                        key={`edge-${i}`}
                        style={[
                          styles.line,
                          placed(s, edge),
                          { backgroundColor: casing.color, opacity: casing.opacity },
                        ]}
                      />
                    ))}
                  {segments.map((s, i) => (
                    <View
                      key={i}
                      testID="style-line"
                      style={[
                        styles.line,
                        placed(s, LINE),
                        { backgroundColor: palette.accent },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
              <Text style={[styles.name, on && styles.nameOn]}>{styleName(each)}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // As the labels of SharePost.
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  tiles: {
    flexDirection: "row",
    gap: space.xl,
  },
  choice: {
    width: TILE_WIDTH,
    alignItems: "center",
    gap: space.xs,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.hairline,
    overflow: "hidden",
  },
  tileOn: {
    borderWidth: 2,
    borderColor: color.text,
  },
  drawing: {
    position: "absolute",
    left: TILE_WIDTH * SIDE,
    top: TILE_HEIGHT * DRAWING_TOP,
    width: TILE_WIDTH * (1 - 2 * SIDE),
    height: TILE_HEIGHT * (DRAWING_BOTTOM - DRAWING_TOP),
  },
  line: {
    position: "absolute",
  },
  name: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  nameOn: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
});
