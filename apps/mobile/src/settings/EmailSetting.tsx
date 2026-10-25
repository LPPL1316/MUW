import type { User } from "@shaperoute/shared-types";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, type TextInput, View } from "react-native";

import type { Account } from "../account/useAccount";
import { t } from "../i18n";
import { ContactField, contactStyles as styles } from "./ContactField";
import { checkEmailChange } from "./contactFields";
import { EmailConfirmation } from "./EmailConfirmation";

type Props = {
  user: User;
  account: Pick<Account, "changeEmail" | "email">;
};

/**
 * «Change email» in «Settings» (TASK-183, ADR-0150). A tap opens the form
 * under the row, as «Profile picture» opens its choices: the new address
 * and the password of the account. Saved, the form closes and the account
 * above shows the new address; what goes wrong is said under «Save», and
 * the fields keep what was written. From a server that sends email
 * (TASK-300) the new address waits for its link instead, and under the row
 * `EmailConfirmation` says so, as it says an address not confirmed yet.
 */
export function EmailSetting({ user, account }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // A second tap while the first is on its way sends nothing.
  const savingNow = useRef(false);
  const passwordField = useRef<TextInput>(null);
  // The address just asked for in this form, while it waits.
  const [asked, setAsked] = useState<string | null>(null);
  const checkEmail = account.email?.check;
  useEffect(() => {
    checkEmail?.();
  }, [checkEmail]);

  function close() {
    setOpen(false);
    // No password left in a form nobody looks at.
    setEmail("");
    setPassword("");
    setProblem(null);
  }

  async function save() {
    if (savingNow.current) {
      return;
    }
    const checked = checkEmailChange({ email, password }, user);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    savingNow.current = true;
    setSaving(true);
    setProblem(null);
    const failed = await account.changeEmail(checked.request);
    savingNow.current = false;
    setSaving(false);
    if (failed === null) {
      setAsked(checked.request.email.toLowerCase());
      close();
    } else {
      setProblem(failed);
    }
  }

  return (
    <View style={styles.menu}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => (open ? close() : setOpen(true))}
        disabled={saving}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={t("Change email")}
        accessibilityState={{ expanded: open, disabled: saving }}
      >
        <Text style={styles.emoji}>✉️</Text>
        <Text style={styles.rowText}>{t("Change email")}</Text>
      </Pressable>
      {account.email !== undefined && (
        <EmailConfirmation
          user={user}
          email={account.email}
          justChanged={asked !== null && asked === user.pending_email}
        />
      )}
      {open && (
        <View>
          <View style={styles.divider} />
          <View style={styles.form}>
            <ContactField
              label={t("NEW EMAIL")}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordField.current?.focus()}
            />
            <ContactField
              ref={passwordField}
              label={t("PASSWORD")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void save()}
            />
            <Pressable
              style={[styles.button, saving && styles.busy]}
              onPress={() => void save()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              <Text style={styles.buttonText}>{t(saving ? "Saving…" : "Save")}</Text>
            </Pressable>
            {problem !== null && <Text style={styles.problem}>{problem}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}
