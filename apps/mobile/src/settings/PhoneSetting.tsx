import type { User } from "@shaperoute/shared-types";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { Account } from "../account/useAccount";
import { t } from "../i18n";
import { Tap } from "../ui/Tap";
import { ContactField, contactStyles as styles } from "./ContactField";
import { checkPhone, phoneOfUser } from "./contactFields";

type Props = {
  user: User;
  account: Pick<Account, "changePhone">;
};

/** The request on its way, so a second tap does not send it again. */
type Busy = "save" | "remove" | null;

/**
 * «Phone number» in «Settings» (TASK-183, ADR-0150): the number of the
 * account at the end of the row, or «Add» without one. A tap opens the
 * form under the row: the number with its country code, what it is for,
 * «Save», and «Remove number» when the account has one. Saved, the form
 * closes and the row shows the number as the API keeps it.
 */
export function PhoneSetting({ user, account }: Props) {
  const kept = phoneOfUser(user);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(kept ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const busyNow = useRef(false);

  function toggle() {
    // Each opening starts from the number the account has now.
    setPhone(kept ?? "");
    setProblem(null);
    setOpen(!open);
  }

  async function send(kind: Exclude<Busy, null>, written: string) {
    if (busyNow.current) {
      return;
    }
    const checked = checkPhone(written);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    // Nothing to ask: the account already has it, or already has none.
    if (checked.request.phone === kept) {
      setOpen(false);
      return;
    }
    busyNow.current = true;
    setBusy(kind);
    setProblem(null);
    const failed = await account.changePhone(checked.request);
    busyNow.current = false;
    setBusy(null);
    if (failed === null) {
      setOpen(false);
    } else {
      setProblem(failed);
    }
  }

  const value = kept ?? t("Add");
  return (
    <View style={styles.menu}>
      <Tap
        style={styles.row}
        onPress={toggle}
        disabled={busy !== null}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={`${t("Phone number")}, ${value}`}
        accessibilityState={{ expanded: open, disabled: busy !== null }}
      >
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.rowText}>{t("Phone number")}</Text>
        <Text style={styles.value}>{value}</Text>
      </Tap>
      {open && (
        <View>
          <View style={styles.divider} />
          <View style={styles.form}>
            <ContactField
              label={t("PHONE NUMBER")}
              value={phone}
              onChangeText={setPhone}
              placeholder="+39 333 123 4567"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            <Text style={styles.note}>
              {t(
                "Only you see your number. Friends who already have it will be able to find you on MuW.",
              )}
            </Text>
            <Pressable
              style={[styles.button, busy !== null && styles.busy]}
              onPress={() => void send("save", phone)}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy !== null, busy: busy === "save" }}
            >
              <Text style={styles.buttonText}>
                {t(busy === "save" ? "Saving…" : "Save")}
              </Text>
            </Pressable>
            {kept !== null && (
              <Pressable
                style={styles.quiet}
                onPress={() => void send("remove", "")}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: busy !== null,
                  busy: busy === "remove",
                }}
              >
                <Text style={styles.quietText}>
                  {t(busy === "remove" ? "Removing…" : "Remove number")}
                </Text>
              </Pressable>
            )}
            {problem !== null && <Text style={styles.problem}>{problem}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}
