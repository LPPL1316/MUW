import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SamplePost } from "../feed/sampleFeed";
import { t } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import {
  guessable,
  loadBest,
  pointsFor,
  type Round,
  roundOf,
  saveBest,
  shapesOf,
} from "./guessRounds";
import { PenDrawing, penShare, usePenClock } from "./PenDrawing";
import { shuffled } from "./waitingLines";

/** The game's pen is slower than the show's: there is time to think. */
export const GAME_PEN_MS = 8000;
/** After an answer, the next drawing. */
export const NEXT_MS = 1500;
/** The drawing is as tall as the three answers. */
const DRAWING_SIZE = 3 * MIN_TAP_SIZE + 2 * space.sm;

type Answer = { shape: string; points: number };

type Props = {
  posts: readonly SamplePost[];
  /** How often the pen moves on (`PEN_TICK_MS`, or `LIGHT_TICK_MS`). */
  tickMs?: number;
  random?: () => number;
};

/**
 * «Guess the shape» while the route is drawn (TASK-317): the pen traces a
 * drawing of «Feed», and the sooner the right shape is picked among three,
 * the more points. The best score stays on the phone.
 */
export function GuessShape({ posts, tickMs, random = Math.random }: Props) {
  const shapes = useMemo(() => shapesOf(posts), [posts]);
  const [order] = useState(() => shuffled(guessable(posts), random));
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState<Round | null>(() =>
    order.length === 0 ? null : roundOf(order[0], shapes, random),
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => loadBest());
  const ms = usePenClock(String(turn), answer === null, tickMs);
  const share = answer === null ? penShare(ms, GAME_PEN_MS) : 1;

  useEffect(() => {
    if (answer === null) {
      return;
    }
    const id = setTimeout(() => {
      const next = turn + 1;
      setTurn(next);
      setRound(roundOf(order[next % order.length], shapes, random));
      setAnswer(null);
    }, NEXT_MS);
    return () => clearTimeout(id);
  }, [answer, turn, order, shapes, random]);

  if (round === null) {
    return null;
  }

  const pick = (shape: string) => {
    if (answer !== null) {
      return;
    }
    const points = shape === round.post.shape ? pointsFor(share) : 0;
    setAnswer({ shape, points });
    const total = score + points;
    setScore(total);
    if (total > best) {
      setBest(total);
      saveBest(total);
    }
  };

  return (
    <View style={styles.game} testID="guess-shape">
      <View style={styles.head}>
        <Text style={styles.label}>{t("Guess the shape")}</Text>
        <Text style={styles.score}>
          {answer === null
            ? t("Score {score} · Best {best}", { score, best })
            : answer.points > 0
              ? t("Right! +{points}", { points: answer.points })
              : t("It was: {shape}", { shape: shapeName(round.post.shape) })}
        </Text>
      </View>
      <View style={styles.row}>
        <PenDrawing
          line={round.post.line}
          gaps={round.post.gaps}
          size={DRAWING_SIZE}
          share={share}
        />
        <View style={styles.options}>
          {round.options.map((shape) => {
            const right = answer !== null && shape === round.post.shape;
            const wrong = answer?.shape === shape && !right;
            return (
              <Pressable
                key={shape}
                style={[styles.option, right && styles.right, wrong && styles.wrong]}
                onPress={() => pick(shape)}
                accessibilityRole="button"
                accessibilityState={{ disabled: answer !== null }}
              >
                <Text style={[styles.optionText, right && styles.rightText]}>
                  {shapeName(shape)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  game: {
    gap: space.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  score: {
    flexShrink: 1,
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    gap: space.md,
  },
  options: {
    flex: 1,
    gap: space.sm,
  },
  option: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  right: {
    borderWidth: 2,
    borderColor: color.text,
  },
  wrong: {
    borderWidth: 2,
    borderColor: color.warning,
  },
  optionText: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  rightText: {
    fontWeight: fontWeight.bold,
  },
});
