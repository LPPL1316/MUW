import type { FeedPost, Person } from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { accountProblem, sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { findPeople, searchable } from "../api/people";
import { type DrawingQuery, searchDrawings } from "../api/searchDrawings";
import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { useFollowsDoor } from "../social/followsDoor";
import { categoryOf } from "./categories";
import { foundExamples, MAX_QUERY_LENGTH, namedShapes, wordsOf } from "./drawingMatch";
import { bandOf, NO_FILTERS, type SearchFilters } from "./searchFilters";

/** A search starts this long after the last letter, or a filter changed:
 * not a request per letter (TASK-344). */
export const SEARCH_DELAY_MS = 300;

/** What the search has of the members' drawings. */
export type MembersShown =
  /** Nobody signed in, no API, or an API without the search: only the
   * examples. */
  | { kind: "off" }
  | { kind: "loading" }
  | { kind: "ready"; posts: FeedPost[]; next: string | null; more: boolean }
  | { kind: "failed"; problem: string };

/** What the search has of the members, by name. */
export type PeopleShown =
  | { kind: "off" }
  /** Too few letters to ask. */
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; people: Person[] }
  | { kind: "failed"; problem: string };

export type DrawingSearch = {
  /** What was typed once the typing paused: what the results are of. */
  asked: string;
  /** The typing has not paused yet, or a filter just changed. */
  waiting: boolean;
  examples: SamplePost[];
  members: MembersShown;
  people: PeopleShown;
  /** Reads the next page of the members' drawings, when there is one. */
  more: () => void;
};

/** An answer, with the search it was to. */
type Read<T> = { key: string; shown: T };

type Options = {
  fetchFn?: typeof fetch;
  key?: string | null;
  /** The examples searched: «Feed»'s, unless a test says. */
  examples?: readonly SamplePost[];
};

/** The query of the API for what was typed and the filters. */
export function queryOf(typed: string, filters: SearchFilters): DrawingQuery {
  const band = bandOf(filters.distance);
  return {
    q: typed,
    named: namedShapes(wordsOf(typed)),
    shapes: filters.category === null ? [] : categoryOf(filters.category).shapes,
    activities: filters.activities,
    minM: band?.min ?? null,
    maxM: band?.max ?? null,
    place: filters.place,
    complexities: filters.complexities,
    sort: filters.sort,
  };
}

/** True when the search asks anything: words, a category or a filter. */
export function asksAnything(typed: string, filters: SearchFilters): boolean {
  return (
    typed.trim() !== "" ||
    JSON.stringify({ ...filters, sort: NO_FILTERS.sort }) !==
      JSON.stringify({ ...NO_FILTERS })
  );
}

/**
 * The search of «Feed»'s lens (TASK-344, ADR-0297): the examples found on
 * the phone at once, the members' drawings from GET /search/drawings a
 * page at a time, the members by name from GET /users?q=. Each starts
 * SEARCH_DELAY_MS after the last change; only the answer to the last
 * request is kept.
 */
export function useDrawingSearch(
  typed: string,
  filters: SearchFilters,
  options: Options = {},
): DrawingSearch {
  const { fetchFn, key, examples = SAMPLE_FEED } = options;
  const { apiUrl, account } = useFollowsDoor();
  const { state, sessionEnded: endSession } = account;
  const token = state.status === "signedIn" ? state.session.token : null;

  const [asked, setAsked] = useState({ typed, filters });
  useEffect(() => {
    const timer = setTimeout(() => setAsked({ typed, filters }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, filters]);
  const waiting = asked.typed !== typed || asked.filters !== filters;

  const found = useMemo(
    () => foundExamples(examples, asked.typed, asked.filters),
    [asked, examples],
  );

  // What each answer was to: a search shown is the last one asked, and a
  // new one shows «loading» until its answer comes.
  const membersKey =
    token === null || apiUrl === null || asked.typed.trim().length > MAX_QUERY_LENGTH
      ? null
      : `${token}|${JSON.stringify(queryOf(asked.typed, asked.filters))}`;
  const peopleKey =
    token === null || apiUrl === null || !searchable(asked.typed)
      ? null
      : `${token}|${asked.typed}`;
  const [membersRead, setMembersRead] = useState<Read<MembersShown> | null>(null);
  const [peopleRead, setPeopleRead] = useState<Read<PeopleShown> | null>(null);
  // Each request is numbered: only the answer to the last one is kept.
  const drawingsAsked = useRef(0);
  const peopleAsked = useRef(0);
  // The cursor of the page on its way: asked once, however often the end
  // of the grid comes near.
  const nextAsked = useRef<string | null>(null);

  const failed = useCallback(
    (outcome: Exclude<AccountOutcome<unknown>, { kind: "ok" }>, of: string) => {
      if (sessionEnded(outcome)) {
        endSession(of);
        return null;
      }
      return accountProblem(outcome);
    },
    [endSession],
  );

  /** Asks a page of the members' drawings for the search `of`; the first
   * without a cursor, the next ones joined to what is shown. */
  const askPage = useCallback(
    (of: string, cursor: string | null) => {
      if (token === null || apiUrl === null) {
        return;
      }
      const request = ++drawingsAsked.current;
      nextAsked.current = cursor;
      const query = { ...queryOf(asked.typed, asked.filters), cursor };
      void searchDrawings(apiUrl, token, query, { fetchFn, key }).then((outcome) => {
        if (request !== drawingsAsked.current) {
          return;
        }
        if (outcome.kind === "ok") {
          setMembersRead((was) => ({
            key: of,
            shown: {
              kind: "ready",
              posts:
                cursor !== null && was?.shown.kind === "ready"
                  ? [...was.shown.posts, ...outcome.value.posts]
                  : outcome.value.posts,
              next: outcome.value.next,
              more: false,
            },
          }));
          return;
        }
        // An API before TASK-344: the examples only, as without an account.
        if (outcome.kind === "api_error" && outcome.code === "http_error") {
          setMembersRead({ key: of, shown: { kind: "off" } });
          return;
        }
        const problem = failed(outcome, token);
        setMembersRead({
          key: of,
          shown: problem === null ? { kind: "off" } : { kind: "failed", problem },
        });
      });
    },
    [apiUrl, asked, failed, fetchFn, key, token],
  );

  useEffect(() => {
    if (membersKey !== null) {
      askPage(membersKey, null);
    }
  }, [askPage, membersKey]);

  useEffect(() => {
    if (peopleKey === null || token === null || apiUrl === null) {
      return;
    }
    const request = ++peopleAsked.current;
    void findPeople(apiUrl, token, asked.typed, { fetchFn, key }).then((outcome) => {
      if (request !== peopleAsked.current) {
        return;
      }
      if (outcome.kind === "ok") {
        setPeopleRead({
          key: peopleKey,
          shown: { kind: "ready", people: outcome.value.people },
        });
        return;
      }
      const problem = failed(outcome, token);
      setPeopleRead({
        key: peopleKey,
        shown: problem === null ? { kind: "off" } : { kind: "failed", problem },
      });
    });
  }, [apiUrl, asked.typed, failed, fetchFn, key, peopleKey, token]);

  const signedIn = token !== null && apiUrl !== null;
  const members = useMemo<MembersShown>(() => {
    if (!signedIn) {
      return { kind: "off" };
    }
    if (membersKey === null) {
      return { kind: "ready", posts: [], next: null, more: false };
    }
    return membersRead?.key === membersKey ? membersRead.shown : { kind: "loading" };
  }, [membersKey, membersRead, signedIn]);
  const people = useMemo<PeopleShown>(() => {
    if (!signedIn) {
      return { kind: "off" };
    }
    if (peopleKey === null) {
      return { kind: "idle" };
    }
    return peopleRead?.key === peopleKey ? peopleRead.shown : { kind: "loading" };
  }, [peopleKey, peopleRead, signedIn]);

  const more = useCallback(() => {
    if (
      membersKey === null ||
      members.kind !== "ready" ||
      members.next === null ||
      members.next === nextAsked.current
    ) {
      return;
    }
    setMembersRead({ key: membersKey, shown: { ...members, more: true } });
    askPage(membersKey, members.next);
  }, [askPage, members, membersKey]);

  return { asked: asked.typed, waiting, examples: found, members, people, more };
}
