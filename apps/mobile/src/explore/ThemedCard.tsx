import {
  type LatLon,
  type RouteResult,
  type Shape,
  SHAPES,
} from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";
import { t } from "../i18n";
import { shapeWord } from "../i18n/shapeNames";

import type { ExportState } from "../route/useGpxExport";
import type { AnyRouteRequest } from "../route/useRouteRequest";
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
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { ExploreStart } from "./ExploreStart";
import { StopPhotos } from "./StopPhotos";
import type { ThemedResult } from "./themedRoutes";
import type { StartView } from "./useStartDirections";
import type { ThemedState } from "./useThemedRoute";

function isShape(value: string): value is Shape {
  return (SHAPES as readonly string[]).includes(value);
}

/** The request and result a drawn route has: what the GPX export sends. */
export function themedGpx(
  result: ThemedResult,
): { request: AnyRouteRequest; result: RouteResult } | null {
  if (!isShape(result.shape)) {
    return null;
  }
  return {
    request: {
      start: result.points[0],
      shape: result.shape,
      distance_m: result.target_m,
      activity: "running",
    },
    result: {
      points: result.points,
      distance_m: result.distance_m,
      similarity: result.similarity,
      shape: result.shape,
      warnings: [],
      // Planned without turn-by-turn: Start asks for them (TASK-145).
      directions: [],
    },
  };
}

/** "Passes by 3 of 5 places", or why none. */
export function passedText(result: ThemedResult): string {
  const passed = result.stops.filter((s) => s.passed).length;
  const found = result.stops.length;
  if (passed === 0) {
    return t(
      "It passes by none of the {found} {theme} found: the shape did not fit near them.",
      {
        found,
        theme: result.theme_label,
      },
    );
  }
  return t("Passes by {passed} of the {found} {theme} found:", {
    passed,
    found,
    theme: result.theme_label,
  });
}

type Props = {
  state: ThemedState;
  exporting: ExportState;
  onExport: () => void;
  onCancel: () => void;
  /** Turn-by-turn along it, the directions asked for first (TASK-145). */
  start: StartView;
  onStart: () => void;
  /**
   * On one of our ideas far from the start: the same words asked from the
   * start, the yellow button in the place of «Start». Without it, «Start».
   */
  onNearMe?: () => void;
  /** Where the places' photos are read from (TASK-329): none without. */
  apiUrl?: string | null;
  /** A tap on a place's photo: the map goes there. */
  onPlace?: (point: LatLon) => void;
};

/**
 * Under the map: a shape through the places of a theme (TASK-129). The
 * distance is the large light number, the actions come after a hairline
 * and answer the finger through `Tap` (TASK-339, ADR-0293).
 */
export function ThemedCard({
  state,
  exporting,
  onExport,
  onCancel,
  start,
  onStart,
  onNearMe,
  apiUrl = null,
  onPlace,
}: Props) {
  // Written again when «Settings» changes the units (TASK-182); with a
  // point, as the texts here, still in English.
  const units = useUnits();
  if (state.status === "idle") {
    return null;
  }
  if (state.status === "waiting") {
    return (
      <View style={styles.panel}>
        <Text style={styles.body}>
          {t(
            "Finding the places and drawing the shape through them… This can take a minute.",
          )}
        </Text>
        <Tap style={styles.secondary} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t("Cancel")}</Text>
        </Tap>
      </View>
    );
  }
  if (state.status === "failed") {
    return (
      <View style={styles.panel}>
        <Text style={styles.error}>{state.message}</Text>
        <Tap style={styles.secondary} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t("Back to Explore")}</Text>
        </Tap>
      </View>
    );
  }
  const { result, idea } = state;
  return (
    <View style={styles.panel}>
      <View>
        <Text style={styles.result}>{distanceLabel(result.distance_m, units)}</Text>
        <Text style={styles.target}>
          {t("{title} · {city} · looks {percent}% like it", {
            title: shapeWord(result.shape),
            // An idea's city in the app's language: «Roma».
            city: idea !== undefined ? t(idea.city) : (result.city ?? t("here")),
            percent: Math.round(result.similarity * 100),
          })}
        </Text>
      </View>
      <Text style={styles.body}>{passedText(result)}</Text>
      {/* The places passed by, numbered as on the map, with their photos. */}
      <StopPhotos stops={result.stops} apiUrl={apiUrl} onPlace={onPlace} />
      {/* The actions, after a hairline. */}
      <Hairline />
      {onNearMe !== undefined ? (
        <Tap style={styles.nearMe} onPress={onNearMe} accessibilityRole="button">
          <Text style={styles.nearMeText}>{t("Make it near me")}</Text>
        </Tap>
      ) : (
        <ExploreStart start={start} onStart={onStart} />
      )}
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
      {exporting.status === "failed" && (
        <Text style={styles.error}>{t("The GPX could not be made. Try again.")}</Text>
      )}
      <Tap style={styles.secondary} onPress={onCancel} accessibilityRole="button">
        <Text style={styles.secondaryText}>{t("Back to Explore")}</Text>
      </Tap>
    </View>
  );
}

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
  body: {
    ...font.body,
    color: color.text,
  },
  error: {
    ...font.body,
    color: color.error,
  },
  // Yellow as «Start», whose place it takes: it produces a route.
  nearMe: {
    minHeight: MIN_TAP_SIZE + space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  // Dark on yellow: white does not reach the contrast minimum (ADR-0046).
  nearMeText: {
    color: color.onAccent,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.input,
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
