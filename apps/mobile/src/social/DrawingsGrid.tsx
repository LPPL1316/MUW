import type { Drawing } from "@shaperoute/shared-types";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { accountProblem } from "../account/messages";
import { dayLabel } from "../activities/activityText";
import { RUN_DRAWING_PAD, RunDrawing } from "../activities/RunDrawing";
import { CardMapsCredit } from "../explore/RouteCard";
import { useFeedMap } from "../feed/FeedMaps";
import { t } from "../i18n";
import { bearingOf } from "../map/turnedMap";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useDrawingsDoor } from "./drawingsDoor";
import { useSeen } from "./scrollSight";

/** Three drawings a row, as a profile shows its pictures. */
const COLUMNS = 3;
/** The side of a drawing before the grid knows its width. */
const FIRST_CELL = 96;

/** What the grid has of the profile's drawings. */
type Shown =
  | { kind: "loading" }
  | { kind: "ready"; drawings: Drawing[]; next: string | null }
  | { kind: "failed"; problem: string };

const LOADING: Shown = { kind: "loading" };

/** The words a drawing is read with: its title, or the day it was run. */
export function drawingName(drawing: {
  title: string | null;
  started_at: string;
}): string {
  return drawing.title ?? dayLabel(drawing.started_at);
}

type Props = {
  /** The profile's `public_id`; null from an API older than profiles. */
  publicId: string | null;
  /** The account's own profile: its empty grid says how to fill it. */
  own: boolean;
  /** «Drawings» over the grid; left out, it is. Under the tabs of a
   * profile (TASK-324) the tab says it. */
  titled?: boolean;
};

/**
 * «Drawings» in a profile (TASK-117, ADR-0159): the runs it made public,
 * the latest first, three a row, a page at a time. Each is the run as the
 * others see it, small and without its first and last 200 m, on the map
 * of where it was run (TASK-332); a tap opens it on the map. Never its
 * score (TASK-241).
 */
export function DrawingsGrid({ publicId, own, titled = true }: Props) {
  const { pageOf, open, opening, openProblem } = useDrawingsDoor();
  // The answer for one profile: another's is not this one's.
  const [answer, setAnswer] = useState<{ asked: string; shown: Shown } | null>(null);
  // «Try again» asks once more.
  const [tries, setTries] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (publicId === null) {
      return;
    }
    let live = true;
    void pageOf(publicId, null).then((outcome) => {
      if (!live || outcome === null) {
        return;
      }
      setAnswer({
        asked: publicId,
        shown:
          outcome.kind === "ok"
            ? {
                kind: "ready",
                drawings: outcome.value.drawings,
                next: outcome.value.next,
              }
            : { kind: "failed", problem: accountProblem(outcome) },
      });
    });
    return () => {
      live = false;
    };
  }, [pageOf, publicId, tries]);

  if (publicId === null) {
    return null;
  }
  const shown: Shown =
    answer !== null && answer.asked === publicId ? answer.shown : LOADING;

  function tryAgain() {
    setAnswer(null);
    setTries((n) => n + 1);
  }

  function loadMore() {
    if (shown.kind !== "ready" || shown.next === null || publicId === null) {
      return;
    }
    const asked = publicId;
    setLoadingMore(true);
    void pageOf(asked, shown.next).then((outcome) => {
      setLoadingMore(false);
      if (outcome === null || outcome.kind !== "ok") {
        return;
      }
      setAnswer((was) => {
        if (was === null || was.asked !== asked || was.shown.kind !== "ready") {
          return was;
        }
        // A drawing already shown is not shown twice.
        const seen = new Set(was.shown.drawings.map((d) => d.id));
        return {
          asked,
          shown: {
            kind: "ready",
            drawings: [
              ...was.shown.drawings,
              ...outcome.value.drawings.filter((d) => !seen.has(d.id)),
            ],
            next: outcome.value.next,
          },
        };
      });
    });
  }

  const cell =
    width > 0 ? Math.floor((width - space.sm * (COLUMNS - 1)) / COLUMNS) : FIRST_CELL;
  return (
    <View style={styles.section} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {titled && (
        <Text style={styles.title} accessibilityRole="header">
          {t("Drawings")}
        </Text>
      )}
      {openProblem !== null && (
        <Text style={styles.problem} accessibilityRole="alert">
          {openProblem}
        </Text>
      )}
      {shown.kind === "failed" ? (
        <>
          <Text style={styles.problem}>{shown.problem}</Text>
          <Pressable
            style={styles.button}
            onPress={tryAgain}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t("Try again")}</Text>
          </Pressable>
        </>
      ) : shown.kind === "ready" && shown.drawings.length === 0 ? (
        <Text style={styles.message}>
          {t(
            own
              ? "No public drawings yet. Make a run public in My activities."
              : "No drawings yet.",
          )}
        </Text>
      ) : shown.kind === "ready" ? (
        <>
          <View style={styles.grid}>
            {shown.drawings.map((drawing) => (
              <DrawingCell
                key={drawing.id}
                drawing={drawing}
                size={cell}
                opening={opening === drawing.id}
                disabled={opening !== null}
                onOpen={() => open(drawing)}
              />
            ))}
          </View>
          <CardMapsCredit />
          {shown.next !== null && (
            <Pressable
              style={[styles.button, loadingMore && styles.busy]}
              onPress={loadMore}
              disabled={loadingMore}
              accessibilityRole="button"
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
            >
              <Text style={styles.buttonText}>
                {t(loadingMore ? "Loading…" : "Show more")}
              </Text>
            </Pressable>
          )}
        </>
      ) : null}
    </View>
  );
}

/** A drawing is one line: the run, drawn in the route's yellow as in «Feed». */
const NO_TRACK: Drawing["track_preview"] = [];

type CellProps = {
  drawing: Drawing;
  /** The side of the square. */
  size: number;
  /** This one is being opened. */
  opening: boolean;
  disabled: boolean;
  onOpen: () => void;
};

/**
 * One drawing of the grid, on a picture of the map of where it was run, as
 * in «Feed» (TASK-332, ADR-0131). The picture is asked for once the
 * drawing has come on screen: a long grid does not ask for all of its
 * maps at once. Until it comes, the line on the dark.
 */
function DrawingCell({ drawing, size, opening, disabled, onOpen }: CellProps) {
  const place = useRef<View>(null);
  const { seen, look } = useSeen(place);
  const map = useFeedMap(
    drawing.id,
    seen ? drawing.track_preview : NO_TRACK,
    size,
    size,
    RUN_DRAWING_PAD,
    bearingOf(drawing.rotation_deg),
  );
  return (
    <Pressable
      ref={place}
      onLayout={look}
      style={({ pressed }) => [
        styles.cell,
        { width: size },
        (pressed || opening) && styles.pressed,
      ]}
      onPress={onOpen}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t("{title}, open on the map", {
        title: drawingName(drawing),
      })}
      testID="drawing-cell"
    >
      <RunDrawing
        route={drawing.track_preview}
        track={NO_TRACK}
        width={size}
        height={size}
        rotationDeg={drawing.rotation_deg}
        map={map}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  cell: {
    gap: space.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  busy: {
    opacity: 0.6,
  },
});
