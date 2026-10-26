import { type Ref, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import type { AccountEmail } from "../account/accountEmail";
import type { SignInFields, SignUpFields } from "../account/fields";
import { t, tLater } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { ForgotPassword } from "./ForgotPassword";
import { Segmented } from "./Segmented";

export type SignInMode = "signUp" | "logIn";

/** In English: shown with `t()` (TASK-210). */
const MODES = [
  { value: "signUp", label: tLater("Sign up") },
  { value: "logIn", label: tLater("Log in") },
] as const;

type Props = {
  /** The form shown first: "Log in" after a session ended. */
  initialMode: SignInMode;
  /** The request on its way, if any: the button waits. */
  busy: boolean;
  /** Why the last try failed, in words. */
  problem: string | null;
  /** Why the phone is signed out, when there is something to say. */
  notice: { text: string; tone: "warning" | "muted" } | null;
  onSignUp: (fields: SignUpFields) => void;
  onLogIn: (fields: SignInFields) => void;
  /** Another form: the last problem was the other one's. */
  onMode: () => void;
  /**
   * «Forgot password?» under «Log in» (TASK-300): the server is asked
   * whether it sends the email the first time «Log in» shows, and the link
   * is there only if it does.
   */
  email?: AccountEmail;
};

/**
 * «Sign up» and «Log in» (TASK-115): email and password, and for a new
 * account a username and «I am at least 16» (ADR-0114). The fields are
 * checked before they leave; what goes wrong is said under the button.
 * Under the boxes, what the email when away is, and the unticked box that
 * says no to it (TASK-284, ADR-0244).
 */
export function SignInScreen({
  initialMode,
  busy,
  problem,
  notice,
  onSignUp,
  onLogIn,
  onMode,
  email: emails,
}: Props) {
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [atLeast16, setAtLeast16] = useState(false);
  const [noAwayEmail, setNoAwayEmail] = useState(false);
  const usernameField = useRef<TextInput>(null);
  const passwordField = useRef<TextInput>(null);
  const signingUp = mode === "signUp";
  const [forgot, setForgot] = useState(false);
  const check = emails?.check;
  useEffect(() => {
    if (!signingUp) {
      check?.();
    }
  }, [signingUp, check]);
  const askReset = emails?.on ? emails.askReset : undefined;

  function submit() {
    if (busy) {
      return;
    }
    if (signingUp) {
      onSignUp({ email, username, password, atLeast16, noAwayEmail });
    } else {
      onLogIn({ email, password });
    }
  }

  if (forgot && askReset !== undefined) {
    return (
      <ForgotPassword
        email={email}
        askReset={askReset}
        onBack={() => setForgot(false)}
      />
    );
  }

  return (
    <View style={styles.form}>
      {notice && (
        <Text style={[styles.notice, notice.tone === "warning" && styles.warning]}>
          {notice.text}
        </Text>
      )}
      <Segmented
        options={MODES.map((each) => ({ value: each.value, label: t(each.label) }))}
        value={mode}
        onChange={(next) => {
          if (next !== mode) {
            setMode(next);
            onMode();
          }
        }}
        style={styles.modes}
      />
      <Field
        label={t("EMAIL")}
        value={email}
        onChangeText={setEmail}
        placeholder={t("name@example.com")}
        keyboardType="email-address"
        autoComplete="email"
        textContentType={signingUp ? "emailAddress" : "username"}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() =>
          (signingUp ? usernameField : passwordField).current?.focus()
        }
      />
      {signingUp && (
        <Field
          ref={usernameField}
          label={t("USERNAME")}
          value={username}
          onChangeText={setUsername}
          placeholder={t("3 to 20 letters, digits, _ or .")}
          autoComplete="username-new"
          textContentType="nickname"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordField.current?.focus()}
        />
      )}
      <Field
        ref={passwordField}
        label={t("PASSWORD")}
        value={password}
        onChangeText={setPassword}
        placeholder={signingUp ? t("At least 8 characters") : undefined}
        secureTextEntry
        autoComplete={signingUp ? "new-password" : "current-password"}
        textContentType={signingUp ? "newPassword" : "password"}
        returnKeyType={signingUp ? "next" : "go"}
        onSubmitEditing={signingUp ? undefined : submit}
      />
      {signingUp && (
        <Pressable
          style={styles.check}
          onPress={() => setAtLeast16(!atLeast16)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: atLeast16 }}
          // The tick is drawn, not read: the label says what it is.
          accessibilityLabel={t("I am at least 16")}
        >
          <View style={[styles.box, atLeast16 && styles.boxChecked]}>
            {atLeast16 && <Text style={styles.tick}>✓</Text>}
          </View>
          <Text style={styles.checkText}>{t("I am at least 16")}</Text>
        </Pressable>
      )}
      {signingUp && (
        <View style={styles.away}>
          <Text style={styles.awayText}>
            {t("If you don't open MuW for 2 weeks, we email you once with what's new.")}
          </Text>
          <Pressable
            style={styles.check}
            onPress={() => setNoAwayEmail(!noAwayEmail)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: noAwayEmail }}
            accessibilityLabel={t("Don't send me these emails")}
          >
            <View style={[styles.box, noAwayEmail && styles.boxChecked]}>
              {noAwayEmail && <Text style={styles.tick}>✓</Text>}
            </View>
            <Text style={styles.checkText}>{t("Don't send me these emails")}</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        testID="account-submit"
      >
        <Text style={styles.buttonText}>
          {signingUp
            ? t(busy ? "Signing up…" : "Sign up")
            : t(busy ? "Logging in…" : "Log in")}
        </Text>
      </Pressable>
      {problem && <Text style={styles.problem}>{problem}</Text>}
      {!signingUp && askReset !== undefined && (
        <Pressable
          style={({ pressed }) => [styles.forgot, pressed && styles.forgotPressed]}
          onPress={() => {
            setForgot(true);
            onMode();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.forgotText}>{t("Forgot password?")}</Text>
        </Pressable>
      )}
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  ref?: Ref<TextInput>;
};

/** A labelled field, dark like the rest of the app. */
function Field({ label, ref, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor={color.textFaint}
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label.toLowerCase()}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.lg,
  },
  notice: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  warning: {
    color: color.warning,
  },
  // On the screen's background the track needs a surface to show.
  modes: {
    backgroundColor: color.surface,
  },
  field: {
    gap: space.xs,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  input: {
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.surface,
  },
  check: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    alignSelf: "flex-start",
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm / 2,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: color.surfaceRaised,
    borderColor: color.text,
  },
  tick: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
  checkText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  away: {
    gap: space.xs,
  },
  awayText: {
    color: color.textMuted,
    fontSize: fontSize.small,
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
  buttonBusy: {
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
  forgot: {
    minHeight: MIN_TAP_SIZE,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  forgotPressed: {
    opacity: 0.6,
  },
  forgotText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textDecorationLine: "underline",
  },
});
