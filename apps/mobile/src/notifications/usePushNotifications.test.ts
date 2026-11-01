import session from "@shaperoute/shared-types/fixtures/session.json";
import examples from "@shaperoute/shared-types/fixtures/push-data.json";
import type { Session, User } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { answers, apiError, type MemorySecureStore } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { saveLanguageChoice } from "../i18n/language";
import { usePushNotifications } from "./usePushNotifications";

jest.mock("expo-notifications");
// The EAS project of app.json, which jest's expo-constants does not read.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { eas: { projectId: "47bc672d-5824-4e77-84c4-b44132c6e87f" } },
    },
  },
}));
jest.mock("expo-secure-store", () =>
  jest.requireActual("../account/testing").memorySecureStore(),
);

type Phone = typeof import("../../__mocks__/expo-notifications");
const phone = jest.requireMock<Phone>("expo-notifications");
const keychain = jest.requireMock<MemorySecureStore>("expo-secure-store");

const URL = "http://api";
const PHONE = "ExponentPushToken[this-phone]";
const SENT_KEY = "shaperoute.push-token";
const user = session.user as User;
const ended = jest.fn();
const openDrawing = jest.fn();
const openProfile = jest.fn();
const openPlay = jest.fn();
const openChallenge = jest.fn();
const openContest = jest.fn();

function state(token: string | null, push: boolean): AccountState {
  if (token === null) {
    return { status: "signedOut", notice: null };
  }
  const signedIn = {
    ...(session as Session),
    token,
    user: { ...user, notifications: { email: false, push } },
  };
  return { status: "signedIn", session: signedIn };
}

type Props = { token: string | null; push: boolean };

async function hook(fetchFn: jest.Mock, initialProps: Props) {
  const rendered = await renderHook(
    ({ token, push }: Props) =>
      usePushNotifications(
        URL,
        { state: state(token, push), sessionEnded: ended },
        { openDrawing, openProfile, openPlay, openChallenge, openContest },
        { fetchFn, key: null },
      ),
    { initialProps },
  );
  // The token's way to the API is queued: let it go.
  await act(async () => {});
  return rendered;
}

function calls(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(([url, init]) => `${init.method} ${url}`);
}

beforeEach(() => {
  phone.resetPhone();
  keychain.kept.clear();
  ended.mockReset();
  openDrawing.mockReset();
  openProfile.mockReset();
  openPlay.mockReset();
  openChallenge.mockReset();
  openContest.mockReset();
});

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("on, with the phone allowing it, the token goes once in the app's language", async () => {
  phone.phone.permission = "granted";
  await act(async () => saveLanguageChoice("it"));
  const fetchFn = answers({ status: 204 });
  const { rerender } = await hook(fetchFn, { token: "one", push: true });
  expect(calls(fetchFn)).toEqual(["PUT http://api/me/push-token"]);
  expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual({
    token: PHONE,
    platform: "ios",
    language: "it",
  });
  expect(JSON.parse(keychain.kept.get(SENT_KEY) ?? "")).toEqual({
    userId: user.id,
    token: PHONE,
    language: "it",
  });
  // The account read again, or another opening: nothing new to send.
  await rerender({ token: "one", push: true });
  await act(async () => {});
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("the phone is never asked from here: only the switch asks", async () => {
  const fetchFn = answers();
  await hook(fetchFn, { token: "one", push: true });
  expect(phone.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(fetchFn).not.toHaveBeenCalled();
});

test("off, or nobody signed in, sends nothing", async () => {
  phone.phone.permission = "granted";
  const fetchFn = answers();
  await hook(fetchFn, { token: "one", push: false });
  await hook(fetchFn, { token: null, push: true });
  expect(fetchFn).not.toHaveBeenCalled();
});

test("turned off, the token comes back from the API", async () => {
  phone.phone.permission = "granted";
  const fetchFn = answers({ status: 204 }, { status: 204 });
  const { rerender } = await hook(fetchFn, { token: "one", push: true });
  await rerender({ token: "one", push: false });
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  expect(calls(fetchFn)[1]).toBe(
    `DELETE http://api/me/push-token/${encodeURIComponent(PHONE)}`,
  );
  expect(keychain.kept.has(SENT_KEY)).toBe(false);
});

test("a session the API ended signs out here too", async () => {
  phone.phone.permission = "granted";
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  await hook(fetchFn, { token: "one", push: true });
  await waitFor(() => expect(ended).toHaveBeenCalledWith("one"));
});

test("a notification touched opens its drawing, or the profile of who acted", async () => {
  const [drawing, profile] = examples;
  await hook(answers(), { token: "one", push: false });
  expect(phone.setNotificationHandler).toHaveBeenCalledTimes(1);
  await act(async () => phone.tap(drawing));
  expect(openDrawing).toHaveBeenCalledWith(drawing.drawing_id);
  await act(async () => phone.tap(profile));
  expect(openProfile).toHaveBeenCalledWith({
    public_id: profile.public_id,
    username: "ada",
    photo: null,
  });
  // Data the app does not know opens nothing.
  await act(async () => phone.tap({ kind: "comment" }));
  expect(openDrawing).toHaveBeenCalledTimes(1);
  expect(openProfile).toHaveBeenCalledTimes(1);
  // A shape of the game unlocked opens «Play» (TASK-296), though its data
  // names the runner.
  await act(async () => phone.tap({ ...profile, kind: "shape_unlocked" }));
  expect(openPlay).toHaveBeenCalledTimes(1);
  expect(openProfile).toHaveBeenCalledTimes(1);
  // A challenge's notification opens the challenge (TASK-296 part D).
  const challenge = "6d0e5c4a-2b1f-4a3e-9c8d-7e6f5a4b3c2d";
  await act(async () => phone.tap({ kind: "piece_done", challenge_id: challenge }));
  expect(openChallenge).toHaveBeenCalledWith(challenge);
  await act(async () => phone.tap({ kind: "challenge_ending" }));
  expect(openPlay).toHaveBeenCalledTimes(2);
  expect(openChallenge).toHaveBeenCalledTimes(1);
});

test("a monthly challenge's notification opens its page, never the game's", async () => {
  await hook(answers(), { token: "t", push: true });
  const contest = "c1a2b3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  await act(async () => phone.tap({ kind: "contest_results", contest_id: contest }));
  expect(openContest).toHaveBeenCalledWith(contest);
  expect(openChallenge).not.toHaveBeenCalled();
  expect(openPlay).not.toHaveBeenCalled();
});

test("the notification that opened the app opens its drawing, once", async () => {
  const [drawing] = examples;
  phone.phone.last = phone.response(drawing);
  await hook(answers(), { token: "one", push: false });
  expect(openDrawing).toHaveBeenCalledTimes(1);
  expect(openDrawing).toHaveBeenCalledWith(drawing.drawing_id);
  expect(phone.clearLastNotificationResponse).toHaveBeenCalled();
});

test("signed out, a touched notification opens nothing", async () => {
  await hook(answers(), { token: null, push: false });
  await act(async () => phone.tap(examples[0]));
  expect(openDrawing).not.toHaveBeenCalled();
});
