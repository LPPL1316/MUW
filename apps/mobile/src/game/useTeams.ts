import type { GameTeam } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { accountProblem, NO_API, sessionEnded } from "../account/messages";
import { t } from "../i18n";
import { useFollowsDoor } from "../social/followsDoor";
import {
  createTeam,
  fetchTeams,
  joinTeam,
  noTeams,
  removeMember,
  teamProblem,
} from "./teamsApi";

/**
 * The teams of who is signed in (TASK-296 part D, docs/GIOCO.md §6, §9):
 * asked of the API while the «Challenges» tab is on screen and kept while
 * the app is open, as the collection is (`useGameMe`); and the ways to
 * create one, join one with its code, leave one or remove a member. "off"
 * without an account; "none" on an API that has no teams yet (its 404), so
 * the tab shows no error on a server before part C.
 */
export type TeamsShown =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; teams: GameTeam[] }
  | { status: "none" }
  | { status: "failed"; problem: string };

/** What a request of the account came to: the thing, or why not, in words. */
export type Done<T> = { ok: true; value: T } | { ok: false; problem: string };

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What the API said to one account; another account's is nobody's. */
type Held = {
  token: string;
  state: Extract<TeamsShown, { status: "loading" | "ready" | "none" | "failed" }>;
};

// The last answer, for the tab to come back to without a wait; whose it
// is, so another account starts over.
let kept: { token: string; teams: GameTeam[] } | null = null;

const LOADING: TeamsShown = { status: "loading" };
const OFF: TeamsShown = { status: "off" };

export function useTeams(
  active: boolean,
  options: Options = {},
): {
  shown: TeamsShown;
  /** «Try again»: a wait, then the answer. */
  refresh: () => void;
  /** The list asked again, the last one in view meanwhile: back from a team. */
  reread: () => void;
  create: (name: string) => Promise<Done<GameTeam>>;
  join: (code: string) => Promise<Done<GameTeam>>;
  /** Out of the team (the account's own public_id), or a member out. */
  remove: (teamId: string, publicId: string) => Promise<Done<null>>;
} {
  const { apiUrl, account } = useFollowsDoor();
  const session = account.state.status === "signedIn" ? account.state.session : null;
  const token = session?.token ?? null;
  const me = session?.user.public_id ?? null;
  const endSession = account.sessionEnded;
  const { fetchFn, key } = options;
  const [held, setHeld] = useState<Held | null>(() =>
    kept === null
      ? null
      : { token: kept.token, state: { status: "ready", teams: kept.teams } },
  );
  // Which request's answer still counts: an older one's is dropped.
  const asking = useRef(0);

  const ask = useCallback(() => {
    if (apiUrl === null || token === null) {
      return;
    }
    const request = ++asking.current;
    void fetchTeams(apiUrl, token, { fetchFn, key }).then((outcome) => {
      if (request !== asking.current) {
        return;
      }
      if (outcome.kind === "ok") {
        kept = { token, teams: outcome.value.teams };
        setHeld({ token, state: { status: "ready", teams: outcome.value.teams } });
        return;
      }
      if (noTeams(outcome)) {
        setHeld({ token, state: { status: "none" } });
        return;
      }
      if (sessionEnded(outcome)) {
        endSession(token);
      }
      // No network: the last list stays, without a word; an error only
      // when there is nothing to show.
      setHeld((last) =>
        last !== null && last.token === token && last.state.status === "ready"
          ? last
          : { token, state: { status: "failed", problem: accountProblem(outcome) } },
      );
    });
  }, [apiUrl, endSession, fetchFn, key, token]);

  useEffect(() => {
    if (active && token !== null) {
      ask();
    }
  }, [active, ask, token]);

  const refresh = useCallback(() => {
    if (token !== null) {
      setHeld({ token, state: { status: "loading" } });
      ask();
    }
  }, [ask, token]);

  /** A team the API just answered, in the list at once; the list is asked
   * again for the API's order. */
  const place = useCallback(
    (team: GameTeam) => {
      if (token === null) {
        return;
      }
      setHeld((last) => {
        const teams =
          last !== null && last.token === token && last.state.status === "ready"
            ? last.state.teams
            : [];
        const others = teams.filter((each) => each.id !== team.id);
        const next = [...others, team];
        kept = { token, teams: next };
        return { token, state: { status: "ready", teams: next } };
      });
      ask();
    },
    [ask, token],
  );

  const create = useCallback(
    async (name: string): Promise<Done<GameTeam>> => {
      if (apiUrl === null || token === null) {
        return { ok: false, problem: t(NO_API) };
      }
      const outcome = await createTeam(apiUrl, token, { name }, { fetchFn, key });
      if (outcome.kind === "ok") {
        place(outcome.value);
        return { ok: true, value: outcome.value };
      }
      if (sessionEnded(outcome)) {
        endSession(token);
      }
      return { ok: false, problem: teamProblem(outcome) };
    },
    [apiUrl, endSession, fetchFn, key, place, token],
  );

  const join = useCallback(
    async (code: string): Promise<Done<GameTeam>> => {
      if (apiUrl === null || token === null) {
        return { ok: false, problem: t(NO_API) };
      }
      const outcome = await joinTeam(apiUrl, token, { code }, { fetchFn, key });
      if (outcome.kind === "ok") {
        place(outcome.value);
        return { ok: true, value: outcome.value };
      }
      if (sessionEnded(outcome)) {
        endSession(token);
      }
      return { ok: false, problem: teamProblem(outcome) };
    },
    [apiUrl, endSession, fetchFn, key, place, token],
  );

  const remove = useCallback(
    async (teamId: string, publicId: string): Promise<Done<null>> => {
      if (apiUrl === null || token === null) {
        return { ok: false, problem: t(NO_API) };
      }
      const outcome = await removeMember(apiUrl, token, teamId, publicId, {
        fetchFn,
        key,
      });
      if (outcome.kind !== "ok") {
        if (sessionEnded(outcome)) {
          endSession(token);
        }
        return { ok: false, problem: teamProblem(outcome) };
      }
      // Gone from the list at once: the team, or the member from it.
      setHeld((last) => {
        if (last === null || last.token !== token || last.state.status !== "ready") {
          return last;
        }
        const teams =
          publicId === me
            ? last.state.teams.filter((each) => each.id !== teamId)
            : last.state.teams.map((each) =>
                each.id === teamId
                  ? {
                      ...each,
                      members: each.members.filter((m) => m.public_id !== publicId),
                    }
                  : each,
              );
        kept = { token, teams };
        return { token, state: { status: "ready", teams } };
      });
      ask();
      return { ok: true, value: null };
    },
    [apiUrl, ask, endSession, fetchFn, key, me, token],
  );

  const shown: TeamsShown =
    token === null ? OFF : held !== null && held.token === token ? held.state : LOADING;
  return { shown, refresh, reread: ask, create, join, remove };
}

/** For the tests: as an app just opened. */
export function forgetTeams(): void {
  kept = null;
}
