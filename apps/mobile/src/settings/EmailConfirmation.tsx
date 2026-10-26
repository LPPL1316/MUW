import type { User } from "@shaperoute/shared-types";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AccountEmail } from "../account/accountEmail";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

type Props = {
  user: User;
  email: AccountEmail;
  /** The address waiting was asked for right now, in «Change email». */
  justChanged: boolean;
};

type Said = { text: string; problem: boolean };

/**
 * Under «Change email» (TASK-300, ADR-0261): an address not confirmed yet,
 * or a new one that waits for its link, with the link sent again and the
 * change dropped. Nothing is held back without it: it only says so. From a
 * server that sends these emails only; nothing to say, nothing shown.
 */
export function EmailConfirmation({ user, email, justChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  // A second tap while the first is on its way sends nothing.
  const busyNow = useRef(false);
  const pending = user.pending_email ?? null;
  if (!email.on || (pending === null && user.email_confirmed !== false)) {
    return null;
  }
  const address = pending ?? user.email;

  async function run(action: () => Promise<string | null>, done: Said | null) {
    if (busyNow.current) {
      return;
    }
    busyNow.current = true;
    setBusy(true);
    setSaid(null);
    const failed = await action();
    busyNow.current = false;
    setBusy(false);
    setSaid(failed === null ? done : { text: failed, problem: true });
  }

  const sendAgain = () =>
    void run(email.sendAgain, {
      text: t("Link sent to {email}. Look in spam too.", { email: address }),
      problem: false,
    });

  return (
    <View style={styles.box}>
      <Text style={styles.line}>
        {pending === null
          ? t("Email not confirmed")
          : justChanged
            ? t("We sent a link to {email}. Your email changes when you open it.", {
                email: pending,
              })
            : t("Waiting for {email}: open the link we sent there.", {
                email: pending,
              })}
      </Text>
      <View style={styles.buttons}>
        <Button
          label={pending === null ? t("Send the link again") : t("Send again")}
          busy={busy}
          onPress={sendAgain}
        />
        {pending !== null && (
          <Button
            label={t("Cancel change")}
            busy={busy}
            onPress={() => void run(email.cancelChange, null)}
          />
        )}
      </View>
      {said !== null && (
        <Text style={said.problem ? styles.problem : styles.said}>{said.text}</Text>
      )}
    </View>
  );
}

function Button({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.button, busy && styles.busy]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  line: {
    color: color.warning,
    fontSize: fontSize.body,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  // As «Save» of the form above (./ContactField): not yellow, the route's.
  button: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  busy: {
    opacity: 0.6,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  said: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
});
