import { forwardRef, useMemo, useRef } from "react";
import { type GestureResponderEvent, StyleSheet, Text, View } from "react-native";

import { fitLines, type Segment } from "../activities/fitLines";
import { t } from "../i18n";
import { HeartBadge } from "../intro/HeartBadge";
import { bearingOf } from "../map/turnedMap";
import { color, fontWeight } from "../theme/tokens";
import {
  POST_RESULTS,
  postLine,
  type PostResult,
  type PostRun,
  resultName,
  resultValue,
} from "./postRun";
import { isTap, type Sticker } from "./stickers";

/** A story's shape on Instagram: 9 wide, 16 tall. */
export const POST_RATIO = 16 / 9;

/** Where the drawing sits, as shares of the post's height: between the
 * title and the numbers. */
const DRAWING_TOP = 0.2;
const DRAWING_BOTTOM = 0.7;
/** Every size of the post is a share of its width: the picture made from it
 * looks the same on any phone. */
const SIDE = 0.08;
const LINE = 0.02;
const BADGE = 0.09;
const NAME = 0.05;
const TITLE = 0.065;
const LABEL = 0.035;
const VALUE = 0.075;
const EMOJI = 0.11;

type Props = {
  run: PostRun;
  /** The results on, in any order: the post keeps its own. */
  shown: readonly PostResult[];
  stickers: readonly Sticker[];
  /** The post's width in points; its height follows (POST_RATIO). */
  width: number;
  onMoveSticker: (id: number, x: number, y: number) => void;
  onRemoveSticker: (id: number) => void;
};

/**
 * The post as it is shared (TASK-231): on the yellow of Sgrava, the logo,
 * the title, the drawing the run made in black, the results chosen and the
 * emoji where the runner dragged them. The whole track is drawn, start and
 * end too (ADR-0330). A run along a turned route is drawn turned back, so the
 * drawing reads upright (TASK-232). The ref is the View the picture is
 * made of.
 */
export const PostImage = forwardRef<View, Props>(function PostImage(
  { run, shown, stickers, width, onMoveSticker, onRemoveSticker },
  ref,
) {
  const height = width * POST_RATIO;
  const boxWidth = width * (1 - 2 * SIDE);
  const boxHeight = height * (DRAWING_BOTTOM - DRAWING_TOP);
  const line = width * LINE;
  const bearing = bearingOf(run.rotationDeg);
  const [segments] = useMemo(
    () => fitLines([postLine(run.track)], boxWidth, boxHeight, line, bearing),
    [run.track, boxWidth, boxHeight, line, bearing],
  );
  const results = POST_RESULTS.filter(
    (result) => shown.includes(result) && resultValue(run, result) !== null,
  );

  return (
    <View
      ref={ref}
      // Android draws a View it can fold away into its parent: the picture
      // would come out empty.
      collapsable={false}
      style={[styles.post, { width, height }]}
      testID="post-image"
    >
      <View
        style={[styles.brand, { top: width * SIDE * 0.6, left: width * SIDE * 0.6 }]}
      >
        <HeartBadge size={width * BADGE} />
        <Text style={[styles.name, { fontSize: width * NAME }]}>MuW</Text>
      </View>
      {run.title !== null && (
        <Text
          style={[
            styles.title,
            { top: height * 0.1, left: width * SIDE, right: width * SIDE },
            { fontSize: width * TITLE },
          ]}
          numberOfLines={2}
        >
          {run.title}
        </Text>
      )}
      <View
        style={[
          styles.drawing,
          { top: height * DRAWING_TOP, left: width * SIDE },
          { width: boxWidth, height: boxHeight },
        ]}
        accessible={false}
      >
        {segments.map((s, i) => (
          <View
            key={i}
            testID="post-drawing"
            style={[styles.line, placed(s, line), { borderRadius: line / 2 }]}
          />
        ))}
      </View>
      <View
        style={[
          styles.results,
          { left: width * SIDE, right: width * SIDE, bottom: height * 0.04 },
        ]}
      >
        {results.map((result) => (
          <View key={result} style={styles.result}>
            <Text style={[styles.label, { fontSize: width * LABEL }]}>
              {resultName(result)}
            </Text>
            <Text style={[styles.value, { fontSize: width * VALUE }]}>
              {resultValue(run, result)}
            </Text>
          </View>
        ))}
      </View>
      {stickers.map((sticker) => (
        <StickerView
          key={sticker.id}
          sticker={sticker}
          width={width}
          height={height}
          onMove={onMoveSticker}
          onRemove={onRemoveSticker}
        />
      ))}
    </View>
  );
});

function placed(s: Segment, thickness: number) {
  return {
    left: s.left,
    top: s.top - thickness / 2,
    width: s.length + thickness / 2,
    height: thickness,
    transform: [{ rotate: `${s.angle}deg` }],
  };
}

type StickerProps = {
  sticker: Sticker;
  width: number;
  height: number;
  onMove: (id: number, x: number, y: number) => void;
  onRemove: (id: number) => void;
};

/** One emoji on the post: dragged, it moves; tapped, it goes. */
function StickerView({ sticker, width, height, onMove, onRemove }: StickerProps) {
  const size = width * EMOJI;
  // Where the finger went down, on the screen, and the emoji then.
  const from = useRef({ pageX: 0, pageY: 0, x: sticker.x, y: sticker.y });
  const moved = (event: GestureResponderEvent) => ({
    dx: event.nativeEvent.pageX - from.current.pageX,
    dy: event.nativeEvent.pageY - from.current.pageY,
  });
  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // A drag on the emoji is the emoji's, not the page's under it.
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        from.current = { pageX, pageY, x: sticker.x, y: sticker.y };
      }}
      onResponderMove={(event) => {
        const { dx, dy } = moved(event);
        onMove(sticker.id, from.current.x + dx / width, from.current.y + dy / height);
      }}
      onResponderRelease={(event) => {
        const { dx, dy } = moved(event);
        if (isTap(dx, dy)) {
          onRemove(sticker.id);
        }
      }}
      style={[
        styles.sticker,
        {
          left: sticker.x * width - size * 0.7,
          top: sticker.y * height - size * 0.7,
          width: size * 1.4,
          height: size * 1.4,
        },
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={sticker.emoji}
      accessibilityHint={t("Drag it to move it. Tap it to take it off.")}
      // VoiceOver cannot drag: its double tap takes the emoji off.
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") {
          onRemove(sticker.id);
        }
      }}
      testID="post-sticker"
    >
      <Text style={{ fontSize: size }}>{sticker.emoji}</Text>
    </View>
  );
}

// The post is a picture of Sgrava, the same in any theme: its yellow and
// black are the logo's (ADR-0129).
const styles = StyleSheet.create({
  post: {
    backgroundColor: color.accent,
    overflow: "hidden",
  },
  brand: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    color: color.onAccent,
    fontWeight: fontWeight.bold,
  },
  title: {
    position: "absolute",
    color: color.onAccent,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  drawing: {
    position: "absolute",
  },
  line: {
    position: "absolute",
    backgroundColor: color.onAccent,
  },
  results: {
    position: "absolute",
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  result: {
    width: "50%",
  },
  label: {
    color: color.onAccent,
    fontWeight: fontWeight.medium,
  },
  value: {
    color: color.onAccent,
    fontWeight: fontWeight.bold,
  },
  sticker: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
});
