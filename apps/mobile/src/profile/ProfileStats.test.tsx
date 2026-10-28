import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { PublicProfile, Session, User } from "@shaperoute/shared-types";
import { render, screen, within } from "@testing-library/react-native";

import { answers } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import { ProfileHome } from "./ProfileHome";
import { ProfileStats, totalDistanceNumber, totalsOf } from "./ProfileStats";
import { UserProfilePage } from "./UserProfilePage";

// The totals of a profile (TASK-324): metres of every run, private ones
// too, the climb and the reactions received.

const URL = "http://api";
const ID = publicProfile.public_id;
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const profile = publicProfile as PublicProfile;
// The profile as an API older than TASK-324 answers it.
const { distance_m: _d, climb_m: _c, reactions: _r, ...older } = profile;

test("the totals come from an API that has them, and only all three", () => {
  expect(totalsOf(profile)).toEqual({
    distance_m: 412870,
    climb_m: 3215,
    reactions: 0,
  });
  expect(totalsOf(older)).toBeNull();
  expect(totalsOf({ ...older, distance_m: 10 })).toBeNull();
});

test("the distance has a decimal under a hundred, and none from there", () => {
  expect(totalDistanceNumber(42_340, "km")).toBe("42.3");
  expect(totalDistanceNumber(412_870, "km")).toBe("413");
  expect(totalDistanceNumber(99_940, "km")).toBe("99.9");
  expect(totalDistanceNumber(99_970, "km")).toBe("100");
  expect(totalDistanceNumber(160_934, "mi")).toBe("100");
  expect(totalDistanceNumber(0, "km")).toBe("0.0");
});

test("three numbers: the distance, the climb in metres, the likes", async () => {
  await render(
    <ProfileStats totals={{ distance_m: 42_340, climb_m: 815, reactions: 27 }} />,
  );
  const stats = screen.getByTestId("profile-stats");
  expect(within(stats).getByLabelText("Distance, 42.3 km")).toBeOnTheScreen();
  expect(within(stats).getByLabelText("Elev. gain, 815 m")).toBeOnTheScreen();
  expect(within(stats).getByLabelText("Likes, 27")).toBeOnTheScreen();
});

async function showPage(body: unknown) {
  const fetchFn: jest.Mock = answers({ status: 200, body });
  await render(
    <UserProfilePage
      apiUrl={URL}
      account={{ state: signedIn, sessionEnded: jest.fn() }}
      publicId={ID}
      fetchFn={fetchFn}
      apiKey={null}
    />,
  );
  expect(await screen.findByText("Ada_runs")).toBeOnTheScreen();
}

test("another member's profile shows its totals, and «Drawings» and «Photos»", async () => {
  await showPage({ ...profile, reactions: 87 });
  expect(screen.getByLabelText("Distance, 413 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Elev. gain, 3215 m")).toBeOnTheScreen();
  expect(screen.getByLabelText("Likes, 87")).toBeOnTheScreen();
  // Who follows, and how many drawings, stay under the name.
  expect(screen.getByText("0 drawings · 12 followers · 9 following")).toBeOnTheScreen();
  expect(
    screen.getByRole("tab", { name: "Drawings", selected: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("tab", { name: "Photos", selected: false }),
  ).toBeOnTheScreen();
});

test("from an API older than TASK-324, no totals and the drawings alone", async () => {
  await showPage(older);
  expect(screen.queryByTestId("profile-stats")).toBeNull();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.getByRole("header", { name: "Drawings" })).toBeOnTheScreen();
});

async function showHome() {
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: URL,
        account: { state: signedIn, sessionEnded: jest.fn() },
        openProfile: jest.fn(),
      }}
    >
      <ProfileHome
        user={session.user as User}
        favorites={2}
        activities={5}
        onOpen={jest.fn()}
        onEdit={jest.fn()}
      />
    </FollowsContext.Provider>,
  );
}

test("one's own «Profile» shows its totals as the others see them", async () => {
  // The lists of who follows ask first; then the profile.
  const fetchFn: jest.Mock = jest.fn(async (url: string | URL | Request) =>
    String(url) === `${URL}/users/${ID}`
      ? Response.json(profile)
      : Response.json({ people: [], next: null, total: 0 }),
  );
  jest.spyOn(globalThis, "fetch").mockImplementation(fetchFn);
  try {
    await showHome();
    expect(await screen.findByLabelText("Distance, 413 km")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Photos" })).toBeOnTheScreen();
    const asked = fetchFn.mock.calls.find(
      ([url]) => String(url) === `${URL}/users/${ID}`,
    );
    expect(asked?.[1]).toMatchObject({
      method: "GET",
      headers: { Authorization: `Bearer ${session.token}` },
    });
  } finally {
    jest.restoreAllMocks();
  }
});
