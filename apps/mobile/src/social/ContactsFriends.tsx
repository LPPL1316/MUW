import type { ContactPerson, FollowState, Person } from "@shaperoute/shared-types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { accountProblem, sessionEnded } from "../account/messages";
import type { Account } from "../account/useAccount";
import type { AccountOutcome } from "../api/accounts";
import { findContactsPeople } from "../api/contactsPeople";
import { personPhotoUri } from "../api/people";
import { contactHashes } from "../contacts/contactHashes";
import {
  askForContacts,
  contactNumbers,
  contactsAvailable,
} from "../contacts/phoneContacts";
import { phoneRegion } from "../contacts/phoneNumbers";
import { t } from "../i18n";
import { OpenSettings } from "../permissions/OpenSettings";
import { Avatar } from "../profile/Avatar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { FollowButton } from "./FollowButton";

type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

type Look =
  | { status: "idle" }
  | { status: "looking" }
  | { status: "denied"; forGood: boolean }
  | { status: "noNumbers" }
  | { status: "found"; people: ContactPerson[] }
  | { status: "failed"; problem: string };

type Props = {
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  account: Pick<Account, "state" | "sessionEnded">;
  /** A member was touched: its profile. */
  onPick: (person: Person) => void;
  /** The phone's region, for numbers written without their country code. */
  region?: () => string | null;
  /** Whether the app was built with expo-contacts (not the store's 1.0). */
  available?: () => boolean;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** The side of a member's picture in the list, as in the search. */
const PHOTO_SIDE = 40;

/** A look that failed, in words. */
export function contactsProblem(failed: Failed): string {
  // An API older than TASK-262 C has no POST /people/from-contacts.
  if (failed.kind === "api_error" && failed.code === "http_error") {
    return t("This server cannot look in your contacts yet.");
  }
  return accountProblem(failed);
}

/**
 * «From your contacts» in «Find friends» (TASK-262 C, ADR-0226): at the
 * tap, and only then, the phone asks for the contacts; their numbers leave
 * the phone as SHA-256 hashes of their E.164 form, never a name. The
 * members who saved one of them come back, each with «Follow». In an app
 * built without expo-contacts (the store's 1.0) it is not shown at all.
 */
export function ContactsFriends({
  apiUrl,
  account,
  onPick,
  region = phoneRegion,
  available = contactsAvailable,
  fetchFn,
  apiKey,
}: Props) {
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const [look, setLook] = useState<Look>({ status: "idle" });
  // Asked once: the native modules of a binary do not change while it runs.
  const [built] = useState(available);

  if (!built || token === null || apiUrl === null) {
    // Without the native module, nothing to offer; without an account or
    // an API, the search above says why.
    return null;
  }

  async function lookUp(url: string, signedIn: string) {
    setLook({ status: "looking" });
    try {
      const access = await askForContacts();
      if (access !== "granted") {
        setLook({ status: "denied", forGood: access === "blocked" });
        return;
      }
      const hashes = contactHashes(await contactNumbers(), region());
      if (hashes.length === 0) {
        setLook({ status: "noNumbers" });
        return;
      }
      const outcome = await findContactsPeople(url, signedIn, hashes, {
        fetchFn,
        key: apiKey,
      });
      if (outcome.kind === "ok") {
        setLook({ status: "found", people: outcome.value.people });
        return;
      }
      setLook({ status: "failed", problem: contactsProblem(outcome) });
      if (sessionEnded(outcome)) {
        onSessionEnded(signedIn);
      }
    } catch {
      // The phone could not read its contacts.
      setLook({ status: "failed", problem: t("The contacts could not be read.") });
    }
  }

  function followed(publicId: string, follow: FollowState) {
    setLook((now) =>
      now.status === "found"
        ? {
            status: "found",
            people: now.people.map((person) =>
              person.public_id === publicId ? { ...person, follow } : person,
            ),
          }
        : now,
    );
  }

  const signedIn = token;
  const url = apiUrl;
  const canAsk =
    look.status === "idle" ||
    look.status === "failed" ||
    (look.status === "denied" && !look.forGood);
  return (
    <View style={styles.box}>
      <Text style={styles.heading} accessibilityRole="header">
        {t("FROM YOUR CONTACTS")}
      </Text>
      {canAsk && (
        <>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => void lookUp(url, signedIn)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t("Find friends in your contacts")}</Text>
          </Pressable>
          <Text style={styles.note}>
            {t(
              "Only coded phone numbers leave the phone, never names. The server compares them with the numbers members saved and keeps none.",
            )}
          </Text>
        </>
      )}
      {look.status === "looking" && (
        <Text style={styles.note}>{t("Looking in your contacts…")}</Text>
      )}
      {look.status === "denied" && (
        <>
          <Text style={[styles.note, styles.problem]}>
            {t("MuW cannot see your contacts.")}
          </Text>
          {look.forGood && <OpenSettings />}
        </>
      )}
      {look.status === "noNumbers" && (
        <Text style={styles.note}>{t("No phone numbers in your contacts.")}</Text>
      )}
      {look.status === "failed" && (
        <Text style={[styles.note, styles.problem]}>{look.problem}</Text>
      )}
      {look.status === "found" && look.people.length === 0 && (
        <Text style={styles.note}>{t("None of your contacts is on MuW yet.")}</Text>
      )}
      {look.status === "found" &&
        look.people.map((person) => (
          <View key={person.public_id} style={styles.person}>
            <Pressable
              style={({ pressed }) => [styles.who, pressed && styles.pressed]}
              onPress={() => onPick(person)}
              accessibilityRole="button"
              accessibilityLabel={person.username}
            >
              <Avatar
                name={person.username}
                size={PHOTO_SIDE}
                photo={personPhotoUri(person)}
              />
              <Text style={styles.name} numberOfLines={1}>
                {person.username}
              </Text>
            </Pressable>
            <FollowButton
              apiUrl={url}
              token={signedIn}
              publicId={person.public_id}
              username={person.username}
              follow={person.follow}
              onFollow={(next) => followed(person.public_id, next)}
              onSessionEnded={onSessionEnded}
              fetchFn={fetchFn}
              apiKey={apiKey}
            />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
  },
  heading: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
  // Neutral, as every control that is not the route's (docs/UI.md, «Il tema»).
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  pressed: {
    opacity: 0.6,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
  },
  person: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  who: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  name: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
});
