import type {
  ContestEntriesPage,
  ContestEntry,
  ContestGalleryOrder,
  FeedPost as Post,
} from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { FeedPost } from "../feed/FeedPost";
import { shownPost } from "../feed/feedPosts";
import { t, tPlural } from "../i18n";
import { Segmented } from "../screens/Segmented";
import { useBlockedNow } from "../social/blockedNow";
import { useFollowsDoor } from "../social/followsDoor";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { fetchContestEntries, noContest } from "./contestApi";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What the gallery of a challenge has so far. */
export type Gallery = {
  order: ContestGalleryOrder;
  setOrder: (order: ContestGalleryOrder) => void;
  entries: readonly ContestEntry[];
  status: "loading" | "ready" | "failed";
  /** Asks for the next page, if there is one. */
  more: () => void;
  /** Asks for the first page again. */
  again: () => void;
};

/**
 * The gallery of a monthly challenge (TASK-343 part B, docs/CONCORSI.md §15):
 * the whole standings, by place or the latest first, a page at a time. An
 * API that has no gallery (404) is a gallery with nothing in it.
 */
export function useContestGallery(contestId: string, options: Options = {}): Gallery {
  const { apiUrl, account } = useFollowsDoor();
  const { state, sessionEnded: endSession } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const { fetchFn, key } = options;
  const [order, setOrderState] = useState<ContestGalleryOrder>("top");
  const [entries, setEntries] = useState<readonly ContestEntry[]>([]);
  const [status, setStatus] = useState<Gallery["status"]>("loading");
  const next = useRef<string | null>(null);
  // Only the answer to the latest request counts; a request stays one.
  const asking = useRef(0);
  const busy = useRef(false);

  const take = useCallback(
    (cursor: string | null, outcome: AccountOutcome<ContestEntriesPage>) => {
      busy.current = false;
      if (outcome.kind === "ok") {
        next.current = outcome.value.next;
        setEntries((was) =>
          cursor === null ? outcome.value.entries : [...was, ...outcome.value.entries],
        );
        setStatus("ready");
        return;
      }
      next.current = null;
      if (token !== null && sessionEnded(outcome)) {
        endSession(token);
      }
      setStatus(noContest(outcome) ? "ready" : "failed");
    },
    [endSession, token],
  );

  const ask = useCallback(
    (wanted: ContestGalleryOrder, cursor: string | null) => {
      if (apiUrl === null) {
        return;
      }
      const request = ++asking.current;
      busy.current = true;
      void fetchContestEntries(apiUrl, token, contestId, wanted, cursor, {
        fetchFn,
        key,
      }).then((outcome) => {
        if (request === asking.current) {
          take(cursor, outcome);
        }
      });
    },
    [apiUrl, contestId, fetchFn, key, take, token],
  );

  useEffect(() => {
    ask(order, null);
  }, [ask, order]);

  const setOrder = useCallback((wanted: ContestGalleryOrder) => {
    next.current = null;
    setEntries([]);
    setStatus("loading");
    setOrderState(wanted);
  }, []);
  const more = useCallback(() => {
    if (next.current !== null && !busy.current) {
      ask(order, next.current);
    }
  }, [ask, order]);
  const again = useCallback(() => {
    setStatus("loading");
    ask(order, null);
  }, [ask, order]);
  return { order, setOrder, entries, status, more, again };
}

/** «Top» | «New»: the two orders of the gallery. */
export function GalleryOrder({
  value,
  onChange,
}: {
  value: ContestGalleryOrder;
  onChange: (order: ContestGalleryOrder) => void;
}) {
  return (
    <Segmented
      options={[
        { value: "top", label: t("Top") },
        { value: "new", label: t("New") },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

/**
 * A drawing of the gallery: its place and its reactions over the post, drawn
 * as those of «Feed» (`FeedPost`). A tap opens it whole, where the reactions
 * are left; without an account it is not a button. Gone at once when its
 * author is blocked, as its post.
 */
export function GalleryEntry({
  entry,
  width,
  onOpen,
}: {
  entry: ContestEntry;
  width: number;
  onOpen?: (drawing: Post) => void;
}) {
  const { drawing } = entry;
  const blocked = useBlockedNow(drawing.author.public_id);
  const post = useMemo(() => shownPost(drawing), [drawing]);
  if (blocked) {
    return null;
  }
  return (
    <View style={styles.entry} testID="gallery-entry">
      <View style={styles.place}>
        <Text style={styles.rank}>#{entry.rank}</Text>
        <Text style={styles.reactions}>
          {tPlural(entry.reactions, "{count} reaction", "{count} reactions")}
        </Text>
      </View>
      <FeedPost
        post={post}
        width={width}
        onOpen={onOpen === undefined ? undefined : () => onOpen(drawing)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    gap: space.xs,
  },
  place: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.md,
  },
  rank: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  reactions: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});
