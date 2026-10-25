import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { t, tLater } from "../i18n";

import { shapeName } from "../i18n/shapeNames";
import type { Place } from "../places/photon";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { EXAMPLE_DISTANCE_M, type Example, shownExamples } from "./exampleRoutes";
import { cityShort } from "./presets";
import type { RecommendedRoute } from "./recommendedRoutes";
import { CardMapsCredit, cardWidth, RouteCard } from "./RouteCard";

type Props = {
  city: Place;
  examples: Example[];
  onOpen: (route: RecommendedRoute) => void;
  onRetry: () => void;
  /** How wide the section is; without it, the window less the page's margins. */
  width?: number;
};

const STATUS: Record<"waiting" | "drawing", string> = {
  waiting: tLater("Next"),
  drawing: tLater("Drawing…"),
};

/**
 * Examples for a city without recommended routes (TASK-143): one card per
 * shape, filled when its route arrives; a ready one opens on the map. After
 * the first shapes come others, a card each from its turn on (TASK-176).
 */
export function CityExamples({ city, examples, onOpen, onRetry, width }: Props) {
  const window = useWindowDimensions();
  // The cards are written again when «Settings» changes the units (TASK-182).
  const units = useUnits();
  // Two cards side by side inside the section, as in «Best near you».
  const card = cardWidth((width ?? window.width - 2 * space.lg) - 2 * space.md);
  const shown = shownExamples(examples);
  const failed = shown.filter((e) => e.status === "failed");
  const messages = Array.from(new Set(failed.map((e) => e.message)));
  // Something is still to draw, the other shapes too: the note says to wait.
  const coming = examples.some((e) => e.status === "waiting" || e.status === "drawing");
  // The distance the examples are asked at: "5 km"; with «Miles», "3.1 mi".
  const asked =
    units === "mi"
      ? distanceLabel(EXAMPLE_DISTANCE_M, "mi")
      : `${EXAMPLE_DISTANCE_M / 1000} km`;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        {t("EXAMPLES IN {city}", { city: cityShort(city.label).toUpperCase() })}
      </Text>
      <Text style={styles.note}>
        {t(
          "No recommended routes here yet: shapes of {distance} from the centre, drawn now.",
          {
            distance: asked,
          },
        )}
        {coming ? ` ${t("Three first, more while you choose.")}` : ""}
      </Text>
      <View style={styles.grid}>
        {shown.map((example) => {
          const name = shapeName(example.shape);
          if (example.status === "ready") {
            const { route } = example;
            const distance = distanceLabel(route.route_m, units);
            return (
              <RouteCard
                key={example.shape}
                width={card}
                line={route.preview}
                rotationDeg={route.rotation_deg}
                title={`${name} · ${distance}`}
                detail={route.city}
                match={route.similarity}
                map
                onPress={() => onOpen(route)}
                accessibilityLabel={`${name}, ${distance}`}
              />
            );
          }
          return (
            <RouteCard
              key={example.shape}
              width={card}
              line={null}
              title={name}
              detail={
                example.status === "failed" ? t("Not drawn") : t(STATUS[example.status])
              }
            />
          );
        })}
      </View>
      {examples.some((e) => e.status === "ready") && <CardMapsCredit />}
      {messages.map((message) => (
        <Text key={message} style={styles.error}>
          {message}
        </Text>
      ))}
      {failed.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>{t("Try again")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  error: {
    color: color.error,
    fontSize: fontSize.small,
  },
  // As the cards of "Best near you", inside the section.
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
  pressed: {
    opacity: 0.6,
  },
  retry: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  retryText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
