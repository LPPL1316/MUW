import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { ContactField } from "../settings/ContactField";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

type Props = {
  /** What «Log in» had in its email field, to start from. */
  email: string;
  /** POST /password-reset: null once asked, or what went wrong, in words. */
  askReset: (email: string) => Promise<string | null>;
  onBack: () => void;
};

/**
 * «Forgot password?» under «Log in» (TASK-300, ADR-0261): the email of the
 * account, and a link to choose a new password sent there. What it says
 * once asked is the same whoever has the address: the API does not tell,
 * and neither does the app. The link opens a page of the API, in the
 * browser: the app has no link of its own yet.
 */
export function ForgotPassword({ email: written, askReset, onBack }: Props) {
  const [email, setEmail] = useState(written);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // A second tap while the first is on its way sends nothing.
  const sendingNow = useRef(false);

  async function send() {
    if (sendingNow.current) {
      return;
    }
    sendingNow.current = true;
    setSending(true);
    setProblem(null);
    const failed = await askReset(email);
    sendingNow.current = false;
    setSending(false);
    if (failed === null) {
      setSent(true);
    } else {
      setProblem(failed);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{t("Forgot password?")}</Text>
      {sent ? (
        <Text style={styles.text}>
          {t(
            "If an account has this email, a link is on its way. It works for 1 hour; look in spam too.",
          )}
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            {t(
              "Write the email of your account: we send it a link to choose a new password.",
            )}
          </Text>
          <ContactField
            label={t("EMAIL")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("name@example.com")}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
          />
          <Pressable
            style={[styles.button, sending && styles.busy]}
            onPress={() => void send()}
            disabled={sending}
            accessibilityRole="button"
            accessibilityState={{ disabled: sending, busy: sending }}
            testID="reset-send"
          >
            <Text style={styles.buttonText}>
              {t(sending ? "Sending…" : "Send the link")}
            </Text>
          </Pressable>
          {problem !== null && <Text style={styles.problem}>{problem}</Text>}
        </>
      )}
      <Pressable
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        onPress={onBack}
        accessibilityRole="button"
      >
        <Text style={styles.backText}>{t("Back to Log in")}</Text>
      </Pressable>
    </View>
  );
}

// As «Log in» (./SignInScreen).
const styles = StyleSheet.create({
  form: {
    gap: space.lg,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  text: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  // Not yellow: that is the route's (docs/UI.md, «Il tema»).
  button: {
    minHeight: MIN_TAP_SIZE,
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
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
  back: {
    minHeight: MIN_TAP_SIZE,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  backText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textDecorationLine: "underline",
  },
});
