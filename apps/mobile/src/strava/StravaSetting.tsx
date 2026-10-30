import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { ConnectWithStrava, StravaLine } from "./StravaParts";
import { useStrava } from "./useStrava";

/**
 * «Strava» in «Settings» (TASK-187): «Connect with Strava», or who is
 * connected and «Disconnect», which asks first. Nothing when the API has
 * no Strava.
 */
export function StravaSetting() {
  const strava = useStrava();
  const { status, busy, problem } = strava;
  const [confirming, setConfirming] = useState(false);
  if (!status.available) {
    return null;
  }
  const disconnecting = busy === "disconnecting";
  return (
    <View style={styles.section}>
      <Text style={styles.label}>STRAVA</Text>
      {status.connected ? (
        <View style={styles.menu}>
          <View
            style={styles.row}
            accessible
            accessibilityLabel={
              status.athlete === null
                ? t("Strava, connected")
                : t("Strava, connected as {athlete}", { athlete: status.athlete })
            }
          >
            <Text style={styles.rowText}>
              {status.athlete === null
                ? t("Connected")
                : t("Connected as {athlete}", { athlete: status.athlete })}
            </Text>
          </View>
          <Hairline style={styles.inset} />
          {confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>
                {t("Disconnect Strava? Runs already sent stay on Strava.")}
              </Text>
              <View style={styles.buttons}>
                <Pressable
                  style={styles.button}
                  onPress={() => setConfirming(false)}
                  disabled={disconnecting}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>{t("Keep it")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.danger, disconnecting && styles.busy]}
                  onPress={() => {
                    setConfirming(false);
                    strava.disconnect();
                  }}
                  disabled={disconnecting}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, styles.dangerText]}>
                    {t("Disconnect")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.row}
              onPress={() => setConfirming(true)}
              disabled={disconnecting}
              accessibilityRole="button"
              accessibilityState={{ disabled: disconnecting, busy: disconnecting }}
            >
              <Text style={[styles.rowText, styles.dangerText]}>
                {t(disconnecting ? "Disconnecting…" : "Disconnect Strava")}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.connect}>
          <ConnectWithStrava busy={busy === "connecting"} onPress={strava.connect} />
          <StravaLine
            text={t("Send the runs you save in MuW to your Strava profile.")}
          />
        </View>
      )}
      {problem !== null && <StravaLine text={problem} alert />}
    </View>
  );
}

// The rows of «Settings» (`../profile/SettingsPage`), as SportSetting's.
const styles = StyleSheet.create({
  /** A division set in from the card's edge, as the rows' words are. */
  inset: {
    marginHorizontal: space.md,
  },
  section: {
    gap: space.lg,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  connect: {
    gap: space.sm,
  },
  confirm: {
    gap: space.md,
    padding: space.md,
  },
  confirmText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  buttons: {
    flexDirection: "row",
    gap: space.sm,
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  danger: {
    borderColor: color.error,
  },
  dangerText: {
    color: color.error,
  },
  busy: {
    opacity: 0.6,
  },
});
