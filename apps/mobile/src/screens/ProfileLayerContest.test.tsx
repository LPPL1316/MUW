/**
 * The contest for who signs in (TASK-343 part B, docs/CONCORSI.md §15): the
 * form at the end of a run needs the monthly challenge and what the account
 * entered, and «Feed» may not have been opened. Found in the simulator on
 * 2026-10-30: the switch of «My activities» started off on a drawing entered.
 */
import themed from "@shaperoute/shared-types/fixtures/contest-themed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { render, waitFor } from "@testing-library/react-native";
import { View } from "react-native";

import { apiError, type MemorySecureStore } from "../account/testing";
import { forgetContest, keptContest } from "../contest/contestKept";
import { ProfileLayer } from "./ProfileLayer";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");
jest.mock("expo-notifications");
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../account/testing")>("../account/testing")
    .memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://api";
const KEY = "shaperoute.session";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let contest: () => Response;

function askedContest(): RequestInit[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url) === `${API}/contests/current`)
    .map(([, init]) => init ?? {});
}

beforeEach(() => {
  store.kept.clear();
  forgetContest();
  contest = () => Response.json(themed);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input).replace(API, "");
    if (path === "/contests/current") {
      return contest();
    }
    if (path === "/me") {
      return Response.json(session.user);
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("signed in, the contest is asked for once, with the token, without «Feed»", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  await render(
    <ProfileLayer apiUrl={API}>
      <View />
    </ProfileLayer>,
  );
  await waitFor(() => expect(keptContest()?.contest.id).toBe(themed.id));
  expect(keptContest()?.account).toBe(session.user.public_id);
  expect(askedContest()).toHaveLength(1);
  expect(askedContest()[0].headers).toMatchObject({
    Authorization: `Bearer ${session.token}`,
  });
});

test("with today's server, no contest: it is one more 404, and nothing is kept", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  contest = () =>
    Response.json(apiError("no_contest", "There is no contest right now."), {
      status: 404,
    });
  await render(
    <ProfileLayer apiUrl={API}>
      <View />
    </ProfileLayer>,
  );
  await waitFor(() => expect(askedContest()).toHaveLength(1));
  expect(keptContest()).toBeNull();
});

test("signed out, nothing is asked: «Feed» asks when it opens", async () => {
  await render(
    <ProfileLayer apiUrl={API}>
      <View />
    </ProfileLayer>,
  );
  await waitFor(() => expect(fetchSpy).not.toHaveBeenCalledWith(`${API}/me`));
  expect(askedContest()).toHaveLength(0);
});
