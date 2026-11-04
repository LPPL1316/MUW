import type { Person } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";

import { accountProblem, NO_API, sessionEnded } from "../account/messages";
import type { Account } from "../account/useAccount";
import type { AccountOutcome } from "../api/accounts";
import { findPeople, peopleQuery, personPhotoUri, searchable } from "../api/people";
import { t, tLater } from "../i18n";
import { Avatar } from "../profile/Avatar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";

type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

type Found =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; people: Person[] }
  | { status: "failed"; problem: string };

type Props = {
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  account: Pick<Account, "state" | "sessionEnded">;
  /** A member was touched. */
  onPick: (person: Person) => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** In English: shown with `t()` (TASK-210). */
export const LOG_IN_TO_FIND = tLater("Log in to find your friends.");

/** A search starts this long after the last letter: not a request per letter. */
export const SEARCH_DELAY_MS = 300;
/** The side of a member's picture in the list. */
const PHOTO_SIDE = 40;

/** A search that failed, in words. */
export function searchProblem(failed: Failed): string {
  // An API older than TASK-211 has no GET /users?q=.
  if (failed.kind === "api_error" && failed.code === "http_error") {
    return t("This server cannot look for members yet.");
  }
  return accountProblem(failed);
}

/**
 * The members of Sgrava found by name (TASK-215; the API is TASK-211's):
 * a field, and under it their pictures and names, at most 20. The search
 * starts at 2 letters, once the typing pauses, or at once with the
 * keyboard's return key. Never an email: the API does not send it.
 */
export function PeopleSearch({ apiUrl, account, onPick, fetchFn, apiKey }: Props) {
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<Found>({ status: "idle" });
  // Searches are numbered: only the answer to the last one is shown.
  const asked = useRef(0);
  // The query of that search: the pause after the return key does not ask it twice.
  const askedQuery = useRef("");

  const search = useCallback(
    (text: string) => {
      if (token === null || apiUrl === null || !searchable(text)) {
        return;
      }
      const mine = ++asked.current;
      askedQuery.current = peopleQuery(text);
      // The members already found stay until the new ones come.
      setFound((now) => (now.status === "found" ? now : { status: "searching" }));
      void findPeople(apiUrl, token, text, { fetchFn, key: apiKey }).then((outcome) => {
        if (mine !== asked.current) {
          return;
        }
        if (outcome.kind === "ok") {
          setFound({ status: "found", people: outcome.value.people });
          return;
        }
        setFound({ status: "failed", problem: searchProblem(outcome) });
        // The same name can be asked again (TASK-254): nothing was found for it.
        askedQuery.current = "";
        if (sessionEnded(outcome)) {
          onSessionEnded(token);
        }
      });
    },
    [apiKey, apiUrl, fetchFn, onSessionEnded, token],
  );

  useEffect(() => {
    if (!searchable(typed) || peopleQuery(typed) === askedQuery.current) {
      return;
    }
    const timer = setTimeout(() => {
      // The return key may have asked it in the meantime.
      if (peopleQuery(typed) !== askedQuery.current) {
        search(typed);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, typed]);

  function onText(text: string) {
    setTyped(text);
    if (!searchable(text)) {
      // Too short to look for: what was found for a longer name goes, and
      // no answer still on its way is shown.
      asked.current += 1;
      askedQuery.current = "";
      setFound({ status: "idle" });
    }
  }

  function pick(person: Person) {
    Keyboard.dismiss();
    onPick(person);
  }

  if (token === null) {
    return <Text style={styles.note}>{t(LOG_IN_TO_FIND)}</Text>;
  }
  if (apiUrl === null) {
    return <Text style={styles.note}>{t(NO_API)}</Text>;
  }
  return (
    <View style={styles.search}>
      <TextInput
        style={styles.input}
        placeholder={t("Name")}
        placeholderTextColor={color.textFaint}
        keyboardAppearance="dark"
        value={typed}
        onChangeText={onText}
        onSubmitEditing={() => {
          if (peopleQuery(typed) !== askedQuery.current) {
            search(typed);
          }
        }}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        accessibilityLabel={t("Name")}
      />
      {found.status === "idle" && (
        <Text style={styles.note}>{t("Type at least 2 letters of a name.")}</Text>
      )}
      {found.status === "searching" && (
        <Text style={styles.note}>{t("Searching…")}</Text>
      )}
      {found.status === "failed" && (
        <Text style={[styles.note, styles.problem]}>{found.problem}</Text>
      )}
      {found.status === "found" && found.people.length === 0 && (
        <Text style={styles.note}>{t("Nobody has a name like that.")}</Text>
      )}
      {found.status === "found" &&
        found.people.map((person) => (
          <Tap
            key={person.public_id}
            style={styles.person}
            onPress={() => pick(person)}
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
          </Tap>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    gap: space.sm,
  },
  // As the field of the place search (PlaceSearch.tsx).
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
    borderBottomColor: color.hairline,
  },
  name: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
});
