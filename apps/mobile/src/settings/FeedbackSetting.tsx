import { MAX_FEEDBACK_LENGTH } from "@shaperoute/shared-types";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { NO_API, sessionEnded } from "../account/messages";
import type { Account } from "../account/useAccount";
import { apiUrl } from "../api/apiUrl";
import { sendFeedback } from "../api/feedback";
import { t } from "../i18n";
import { color, fontSize, radius, space } from "../theme/tokens";
import { contactStyles } from "./ContactField";
import {
  appVersion,
  checkFeedback,
  feedbackProblem,
  phoneSystem,
} from "./feedbackFields";

type Props = {
  account: Pick<Account, "state" | "sessionEnded">;
  /** The call and the address of the API: the tests' fakes. */
  send?: typeof sendFeedback;
  baseUrl?: string | null;
};

/**
 * «Send feedback» in «Settings» (TASK-308, ADR-0268). A tap opens the form
 * under the row, as «Change email» does: what the message is for, the
 * field, what goes with it, «Send». Sent, the form closes and the row
 * thanks; what goes wrong is said under «Send», and the field keeps what
 * was written. Closed without sending, the words stay for the next tap.
 */
export function FeedbackSetting({
  account,
  send = sendFeedback,
  baseUrl = apiUrl(),
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // A second tap while the first is on its way sends nothing.
  const sendingNow = useRef(false);

  function toggle() {
    setOpen(!open);
    setProblem(null);
    setSent(false);
  }

  async function submit() {
    if (sendingNow.current || account.state.status !== "signedIn") {
      return;
    }
    const checked = checkFeedback(text);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    if (baseUrl === null) {
      setProblem(t(NO_API));
      return;
    }
    const { token } = account.state.session;
    sendingNow.current = true;
    setSending(true);
    setProblem(null);
    const outcome = await send(baseUrl, token, {
      text: checked.text,
      app_version: appVersion(),
      platform: phoneSystem(),
    });
    sendingNow.current = false;
    setSending(false);
    if (outcome.kind === "ok") {
      setText("");
      setOpen(false);
      setSent(true);
    } else if (sessionEnded(outcome)) {
      account.sessionEnded(token);
    } else {
      setProblem(feedbackProblem(outcome));
    }
  }

  return (
    <View style={contactStyles.menu}>
      <Pressable
        style={({ pressed }) => [contactStyles.row, pressed && contactStyles.pressed]}
        onPress={toggle}
        disabled={sending}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={t("Send feedback")}
        accessibilityState={{ expanded: open, disabled: sending }}
      >
        <Text style={contactStyles.emoji}>💬</Text>
        <Text style={contactStyles.rowText}>{t("Send feedback")}</Text>
      </Pressable>
      {sent && !open && (
        <View style={contactStyles.form}>
          <Text style={contactStyles.note}>
            {t("Thank you! Your message reached us.")}
          </Text>
        </View>
      )}
      {open && (
        <View>
          <View style={contactStyles.divider} />
          <View style={contactStyles.form}>
            <Text style={styles.intro}>
              {t(
                "Ideas, problems, anything that would make MuW better: we read every message.",
              )}
            </Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={t("Write here…")}
              placeholderTextColor={color.textFaint}
              keyboardAppearance="dark"
              multiline
              maxLength={MAX_FEEDBACK_LENGTH}
              textAlignVertical="top"
              accessibilityLabel={t("Your message")}
            />
            <Text style={contactStyles.note}>
              {t(
                "It reaches us with your username, your email and the app's version, so we can answer you.",
              )}
            </Text>
            <Pressable
              style={[contactStyles.button, sending && contactStyles.busy]}
              onPress={() => void submit()}
              disabled={sending}
              accessibilityRole="button"
              accessibilityState={{ disabled: sending, busy: sending }}
            >
              <Text style={contactStyles.buttonText}>
                {t(sending ? "Sending…" : "Send")}
              </Text>
            </Pressable>
            {problem !== null && <Text style={contactStyles.problem}>{problem}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: color.text,
    fontSize: fontSize.body,
  },
  // As the fields of «Change email» (`./ContactField`), a few lines tall.
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.background,
  },
});
