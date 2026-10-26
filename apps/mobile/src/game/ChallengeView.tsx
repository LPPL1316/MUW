import type {
  ChallengePiece,
  GameChallenge,
  GameShape,
  Person,
} from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { dayLabel } from "../activities/activityText";
import { decimal, t, tPlural } from "../i18n";
import type { Language } from "../i18n/languages";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { inUnits } from "../units/format";
import type { Units } from "../units/units";
import { goalDistanceLabel, goalText } from "./goalText";
import { FREE_PIECE_COLOR, personColors } from "./personColors";
import {
  placeOutline,
  type Point,
  polylineSegments,
  splitPolyline,
} from "./pieceSegments";
import { shapeNameIn } from "./ShapeCard";
import { tickMs, timeLeftText } from "./timeLeft";

type Props = {
  challenge: GameChallenge;
  /** The shape of the catalog, for its name; null for one the phone's
   * catalog does not know. */
  shape: GameShape | null;
  /** The team's members, for the colours and the names. */
  members: readonly Person[];
  /** The account's public_id: its pieces are «Yours»; null if unknown. */
  me: string | null;
  /** A piece on its way to be taken or left: the buttons wait. */
  busy: boolean;
  problem: string | null;
  onHold: (idx: number) => void;
  onRelease: (idx: number) => void;
  units: Units;
  language: Language;
  /** The clock of the countdown; the tests give theirs. */
  now?: () => number;
};

/** The drawing takes this much of the screen's width, never huge. */
const DRAW_SHARE = 0.6;
const DRAW_WIDEST = 240;
/** The line stays inside the square by this much. */
const PAD_SHARE = 0.1;
const RUN_THICKNESS = 4;
const FREE_THICKNESS = 3;
const SWATCH = 12;

const clock = () => Date.now();

/**
 * A challenge of a team (TASK-296 part D, docs/GIOCO.md §6 and §9): the
 * shape drawn piece by piece, each piece in the colour of who holds or ran
 * it as far as it is run, the rest in grey; who gave how many kilometres;
 * the pieces, free, taken or done, with «Take this piece» and «Leave»; how
 * much is done and the time left, ticking. Complete, it says so; expired,
 * how many pieces were missing.
 */
export function ChallengeView({
  challenge,
  shape,
  members,
  me,
  busy,
  problem,
  onHold,
  onRelease,
  units,
  language,
  now = clock,
}: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * DRAW_SHARE, DRAW_WIDEST);
  const colors = personColors(members, challenge);
  const names = new Map<string, string>();
  members.forEach((member) => names.set(member.public_id, member.username));
  challenge.contributions.forEach((gave) => {
    if (!names.has(gave.public_id)) {
      names.set(gave.public_id, gave.username);
    }
  });
  challenge.pieces.forEach((piece) => {
    if (piece.holder !== null && !names.has(piece.holder.public_id)) {
      names.set(piece.holder.public_id, piece.holder.username);
    }
  });
  const active = challenge.status === "active";
  const done = challenge.pieces.filter((piece) => piece.done).length;
  const total = challenge.pieces.length;
  const holding = challenge.pieces.some(
    (piece) => piece.holder?.public_id === me && !piece.done,
  );
  const name = shape === null ? challenge.shape_id : shapeNameIn(shape, language);
  const each = challenge.pieces[0]?.goal;
  const given = gaveWhat(challenge);
  return (
    <View style={styles.view} testID="challenge-view">
      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      {each !== undefined && (
        <Text style={styles.asks}>
          {t("{count} pieces · {goal} each", {
            count: total,
            goal: goalText(each, units),
          })}
        </Text>
      )}
      <View style={styles.drawing}>
        <PiecesDrawing challenge={challenge} colors={colors} size={size} />
      </View>
      {active ? (
        <Countdown endsAt={challenge.ends_at} now={now} />
      ) : challenge.status === "completed" ? (
        <Text style={styles.outcome} testID="challenge-complete">
          {t("Complete! Your team drew it together.")}
          {challenge.completed_at !== null
            ? ` ${dayLabel(challenge.completed_at)}`
            : ""}
        </Text>
      ) : (
        <Text style={styles.outcome} testID="challenge-expired">
          {tPlural(
            total - done,
            "Time ran out: {count} piece was missing.",
            "Time ran out: {count} pieces were missing.",
          )}
        </Text>
      )}
      <Text style={styles.progress} testID="challenge-progress">
        {t("{done} of {total} pieces done", { done, total })}
      </Text>

      <Text style={styles.heading}>{t("WHO GAVE WHAT")}</Text>
      {given.length === 0 ? (
        <Text style={styles.muted}>{t("Nobody has run yet.")}</Text>
      ) : (
        given.map(({ id, metres }) => (
          <View
            key={id}
            style={styles.row}
            accessible
            accessibilityLabel={`${names.get(id) ?? id}, ${distanceText(metres, units)}`}
            testID={`gave-${id}`}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: colors.get(id) ?? FREE_PIECE_COLOR },
              ]}
            />
            <Text style={styles.rowText} numberOfLines={1}>
              {names.get(id) ?? id}
            </Text>
            <Text style={styles.rowValue}>{distanceText(metres, units)}</Text>
          </View>
        ))
      )}

      <Text style={styles.heading}>{t("PIECES")}</Text>
      {challenge.pieces.map((piece) => {
        const holder = piece.holder?.public_id ?? null;
        const mine = holder !== null && holder === me;
        const state = pieceState(piece, me, names, units);
        const swatch =
          holder !== null || piece.done_m > 0
            ? (colors.get(holder ?? topGiver(challenge, piece.idx) ?? "") ??
              FREE_PIECE_COLOR)
            : FREE_PIECE_COLOR;
        const canTake =
          active && !piece.done && holder === null && !holding && me !== null;
        const canLeave = active && !piece.done && mine;
        return (
          <View
            key={piece.idx}
            style={styles.piece}
            accessible
            accessibilityLabel={`${t("Piece {n}", { n: piece.idx + 1 })}, ${goalText(piece.goal, units)}, ${state}`}
            testID={`piece-${piece.idx}`}
          >
            <View style={[styles.swatch, { backgroundColor: swatch }]} />
            <View style={styles.pieceText}>
              <Text style={styles.rowText}>
                {t("Piece {n}", { n: piece.idx + 1 })} · {goalText(piece.goal, units)}
              </Text>
              <Text style={styles.pieceState}>{state}</Text>
            </View>
            {canTake && (
              <Pressable
                style={[styles.button, busy && styles.off]}
                onPress={() => onHold(piece.idx)}
                disabled={busy}
                accessibilityRole="button"
                testID={`take-${piece.idx}`}
              >
                <Text style={styles.buttonText}>{t("Take this piece")}</Text>
              </Pressable>
            )}
            {canLeave && (
              <Pressable
                style={[styles.button, busy && styles.off]}
                onPress={() => onRelease(piece.idx)}
                disabled={busy}
                accessibilityRole="button"
                testID={`leave-${piece.idx}`}
              >
                <Text style={styles.buttonText}>{t("Leave")}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {problem !== null && (
        <Text
          style={styles.problem}
          accessibilityLiveRegion="polite"
          testID="challenge-problem"
        >
          {problem}
        </Text>
      )}
    </View>
  );
}

/** How far the piece is run, from 0 to 1: a fast piece is done or not. */
export function doneShare(piece: ChallengePiece): number {
  if (piece.done) {
    return 1;
  }
  if (piece.goal.kind === "distance" && piece.goal.total_m > 0) {
    return Math.min(1, piece.done_m / piece.goal.total_m);
  }
  return 0;
}

/** Who gave the most metres to the piece; null when nobody did. */
function topGiver(challenge: GameChallenge, idx: number): string | null {
  let best: { id: string; metres: number } | null = null;
  for (const gave of challenge.contributions) {
    if (gave.idx === idx && (best === null || gave.metres > best.metres)) {
      best = { id: gave.public_id, metres: gave.metres };
    }
  }
  return best?.id ?? null;
}

/** The metres of each person, all pieces together, the most first. */
function gaveWhat(challenge: GameChallenge): { id: string; metres: number }[] {
  const sums = new Map<string, number>();
  for (const gave of challenge.contributions) {
    sums.set(gave.public_id, (sums.get(gave.public_id) ?? 0) + gave.metres);
  }
  return [...sums.entries()]
    .map(([id, metres]) => ({ id, metres }))
    .filter(({ metres }) => metres > 0)
    .sort((a, b) => b.metres - a.metres);
}

/** "7.4 km", "4.6 mi". */
function distanceText(metres: number, units: Units): string {
  return `${decimal(inUnits(metres, units))} ${units}`;
}

/** "2.4 / 5 km": how far along a distance piece is; "" for a fast one. */
function progressText(piece: ChallengePiece, units: Units): string {
  if (piece.goal.kind !== "distance") {
    return "";
  }
  return `${decimal(inUnits(piece.done_m, units))} / ${goalDistanceLabel(piece.goal.total_m, units)}`;
}

/** "Done by ada", "Yours · 2.4 / 5 km", "Taken by ada · 2.4 / 5 km", "Free". */
function pieceState(
  piece: ChallengePiece,
  me: string | null,
  names: ReadonlyMap<string, string>,
  units: Units,
): string {
  const holder = piece.holder;
  const who = holder === null ? null : (names.get(holder.public_id) ?? holder.username);
  if (piece.done) {
    return who === null ? t("Done") : t("Done by {name}", { name: who });
  }
  const along = progressText(piece, units);
  const state =
    holder === null
      ? t("Free")
      : holder.public_id === me
        ? t("Yours")
        : t("Taken by {name}", { name: who ?? holder.username });
  return along !== "" && (holder !== null || piece.done_m > 0)
    ? `${state} · ${along}`
    : state;
}

/** The time left, written again as it passes. */
function Countdown({ endsAt, now }: { endsAt: string; now: () => number }) {
  const [at, setAt] = useState(now);
  const tick = tickMs(endsAt, at);
  useEffect(() => {
    const timer = setInterval(() => setAt(now()), tick);
    return () => clearInterval(timer);
  }, [endsAt, now, tick]);
  return (
    <Text style={styles.countdown} testID="challenge-time-left">
      {timeLeftText(endsAt, at)}
    </Text>
  );
}

/**
 * The shape as thin turned Views, piece by piece: each piece's run part in
 * the colour of who holds it (or, left free, of who ran most of it), the
 * rest in grey, all fitted together as the shape is.
 */
function PiecesDrawing({
  challenge,
  colors,
  size,
}: {
  challenge: GameChallenge;
  colors: ReadonlyMap<string, string>;
  size: number;
}) {
  const whole: Point[] = challenge.pieces.flatMap((piece) => piece.outline);
  const place = placeOutline(whole, size, size * PAD_SHARE);
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      testID="pieces-drawing"
    >
      {challenge.pieces.map((piece) => {
        const placed = piece.outline.map(place);
        const [run, left] = splitPolyline(placed, doneShare(piece));
        const who = piece.holder?.public_id ?? topGiver(challenge, piece.idx);
        const tint =
          who === null ? FREE_PIECE_COLOR : (colors.get(who) ?? FREE_PIECE_COLOR);
        return [
          ...polylineSegments(left).map((s, i) => (
            <View
              key={`${piece.idx}-left-${i}`}
              style={[styles.stroke, strokeStyle(s, FREE_THICKNESS, FREE_PIECE_COLOR)]}
              testID={`stroke-${piece.idx}-left`}
            />
          )),
          ...polylineSegments(run).map((s, i) => (
            <View
              key={`${piece.idx}-run-${i}`}
              style={[styles.stroke, strokeStyle(s, RUN_THICKNESS, tint)]}
              testID={`stroke-${piece.idx}-run`}
            />
          )),
        ];
      })}
    </View>
  );
}

function strokeStyle(
  s: { left: number; top: number; length: number; angle: number },
  thickness: number,
  tint: string,
) {
  return {
    left: s.left,
    top: s.top - thickness / 2,
    width: s.length + thickness / 2,
    height: thickness,
    borderRadius: thickness / 2,
    backgroundColor: tint,
    transform: [{ rotate: `${s.angle}deg` }],
  };
}

const styles = StyleSheet.create({
  view: {
    gap: space.sm,
  },
  name: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  asks: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  drawing: {
    alignItems: "center",
    marginVertical: space.sm,
  },
  stroke: {
    position: "absolute",
  },
  countdown: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  outcome: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  progress: {
    color: color.textMuted,
    fontSize: fontSize.small,
    textAlign: "center",
  },
  heading: {
    marginTop: space.md,
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
  },
  muted: {
    color: color.textFaint,
    fontSize: fontSize.small,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TAP_SIZE - space.md,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
  },
  rowValue: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  piece: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xs,
    minHeight: MIN_TAP_SIZE,
  },
  pieceText: {
    flex: 1,
    gap: 2,
  },
  pieceState: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
  off: {
    opacity: 0.4,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
});
