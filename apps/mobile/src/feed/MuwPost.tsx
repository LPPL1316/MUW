import type { MuwRoute } from "@shaperoute/shared-types";
import { Image, StyleSheet, Text, View } from "react-native";

import { cityName } from "../explore/recommendedRoutes";
import { RouteThumb } from "../explore/RouteThumb";
import { t } from "../i18n";
import { appLanguage } from "../i18n/language";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { muwLabel, muwTitle } from "./muwLabel";

const FEET_IN_A_METRE = 3.28084;

/** The sport of the route, with its emoji, in the app's words. */
function sport(activity: string): string {
  switch (activity) {
    case "running":
      return `🏃‍♂️ ${t("Run")}`;
    case "paddling":
      return `🛶 ${t("Paddle")}`;
    default:
      return `🚴 ${t("Bike")}`;
  }
}

type Props = {
  route: MuwRoute;
  /** How wide the card is, as a post. */
  width: number;
  /** Opens the route on the map, to start it. */
  onOpen: (route: MuwRoute) => void;
};

/**
 * A route MuW drew, between the posts of «Feed» (TASK-365, ADR-0310): MuW's
 * logo and name where a runner's would be, the approved label always under
 * it, the figure, its title and what it asks of the legs. Nothing of a run:
 * no person, date, time, pace, score, reactions or comments, because nobody
 * ran it. The climb is an estimate. A tap opens the route.
 */
export function MuwPost({ route, width, onOpen }: Props) {
  const units = useUnits();
  const label = muwLabel(route.activity);
  const title = muwTitle(route, appLanguage());
  const climb =
    units === "mi"
      ? `↑ ${Math.round(route.climb_m * FEET_IN_A_METRE)} ft`
      : `↑ ${route.climb_m} m`;
  const facts = [sport(route.activity), distanceLabel(route.route_m, units)];
  if (route.activity !== "paddling") {
    facts.push(climb);
  }
  const thumb = width - 2 * space.md;
  return (
    <Tap
      style={styles.card}
      onPress={() => onOpen(route)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${title}, ${cityName(route.city)}. ${facts.join(", ")}.`}
      accessibilityHint={t("Opens the route on the map")}
      testID="muw-post"
    >
      <View style={styles.who}>
        <Image
          style={styles.logo}
          source={require("../../assets/icon.png")}
          accessible={false}
        />
        <View style={styles.names}>
          <Text style={styles.name}>MuW</Text>
          <Text style={styles.label} testID="muw-label">
            {label}
          </Text>
        </View>
      </View>
      <View style={styles.figure}>
        <RouteThumb
          line={route.preview}
          width={thumb}
          height={Math.round(thumb * 0.66)}
        />
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>
          {title} · {cityName(route.city)}
        </Text>
        <Text style={styles.facts}>{facts.join(" · ")}</Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  who: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
  },
  // Square, as the app's icon is: a runner's picture is round.
  logo: {
    width: MIN_TAP_SIZE - space.sm,
    height: MIN_TAP_SIZE - space.sm,
    borderRadius: radius.sm,
  },
  names: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
  figure: {
    alignItems: "center",
    paddingHorizontal: space.md,
  },
  words: {
    gap: space.xs,
    padding: space.md,
  },
  title: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  facts: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});
