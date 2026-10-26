import type { User } from "@shaperoute/shared-types";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AboutRows } from "../about/AboutRows";
import type { AboutId } from "../about/documents";
import type { Account } from "../account/useAccount";
import { apiUrl } from "../api/apiUrl";
import { OfflineMapsSetting } from "../engine/OfflineMapsSetting";
import { t } from "../i18n";
import { EmailSetting } from "../settings/EmailSetting";
import { FeedbackSetting } from "../settings/FeedbackSetting";
import { LanguageSetting } from "../settings/LanguageSetting";
import { NotificationsSetting } from "../settings/NotificationsSetting";
import { PhoneSetting } from "../settings/PhoneSetting";
import { SportSetting } from "../settings/SportSetting";
import { ToneSetting } from "../settings/ToneSetting";
import { UnitsSetting } from "../settings/UnitsSetting";
import { useFeedbackService } from "../settings/useFeedbackService";
import { StravaSetting } from "../strava/StravaSetting";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { PhotoRow } from "./PhotoRow";

type Props = {
  user: User;
  account: Account;
  /** Opens «Help», «Terms» or «Privacy» as a page of «Profile» (TASK-184). */
  onAbout: (id: AboutId) => void;
  /** Where «Send feedback» asks (TASK-308), and the fake fetch of the tests. */
  feedbackApi?: { baseUrl: string | null; fetchFn?: typeof fetch; key?: string | null };
};

/** A group of «Settings» under its name; each new setting joins one. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * «Settings» in «Profile» (TASK-177), in sections: the account with its
 * email and phone number (TASK-183) and the ways out of it, the sport
 * (TASK-189), Strava (TASK-187), the language
 * (TASK-210), the offline maps (TASK-214) and the units (TASK-182) among
 * the preferences, the two notification switches (TASK-185), «Send
 * feedback» (TASK-308) and the texts of «ABOUT» (TASK-184). Every row
 * works: none says «Soon» any more.
 * «Delete account» asks first, on the screen (ADR-0120: the API does not).
 */
export function SettingsPage({
  user,
  account,
  onAbout,
  feedbackApi = { baseUrl: apiUrl() },
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const { baseUrl: feedbackUrl, fetchFn, key } = feedbackApi;
  // Only on a server that takes it: an older one answers 404 (TASK-308).
  const takesFeedback = useFeedbackService(feedbackUrl, { fetchFn, key });
  const deleting = account.busy === "delete";
  return (
    <View style={styles.page}>
      <Section label={t("ACCOUNT")}>
        <View style={styles.card}>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <PhotoRow name={user.username} />
        <EmailSetting user={user} account={account} />
        <PhoneSetting user={user} account={account} />
      </Section>
      <SportSetting />
      <StravaSetting />
      <Section label={t("PREFERENCES")}>
        <LanguageSetting />
        <OfflineMapsSetting />
        <UnitsSetting />
        <ToneSetting />
      </Section>
      {/* Kept in the account; nothing is sent yet (TASK-185). */}
      <Section label={t("NOTIFICATIONS")}>
        <NotificationsSetting user={user} account={account} />
      </Section>
      {/* A message to whoever runs MuW, kept and emailed (TASK-308). */}
      {takesFeedback && (
        <Section label={t("FEEDBACK")}>
          <FeedbackSetting
            account={account}
            baseUrl={feedbackUrl}
            options={{ fetchFn, key }}
          />
        </Section>
      )}
      {/* The guide and the two legal texts, each on its own page (TASK-184). */}
      <Section label={t("ABOUT")}>
        <AboutRows onOpen={onAbout} />
      </Section>
      {/* The ways out of the account, last. */}
      <View style={styles.section}>
        <Pressable
          style={styles.button}
          onPress={account.signOut}
          disabled={deleting}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t("Log out")}</Text>
        </Pressable>
        {confirming ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              {t(
                "Delete your account? Everything that is yours goes with it, at once. It cannot be undone.",
              )}
            </Text>
            <Pressable
              style={[styles.button, styles.danger, deleting && styles.busy]}
              onPress={account.deleteAccount}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityState={{ disabled: deleting, busy: deleting }}
            >
              <Text style={[styles.buttonText, styles.dangerText]}>
                {t(deleting ? "Deleting…" : "Delete my account")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                setConfirming(false);
                account.clearProblem();
              }}
              disabled={deleting}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{t("Keep my account")}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.quiet}
            onPress={() => setConfirming(true)}
            accessibilityRole="button"
          >
            <Text style={styles.dangerText}>{t("Delete account")}</Text>
          </Pressable>
        )}
        {account.problem && <Text style={styles.problem}>{account.problem}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: space.xl,
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
  card: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  username: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  email: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  // Neutral: the yellow belongs to the route (docs/UI.md, «Il tema»).
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  quiet: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  confirm: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.error,
    backgroundColor: color.surface,
  },
  confirmText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  danger: {
    borderColor: color.error,
  },
  dangerText: {
    color: color.error,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  busy: {
    opacity: 0.6,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
});
