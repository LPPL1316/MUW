import { Image, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { countLabel } from "../messages/MessagesRow";
import { TAB_ICON_SIZE } from "../tabs/TabBar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import { useBell } from "./bellDoor";

const BELL = require("../../assets/ui/tabs/bell.png");

/**
 * The bell of the header (TASK-367 part C, ADR-0311), as Instagram's heart:
 * a red number with the unread lines, and a touch opens the list. Not there
 * while there is no list to open: no account, or a server without it
 * («Aspetta la lista vera», the user's choice: never an empty page).
 */
export function BellButton() {
  const { unread, open } = useBell();
  if (unread === null) {
    return null;
  }
  return (
    <Tap
      style={styles.bell}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0
          ? t("Notifications, {count} new", { count: countLabel(unread) })
          : t("Notifications")
      }
      testID="bell"
    >
      <Image source={BELL} style={styles.icon} />
      {unread > 0 && (
        <View style={styles.count} testID="bell-count">
          <Text style={styles.countText}>{countLabel(unread)}</Text>
        </View>
      )}
    </Tap>
  );
}

// As the tabs of the bar: the same icon size, the same red number.
const styles = StyleSheet.create({
  bell: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
    tintColor: color.text,
  },
  count: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: space.xs,
    minWidth: space.lg + space.xs / 2,
    height: space.lg + space.xs / 2,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.background,
    backgroundColor: color.badge,
  },
  countText: {
    color: color.onBadge,
    fontSize: fontSize.label,
    fontWeight: fontWeight.bold,
  },
});
