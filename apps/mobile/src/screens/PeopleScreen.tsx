import type { Person } from "@shaperoute/shared-types";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Account } from "../account/useAccount";
import { t } from "../i18n";
import { UserProfilePage } from "../profile/UserProfilePage";
import { ContactsFriends } from "../social/ContactsFriends";
import { PeopleSearch } from "../social/PeopleSearch";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

type Props = {
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  account: Pick<Account, "state" | "sessionEnded">;
  /** Back to «Feed», as it was left. */
  onBack: () => void;
  /**
   * A member whose profile it opens on, with no search: one touched in the
   * lists of «Profile» (TASK-211). Back from it is `onBack`.
   */
  first?: Person | null;
  /** Behind a drawing opened from a profile: kept, with what was typed. */
  hidden?: boolean;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Find friends» (TASK-215), over the app as «Profile» is: the members
 * found by name, and the profile of the one touched, read only
 * (`UserProfilePage`, TASK-116). Back from a profile goes to the names
 * found, which stay as they were; back from them goes to «Feed». Opened
 * on a member of the lists of «Profile» (TASK-211), it is that profile
 * alone, and back goes to «Profile».
 */
export function PeopleScreen({
  apiUrl,
  account,
  onBack,
  first = null,
  hidden = false,
  fetchFn,
  apiKey,
}: Props) {
  const insets = useSafeAreaInsets();
  const [person, setPerson] = useState<Person | null>(first);
  // With the search under it, back from a profile goes to the names found.
  const toNames = person !== null && first === null;
  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, styles.screen, hidden && styles.hidden]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.lg,
            paddingBottom: insets.bottom + space.xl,
          },
        ]}
        // A name touched with the keyboard open opens at the first touch.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.titleRow}>
          <Pressable
            style={styles.back}
            onPress={toNames ? () => setPerson(null) : onBack}
            accessibilityRole="button"
            accessibilityLabel={t("Back")}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {person !== null ? t("Profile") : t("Find friends")}
          </Text>
        </View>
        {/* Kept while a profile is open: back finds the names as they were. */}
        {first === null && (
          <View style={[styles.finds, person !== null && styles.hidden]}>
            <PeopleSearch
              apiUrl={apiUrl}
              account={account}
              onPick={setPerson}
              fetchFn={fetchFn}
              apiKey={apiKey}
            />
            {/* TASK-262 C: the friends whose number is in the contacts. */}
            <ContactsFriends
              apiUrl={apiUrl}
              account={account}
              onPick={setPerson}
              fetchFn={fetchFn}
              apiKey={apiKey}
            />
          </View>
        )}
        {person !== null && (
          <UserProfilePage
            apiUrl={apiUrl}
            account={account}
            publicId={person.public_id}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  hidden: {
    display: "none",
  },
  finds: {
    gap: space.xl,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  // As the title of «Profile» (ProfileScreen.tsx).
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
});
