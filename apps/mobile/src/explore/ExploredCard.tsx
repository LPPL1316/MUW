import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { MoveShape } from "../paddle/MoveShape";
import type { MoveExample } from "../paddle/useMoveExample";
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
import { PenSplit } from "../route/RoutePanel";
import { RouteTiles } from "../route/RouteTiles";
import type { ExportState } from "../route/useGpxExport";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import type { Explored } from "./explored";
import { kmOrMiles } from "./ExploreScreen";
import { ExploreStart } from "./ExploreStart";
import { cityName, routeTitle } from "./recommendedRoutes";
import type { StartView } from "./useStartDirections";

type Props = {
  explored: Explored;
  exporting: ExportState;
  onExport: () => void;
  onList: () => void;
  /** Turn-by-turn along it, the directions asked for first (TASK-145). */
  start: StartView;
  onStart: () => void;
  /** An example on the water that says where its shape is (TASK-244):
   * «Move the shape» lets the user drag it on the map, as in «Draw». */
  move?: MoveExample;
  /** «Draw it near me» (TASK-313): its shape or word chosen in «Draw»;
   * without it, a figure «Draw» cannot choose, there is no button. */
  onDrawAgain?: () => void;
  /** «Edit the drawing» (TASK-320): its figure on the map of «Draw on the
   * map» (TASK-331); without it, an emoji or a figure that is no drawing,
   * there is no button. */
  onEditDrawing?: () => void;
};

/**
 * Under the map: a route of "Explore", to run, look at and export (TASK-126).
 * The distance is the large light number, the actions come after a hairline
 * and answer the finger through `Tap` (TASK-339, ADR-0293).
 */
export function ExploredCard({
  explored,
  exporting,
  onExport,
  onList,
  start,
  onStart,
  move,
  onDrawAgain,
  onEditDrawing,
}: Props) {
  const { route } = explored;
  const title = routeTitle(route);
  // Written again when «Settings» changes the units (TASK-182); with a
  // point, as the texts here, still in English.
  const units = useUnits();
  // The finger has the shape: what to do, and the way out.
  if (move?.moving) {
    return <MoveShape onCancel={move.cancel} />;
  }
  // The moved route is being drawn: nothing to start or export meanwhile.
  const open = explored.status === "done" && !move?.waiting ? explored : null;
  return (
    <View style={styles.panel}>
      <View>
        <Text style={styles.result}>{distanceLabel(route.route_m, units)}</Text>
        <Text style={styles.target}>
          {t("{title} · {city} · looks {percent}% like it", {
            title,
            city: cityName(route.city),
            percent: Math.round(route.similarity * 100),
          })}
        </Text>
        {/* A word with the pen up: its letters and the walks between them,
            as «Draw» says it (TASK-279). */}
        {open !== null && open.result.word != null && (
          <PenSplit
            result={open.result}
            activity={open.request.activity}
            units={units}
          />
        )}
      </View>
      {explored.status === "loading" && (
        <Text style={styles.target}>{t("Loading the route…")}</Text>
      )}
      {explored.status === "failed" && (
        <Text style={styles.error}>{t("The route could not load. Try again.")}</Text>
      )}
      {move?.waiting && (
        // As «Draw» says it while it draws.
        <Text style={styles.target}>
          {t("Drawing a {distance} {title}…", {
            distance: kmOrMiles(route.distance_m, units),
            title,
          })}
        </Text>
      )}
      {open !== null && move?.elsewhere && (
        <Text style={styles.target}>
          {t("The shape does not fit there: this is the nearest place.")}
        </Text>
      )}
      {open !== null && move?.problem != null && (
        <Text style={styles.error}>{move.problem}</Text>
      )}
      {/* A city's example with the API's alternatives: A · B · C (TASK-151). */}
      {open !== null && (
        <RouteTiles
          choices={open.choices}
          chosen={open.chosen}
          // The directions being asked for are those of the route chosen.
          onChoose={start.status === "loading" ? keepChoice : open.choose}
        />
      )}
      {/* The actions, after a hairline. */}
      <Hairline />
      {open !== null && <ExploreStart start={start} onStart={onStart} />}
      {open !== null && onDrawAgain !== undefined && (
        <Tap style={styles.secondary} onPress={onDrawAgain} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t("Draw it near me")}</Text>
        </Tap>
      )}
      {open !== null && move?.available && (
        <Tap style={styles.secondary} onPress={move.begin} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t("Move the shape")}</Text>
        </Tap>
      )}
      {open !== null && (
        <Tap
          style={styles.secondary}
          onPress={onExport}
          disabled={exporting.status === "preparing"}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>
            {exporting.status === "preparing" ? t("Preparing GPX…") : t("Export GPX")}
          </Text>
        </Tap>
      )}
      {exporting.status === "failed" && (
        <Text style={styles.error}>{t("The GPX could not be made. Try again.")}</Text>
      )}
      {/* After «Start», «Draw it near me» and «Export GPX», which stay put. */}
      {open !== null && onEditDrawing !== undefined && (
        <Tap
          style={styles.secondary}
          onPress={onEditDrawing}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{t("Edit the drawing")}</Text>
        </Tap>
      )}
      <Tap style={styles.secondary} onPress={onList} accessibilityRole="button">
        <Text style={styles.secondaryText}>{t("Back to the list")}</Text>
      </Tap>
    </View>
  );
}

function keepChoice(): void {}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
  },
  // The number people look for: large and light, its digits lined up.
  result: {
    ...font.display,
    fontVariant: ["tabular-nums"],
    color: color.text,
  },
  target: {
    ...font.small,
    color: color.textMuted,
  },
  error: {
    ...font.small,
    color: color.error,
  },
  secondary: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  secondaryText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
