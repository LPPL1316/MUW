import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import { MAP_KINDS, type MapKind, saveMapKind, useMapKind } from "./mapKind";

/** The side of a sheet of the icon, before it is laid flat. */
const SHEET = 13;
/** The thickness of its edge. */
const EDGE = 2;

function kindName(kind: MapKind): string {
  return kind === "satellite"
    ? t("Satellite")
    : kind === "3d"
      ? t("3D")
      : t("Standard");
}

/**
 * The map's kind (TASK-264, ADR-0232): a round button with two sheets laid
 * one on the other, and under it, once tapped, «Standard», «Satellite» and
 * «3D». The kind chosen shows at once on the map and stays for the next
 * opening of the app.
 */
export function MapKindButton() {
  const kind = useMapKind();
  const [open, setOpen] = useState(false);
  return (
    // Beside the button and its choices a finger is on the map.
    <View style={styles.box} pointerEvents="box-none">
      <Tap
        testID="map-kind"
        style={styles.button}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={t("Map type")}
        accessibilityValue={{ text: kindName(kind) }}
        accessibilityState={{ expanded: open }}
      >
        <Sheets />
      </Tap>
      {open && (
        <View style={styles.menu}>
          {MAP_KINDS.map((each) => {
            const chosen = each === kind;
            return (
              <Tap
                key={each}
                testID={`map-kind-${each}`}
                style={styles.option}
                onPress={() => {
                  saveMapKind(each);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
              >
                <Text style={[styles.optionText, chosen && styles.chosenText]}>
                  {kindName(each)}
                </Text>
                <Text style={styles.check}>{chosen ? "✓" : ""}</Text>
              </Tap>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Two sheets laid one on the other, drawn: the app has no icons (no react-native-svg). */
function Sheets() {
  return (
    <View style={styles.icon}>
      <View style={[styles.sheet, styles.under]} />
      <View style={[styles.sheet, styles.over]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "flex-end",
    gap: space.xs,
  },
  // As the way back and the north arrow (MapScreen, NorthArrow).
  button: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  icon: {
    width: SHEET * 1.5,
    height: SHEET * 1.5,
  },
  // A square turned and squashed: a sheet seen lying down.
  sheet: {
    position: "absolute",
    left: SHEET * 0.25,
    width: SHEET,
    height: SHEET,
    borderWidth: EDGE,
    borderColor: color.text,
    borderRadius: EDGE,
    backgroundColor: color.surfaceRaised,
    transform: [{ scaleY: 0.6 }, { rotate: "45deg" }],
  },
  under: {
    top: SHEET * 0.45,
  },
  over: {
    top: 0,
  },
  menu: {
    minWidth: 150,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  option: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  optionText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  chosenText: {
    fontWeight: fontWeight.bold,
  },
  check: {
    minWidth: fontSize.body,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
});
