import type { Person } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import { fetchBlocked, unblockMember } from "../api/moderation";
import { personPhotoUri } from "../api/people";
import { t } from "../i18n";
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
import { markUnblocked } from "./blockedNow";
import { useFollowsDoor } from "./followsDoor";
import { moderationProblem } from "./ReportMenu";

/** The side of a member's picture in the list, as in the lists of who follows. */
const PHOTO_SIDE = 40;

/** What the list has of the members blocked. */
type Shown =
  | { kind: "ready"; people: Person[]; next: string | null }
  | { kind: "failed"; problem: string };

type Props = {
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Blocked people» in «Profile» (TASK-121, ADR-0228): a row that opens the
 * list of the members the account blocked, the last first, each with
 * «Unblock». The list is read when the row is opened; an unblocked member
 * leaves it at once. Unblocking brings back no follow: it was ended by the
 * block. A blocked profile does not open: the API has it as nobody's.
 */
export function BlockedPeople({ fetchFn, apiKey }: Props) {
  const { apiUrl, account } = useFollowsDoor();
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<{ asked: string; shown: Shown } | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!open || token === null || apiUrl === null) {
      return;
    }
    let live = true;
    // Opened again, the list read before stays until the new one comes.
    void fetchBlocked(apiUrl, token, null, { fetchFn, key: apiKey }).then((outcome) => {
      if (!live) {
        return;
      }
      setShown({
        asked: token,
        shown:
          outcome.kind === "ok"
            ? { kind: "ready", people: outcome.value.people, next: outcome.value.next }
            : { kind: "failed", problem: moderationProblem(outcome) },
      });
      if (sessionEnded(outcome)) {
        onSessionEnded(token);
      }
    });
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, fetchFn, onSessionEnded, open, token]);

  if (token === null || apiUrl === null) {
    return null;
  }
  const url = apiUrl;
  const asked = token;
  const list = shown !== null && shown.asked === asked ? shown.shown : null;

  function unblock(person: Person) {
    const id = person.public_id;
    setBusy((was) => new Set([...was, id]));
    setProblem(null);
    void unblockMember(url, asked, id, { fetchFn, key: apiKey }).then((outcome) => {
      setBusy((was) => new Set([...was].filter((one) => one !== id)));
      if (outcome.kind !== "ok") {
        setProblem(moderationProblem(outcome));
        if (sessionEnded(outcome)) {
          onSessionEnded(asked);
        }
        return;
      }
      markUnblocked(id);
      setShown((was) =>
        was !== null && was.asked === asked && was.shown.kind === "ready"
          ? {
              asked,
              shown: {
                ...was.shown,
                people: was.shown.people.filter((p) => p.public_id !== id),
              },
            }
          : was,
      );
    });
  }

  function loadMore() {
    if (list === null || list.kind !== "ready" || list.next === null) {
      return;
    }
    setLoadingMore(true);
    void fetchBlocked(url, asked, list.next, { fetchFn, key: apiKey }).then(
      (outcome) => {
        setLoadingMore(false);
        if (outcome.kind !== "ok") {
          return;
        }
        setShown((was) => {
          if (was === null || was.asked !== asked || was.shown.kind !== "ready") {
            return was;
          }
          const seen = new Set(was.shown.people.map((p) => p.public_id));
          return {
            asked,
            shown: {
              kind: "ready",
              people: [
                ...was.shown.people,
                ...outcome.value.people.filter((p) => !seen.has(p.public_id)),
              ],
              next: outcome.value.next,
            },
          };
        });
      },
    );
  }

  return (
    <View style={styles.section}>
      <Tap
        style={styles.row}
        onPress={() => {
          setProblem(null);
          setOpen(!open);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("Blocked people")}
        accessibilityState={{ expanded: open }}
        testID="blocked-people"
      >
        <Text style={styles.rowText}>{t("Blocked people")}</Text>
        <Text style={styles.rowArrow}>{open ? "⌄" : "›"}</Text>
      </Tap>
      {open && (
        <View style={styles.list}>
          {problem !== null && (
            <Text style={styles.problem} accessibilityRole="alert">
              {problem}
            </Text>
          )}
          {list === null && <Text style={styles.note}>{t("Loading…")}</Text>}
          {list?.kind === "failed" && (
            <Text style={styles.problem}>{list.problem}</Text>
          )}
          {list?.kind === "ready" && list.people.length === 0 && (
            <Text style={styles.note}>{t("You have not blocked anyone.")}</Text>
          )}
          {list?.kind === "ready" &&
            list.people.map((person) => {
              const waiting = busy.has(person.public_id);
              return (
                <View key={person.public_id} style={styles.member}>
                  <Avatar
                    name={person.username}
                    size={PHOTO_SIDE}
                    photo={personPhotoUri(person)}
                  />
                  <Text style={styles.name} numberOfLines={1}>
                    {person.username}
                  </Text>
                  <Tap
                    style={[styles.action, waiting && styles.dim]}
                    onPress={() => unblock(person)}
                    disabled={waiting}
                    accessibilityRole="button"
                    accessibilityLabel={t("Unblock {name}", { name: person.username })}
                    accessibilityState={{ disabled: waiting }}
                  >
                    <Text style={styles.actionText}>{t("Unblock")}</Text>
                  </Tap>
                </View>
              );
            })}
          {list?.kind === "ready" && list.next !== null && (
            <Tap
              style={[styles.more, loadingMore && styles.dim]}
              onPress={loadMore}
              disabled={loadingMore}
              accessibilityRole="button"
            >
              <Text style={styles.moreText}>{t("Show more")}</Text>
            </Tap>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
  },
  // As the row of «Settings» (ProfileHome.tsx), without its badge.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TAP_SIZE,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  dim: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  rowArrow: {
    color: color.textMuted,
    fontSize: fontSize.title,
  },
  list: {
    gap: space.sm,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  name: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  action: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  actionText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  more: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
