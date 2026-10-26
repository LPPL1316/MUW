import {
  CHALLENGE_DAYS_DEFAULT,
  CHALLENGE_DAYS_MAX,
  CHALLENGE_DAYS_MIN,
  CHALLENGE_FAST_DISTANCES_M,
  CHALLENGE_PACE_S_MAX,
  CHALLENGE_PACE_S_MIN,
  CHALLENGE_PIECE_M_MAX,
  CHALLENGE_PIECE_M_MIN,
  CHALLENGE_PIECES_MAX,
  CHALLENGE_PIECES_MIN,
  type ChallengeRequest,
  type GameCatalog,
} from "@shaperoute/shared-types";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import { Segmented } from "../screens/Segmented";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { metresPer } from "../units/format";
import type { Units } from "../units/units";
import { goalDistanceLabel, goalPaceLabel, goalText } from "./goalText";
import { shapeNameIn } from "./ShapeCard";
import { ShapeOutline } from "./ShapeOutline";

type Props = {
  catalog: GameCatalog;
  /** How many are in the team: the pieces to start from, within limits. */
  members: number;
  units: Units;
  language: Language;
  /** The challenge is on its way to the API. */
  sending: boolean;
  problem: string | null;
  onStart: (request: ChallengeRequest) => void;
  onCancel: () => void;
};

type PieceKind = "distance" | "pace";

/** A distance piece starts at this much, in the units; − and + step by one. */
const DISTANCE_DEFAULT_UNITS = 5;
/** A fast piece starts at 5:00 a kilometre; − and + step by 15 s in the
 * pace's own unit. */
const PACE_DEFAULT_S = 300;
const PACE_STEP_S = 15;
const SHAPE_SIDE = 56;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * A new challenge for the team (TASK-296 part D, docs/GIOCO.md §6.2): a
 * shape of the catalog, how many pieces (2 to 12), what each piece asks (so
 * many kilometres, or 1 or 5 km under a pace) and how many days (1 to 14,
 * 7 by default). The API checks the same limits; the form keeps inside
 * them so it never asks something refused.
 */
export function NewChallenge({
  catalog,
  members,
  units,
  language,
  sending,
  problem,
  onStart,
  onCancel,
}: Props) {
  const [shapeId, setShapeId] = useState(catalog.shapes[0]?.id ?? "");
  const [pieces, setPieces] = useState(() =>
    clamp(members, CHALLENGE_PIECES_MIN, CHALLENGE_PIECES_MAX),
  );
  const [kind, setKind] = useState<PieceKind>("distance");
  const [distance, setDistance] = useState(DISTANCE_DEFAULT_UNITS);
  const [fastM, setFastM] = useState(CHALLENGE_FAST_DISTANCES_M[0]);
  const [paceS, setPaceS] = useState(PACE_DEFAULT_S);
  const [days, setDays] = useState(CHALLENGE_DAYS_DEFAULT);
  const perUnit = metresPer(units);
  const distanceMin = Math.ceil(CHALLENGE_PIECE_M_MIN / perUnit);
  const distanceMax = Math.floor(CHALLENGE_PIECE_M_MAX / perUnit);
  // 15 s a mile is fewer seconds a kilometre.
  const paceStep = PACE_STEP_S / (perUnit / 1000);
  const piece: ChallengeRequest["piece"] =
    kind === "distance"
      ? {
          kind: "distance",
          total_m: clamp(
            Math.round(distance * perUnit),
            CHALLENGE_PIECE_M_MIN,
            CHALLENGE_PIECE_M_MAX,
          ),
        }
      : {
          kind: "pace",
          distance_m: fastM,
          pace_s: clamp(Math.round(paceS), CHALLENGE_PACE_S_MIN, CHALLENGE_PACE_S_MAX),
        };
  const goal =
    piece.kind === "distance"
      ? {
          kind: "distance" as const,
          total_m: piece.total_m,
          distance_m: null,
          pace_s: null,
        }
      : {
          kind: "pace" as const,
          total_m: null,
          distance_m: piece.distance_m,
          pace_s: piece.pace_s,
        };
  const canStart = !sending && shapeId !== "";
  return (
    <View style={styles.form} testID="new-challenge">
      <Text style={styles.title} accessibilityRole="header">
        {t("New challenge")}
      </Text>

      <Text style={styles.label}>{t("Shape")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.shapes}>
          {catalog.shapes.map((shape) => {
            const selected = shape.id === shapeId;
            return (
              <Pressable
                key={shape.id}
                style={[styles.shape, selected && styles.shapeSelected]}
                onPress={() => setShapeId(shape.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={shapeNameIn(shape, language)}
                testID={`new-shape-${shape.id}`}
              >
                <ShapeOutline
                  outline={shape.outline}
                  size={SHAPE_SIDE}
                  color={selected ? color.accent : color.textFaint}
                  thickness={2}
                />
                <Text style={styles.shapeName} numberOfLines={1}>
                  {shapeNameIn(shape, language)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Text style={styles.label}>{t("Pieces")}</Text>
      <Stepper
        value={String(pieces)}
        less={t("Fewer pieces")}
        more={t("More pieces")}
        onStep={(by) =>
          setPieces((last) =>
            clamp(last + by, CHALLENGE_PIECES_MIN, CHALLENGE_PIECES_MAX),
          )
        }
        testID="new-pieces"
      />

      <Text style={styles.label}>{t("Each piece")}</Text>
      <Segmented
        options={[
          { value: "distance", label: t("Distance") },
          { value: "pace", label: t("Fast") },
        ]}
        value={kind}
        onChange={setKind}
        style={styles.segmented}
      />
      {kind === "distance" ? (
        <Stepper
          value={goalDistanceLabel(
            piece.kind === "distance" ? piece.total_m : 0,
            units,
          )}
          less={t("Shorter")}
          more={t("Longer")}
          onStep={(by) =>
            setDistance((last) => clamp(last + by, distanceMin, distanceMax))
          }
          testID="new-distance"
        />
      ) : (
        <>
          <Segmented
            options={CHALLENGE_FAST_DISTANCES_M.map((metres) => ({
              value: String(metres),
              label: goalDistanceLabel(metres, units),
            }))}
            value={String(fastM)}
            onChange={(value) => setFastM(Number(value))}
            style={styles.segmented}
          />
          <Stepper
            value={goalPaceLabel(piece.kind === "pace" ? piece.pace_s : paceS, units)}
            less={t("Slower pace")}
            more={t("Faster pace")}
            onStep={(by) =>
              setPaceS((last) =>
                clamp(last - by * paceStep, CHALLENGE_PACE_S_MIN, CHALLENGE_PACE_S_MAX),
              )
            }
            testID="new-pace"
          />
        </>
      )}

      <Text style={styles.label}>{t("Days")}</Text>
      <Stepper
        value={String(days)}
        less={t("Fewer days")}
        more={t("More days")}
        onStep={(by) =>
          setDays((last) => clamp(last + by, CHALLENGE_DAYS_MIN, CHALLENGE_DAYS_MAX))
        }
        testID="new-days"
      />

      <Text style={styles.summary} testID="new-summary">
        {t("{count} pieces · {goal} each", {
          count: pieces,
          goal: goalText(goal, units),
        })}
      </Text>
      {problem !== null && (
        <Text
          style={styles.problem}
          accessibilityLiveRegion="polite"
          testID="new-problem"
        >
          {problem}
        </Text>
      )}
      <View style={styles.buttons}>
        <Pressable
          style={[styles.start, !canStart && styles.off]}
          onPress={() => onStart({ shape_id: shapeId, pieces, piece, days })}
          disabled={!canStart}
          accessibilityRole="button"
          testID="new-start"
        >
          {sending ? (
            <ActivityIndicator color={color.onAccent} />
          ) : (
            <Text style={styles.startText}>{t("Start the challenge")}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.cancel}
          onPress={onCancel}
          accessibilityRole="button"
          testID="new-cancel"
        >
          <Text style={styles.cancelText}>{t("Cancel")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** − value +, as the distance of «Draw» (`route/DistanceStepper`). */
function Stepper({
  value,
  less,
  more,
  onStep,
  testID,
}: {
  value: string;
  less: string;
  more: string;
  onStep: (by: -1 | 1) => void;
  testID: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.step}
        onPress={() => onStep(-1)}
        accessibilityRole="button"
        accessibilityLabel={less}
        testID={`${testID}-less`}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.value} testID={testID}>
        {value}
      </Text>
      <Pressable
        style={styles.step}
        onPress={() => onStep(1)}
        accessibilityRole="button"
        accessibilityLabel={more}
        testID={`${testID}-more`}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.sm,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  label: {
    marginTop: space.sm,
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  shapes: {
    flexDirection: "row",
    gap: space.sm,
  },
  shape: {
    alignItems: "center",
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    width: SHAPE_SIDE + space.md * 2,
  },
  shapeSelected: {
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  shapeName: {
    color: color.text,
    fontSize: fontSize.label,
  },
  segmented: {
    backgroundColor: color.surface,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  step: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  stepText: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.medium,
  },
  value: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  summary: {
    marginTop: space.sm,
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  buttons: {
    gap: space.sm,
    marginTop: space.sm,
  },
  start: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  startText: {
    color: color.onAccent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  cancel: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  cancelText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  off: {
    opacity: 0.4,
  },
});
