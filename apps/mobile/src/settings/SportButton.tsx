import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { saveSport, type Sport, SPORTS, type SportOption } from "./sport";
import { useSport } from "./useSport";

type Props = {
  /** The sports of the menu; the app's own unless a test says otherwise. */
  sports?: readonly SportOption[];
};

/** Where the menu hangs, in the window: its top, and its right edge's gap
 * from the window's right edge. */
type Anchor = { top: number; right: number };

/**
 * The sport, at the left of the way to «Profile» (TASK-205, ADR-0165): the
 * emoji of the one chosen, and a tap opens the menu of «Settings»' sports
 * under it. The choice is the one of «Settings» (saveSport), so the two
 * always agree and «Draw» follows at once; a sport not ready says «Soon».
 */
export function SportButton({ sports = SPORTS }: Props) {
  const sport = useSport();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const button = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const current = sports.find((option) => option.id === sport) ?? sports[0];

  function openMenu() {
    button.current?.measureInWindow((x, y, w, h) =>
      setAnchor({ top: y + h + space.xs, right: width - x - w }),
    );
    setOpen(true);
  }

  function choose(chosen: Sport) {
    saveSport(chosen);
    setOpen(false);
  }

  // Until the button says where it is: where the header of the pages puts it.
  const hang = anchor ?? {
    top: insets.top + space.sm + MIN_TAP_SIZE + space.xs,
    right: space.lg + MIN_TAP_SIZE + space.sm,
  };

  return (
    <>
      <Pressable
        ref={button}
        style={styles.button}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={t("Sport, {sport}", { sport: t(current.name) })}
        accessibilityHint={t("Changes the sport")}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.buttonEmoji}>{current.emoji}</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* A tap anywhere else closes the menu and changes nothing. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t("Close")}
        />
        <View
          style={[styles.menu, hang]}
          accessibilityRole="radiogroup"
          accessibilityLabel={t("Sport")}
        >
          {sports.map((option, at) => (
            <View key={option.id}>
              {at > 0 && <Hairline style={styles.inset} />}
              {option.ready ? (
                <Pressable
                  style={styles.row}
                  onPress={() => choose(option.id)}
                  accessibilityRole="radio"
                  // One name for the row: the emoji is not read on its own.
                  accessibilityLabel={t(option.name)}
                  accessibilityState={{ checked: option.id === sport }}
                >
                  <Text style={styles.emoji}>{option.emoji}</Text>
                  <Text style={styles.rowText}>{t(option.name)}</Text>
                  {option.id === sport && <Text style={styles.check}>✓</Text>}
                </Pressable>
              ) : (
                <View
                  style={styles.row}
                  accessible
                  accessibilityLabel={t("{sport}, coming soon", {
                    sport: t(option.name),
                  })}
                >
                  <Text style={styles.emoji}>{option.emoji}</Text>
                  <Text style={styles.rowText}>{t(option.name)}</Text>
                  <Text style={styles.soon}>{t("Soon")}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </Modal>
    </>
  );
}

// The button as the one of «Profile» (`../screens/ProfileLayer`), the rows as
// those of «Sport» in «Settings» (`./SportSetting`).
const styles = StyleSheet.create({
  /** A division set in from the card's edge, as the rows' words are. */
  inset: {
    marginHorizontal: space.md,
  },
  // Neutral, as every control that is not the route's (docs/UI.md, «Il tema»).
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
  buttonEmoji: {
    fontSize: fontSize.input + space.xs,
  },
  menu: {
    position: "absolute",
    minWidth: 192,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  emoji: {
    fontSize: fontSize.input + space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  // Not yellow: the yellow belongs to the route (docs/UI.md, «Il tema»).
  check: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  soon: {
    color: color.textFaint,
    fontSize: fontSize.small,
  },
});
