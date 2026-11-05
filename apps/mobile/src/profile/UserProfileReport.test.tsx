import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { PublicProfile, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { answers } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { forgetBlocked } from "../social/blockedNow";
import { IslandLayer } from "../ui/IslandLayer";
import { UserProfilePage } from "./UserProfilePage";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// Reporting and blocking from another member's profile (TASK-121,
// ADR-0228).

const URL = "http://api";
// Another member's: the profile of the fixtures has the id of their account.
const ID = "3b9d2e10-7c4a-4f8e-a1d6-5e2f9c0b7a44";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const profile = { ...publicProfile, public_id: ID, follow: "none" } as PublicProfile;

async function show(fetchFn: jest.Mock) {
  await render(
    <>
      <UserProfilePage
        apiUrl={URL}
        account={{ state: signedIn, sessionEnded: jest.fn() }}
        publicId={ID}
        fetchFn={fetchFn}
        apiKey={null}
      />
      <IslandLayer />
    </>,
  );
}

beforeEach(forgetBlocked);

test("«Report» on a profile reports the member", async () => {
  const fetchFn = answers({ status: 200, body: profile }, { status: 204 });
  await show(fetchFn);
  await fireEvent.press(await screen.findByRole("button", { name: "More" }));
  await fireEvent.press(screen.getByRole("button", { name: "Report" }));
  await fireEvent.press(screen.getByRole("button", { name: "Spam" }));
  expect(
    await screen.findByText("Thanks for telling us. We will look at it."),
  ).toBeOnTheScreen();
  const [url, init] = fetchFn.mock.calls[1];
  expect(url).toBe(`${URL}/reports`);
  expect(JSON.parse(String(init?.body))).toEqual({
    kind: "user",
    id: ID,
    reason: "spam",
  });
});

test("blocked, the profile shows no more and says where to unblock", async () => {
  const fetchFn = answers({ status: 200, body: profile }, { status: 204 });
  await show(fetchFn);
  await fireEvent.press(await screen.findByRole("button", { name: "More" }));
  await fireEvent.press(screen.getByRole("button", { name: "Block Ada_runs" }));
  await fireEvent.press(screen.getByRole("button", { name: "Block" }));
  expect(
    await screen.findByText(
      "You blocked Ada_runs. Unblock them from Blocked people in your profile.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  expect(fetchFn.mock.calls[1][0]).toBe(`${URL}/users/${ID}/block`);
  expect(fetchFn.mock.calls[1][1]).toMatchObject({ method: "PUT" });
});
