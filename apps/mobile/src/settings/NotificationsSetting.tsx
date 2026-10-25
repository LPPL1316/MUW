import type { Notifications, User } from "@shaperoute/shared-types";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Account } from "../account/useAccount";
import { t, tLater } from "../i18n";
import { askPushPermission } from "../notifications/pushDevice";
import { OpenSettings } from "../permissions/OpenSettings";
import { color, fontSize, radius, space } from "../theme/tokens";
import { contactStyles } from "./ContactField";
import { notificationsOf, PUSH_NOT_ALLOWED } from "./notificationFields";

type Props = {
  user: User;
  account: Pick<Account, "changeNotifications">;
};

type Which = keyof Notifications;

/** The switches, in the order of the page; the names shown with `t()`. */
const SWITCHES: { which: Which; emoji: string; name: string }[] = [
  { which: "email", emoji: "📧", name: tLater("Email notifications") },
  { which: "push", emoji: "🔔", name: tLater("Push notifications") },
  { which: "away", emoji: "👋", name: tLater("Email when I'm away") },
];

/**
 * «NOTIFICATIONS» in «Settings» (TASK-185, ADR-0206): «Email notifications»
 * and «Push notifications», each a switch kept in the account, both off
 * until turned on, and «Email when I'm away» (TASK-284, ADR-0244), on until
 * turned off. Turning «Push notifications» on asks the phone for its
 * permission, here and nowhere else (TASK-262, ADR-0226); refused, the
 * switch stays off and says where to allow it. With the switch on the phone
 * gets push notifications (`../notifications/usePushNotifications`); the
 * emails come from the API, and the note under the rows says what each
 * sends. A switch shows
 * its new value at once and goes back if the phone or the API refuses, with
 * the reason under the rows; while one answer is on its way, a second tap
 * sends nothing.
 */
export function NotificationsSetting({ user, account }: Props) {
  const kept = notificationsOf(user);
  // The switch tapped, as it will be once the API has kept it.
  const [sending, setSending] = useState<{ which: Which; on: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The phone refused notifications: the way to its settings, under the reason.
  const [refused, setRefused] = useState(false);
  const busyNow = useRef(false);
  const shown: Notifications =
    sending === null ? kept : { ...kept, [sending.which]: sending.on };

  async function turn(which: Which, on: boolean) {
    if (busyNow.current) {
      return;
    }
    busyNow.current = true;
    setSending({ which, on });
    setProblem(null);
    setRefused(false);
    // The phone first: a switch on with notifications refused would send
    // nothing (TASK-262).
    if (which === "push" && on && (await askPushPermission()) !== "granted") {
      busyNow.current = false;
      setSending(null);
      setProblem(t(PUSH_NOT_ALLOWED));
      setRefused(true);
      return;
    }
    // Only the switch that changes: the others stay as the API has them.
    const failed = await account.changeNotifications(
      which === "email"
        ? { email: on }
        : which === "push"
          ? { push: on }
          : { away: on },
    );
    busyNow.current = false;
    // Kept, the account has it by now; refused, the switch goes back.
    setSending(null);
    setProblem(failed);
  }

  return (
    <View style={styles.setting}>
      <View style={contactStyles.menu}>
        {SWITCHES.map(({ which, emoji, name }, at) => (
          <View key={which}>
            {at > 0 && <View style={contactStyles.divider} />}
            <Pressable
              style={({ pressed }) => [
                contactStyles.row,
                pressed && contactStyles.pressed,
              ]}
              onPress={() => void turn(which, !shown[which])}
              accessibilityRole="switch"
              // One name for the row: the emoji is not read on its own.
              accessibilityLabel={t(name)}
              accessibilityState={{
                checked: shown[which],
                busy: sending?.which === which,
              }}
            >
              <Text style={contactStyles.emoji}>{emoji}</Text>
              <Text style={contactStyles.rowText}>{t(name)}</Text>
              <View style={[styles.track, shown[which] && styles.trackOn]}>
                <View style={[styles.knob, shown[which] && styles.knobOn]} />
              </View>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        {t(
          "Push notifications tell you at once about follow requests, reactions, comments and tags. Email notifications sends the same news in one email a day at most. Email when I'm away: one email if you don't open MuW for 2 weeks.",
        )}
      </Text>
      {problem !== null && <Text style={styles.problem}>{problem}</Text>}
      {refused && (
        <View style={styles.open}>
          <OpenSettings />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // As «Offline maps» (`../engine/OfflineMapsSetting`): the rows, and a
  // small note under them.
  setting: {
    gap: space.sm,
  },
  // A switch as phones draw one, as the run's are (`RunDashboard`): the
  // knob on the right when it is on. Neutral: the yellow belongs to the
  // route (docs/UI.md, «Il tema»).
  track: {
    width: 40,
    height: 24,
    justifyContent: "center",
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  trackOn: {
    backgroundColor: color.text,
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: color.textMuted,
  },
  knobOn: {
    alignSelf: "flex-end",
    backgroundColor: color.background,
  },
  note: {
    paddingHorizontal: space.md,
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    paddingHorizontal: space.md,
    color: color.error,
    fontSize: fontSize.body,
  },
  open: {
    paddingHorizontal: space.md,
  },
});
