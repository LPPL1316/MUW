import personalBests from "@shaperoute/shared-types/fixtures/personal-bests.json";
import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { PersonalBest, PublicProfile, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { answers } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { ActivitiesContext, type ActivitiesDoor } from "../activities/activitiesDoor";
import { DrawingsContext, type DrawingsDoor } from "../social/drawingsDoor";
import { bestTime, distanceName, PersonalBests } from "./PersonalBests";
import { UserProfilePage } from "./UserProfilePage";

// The personal bests of a profile (TASK-368): on foot, then by bike, the
// time and the day; a best opens its run only for who may see it.

const examples = personalBests as PersonalBest[];
const [fiveK, half, fortyK] = examples;

function doors() {
  const openDrawing = jest.fn();
  const openRun = jest.fn();
  const drawings = { open: openDrawing } as unknown as DrawingsDoor;
  const activities = { open: openRun } as unknown as ActivitiesDoor;
  return { openDrawing, openRun, drawings, activities };
}

async function show(bests: PersonalBest[]) {
  const all = doors();
  await render(
    <DrawingsContext.Provider value={all.drawings}>
      <ActivitiesContext.Provider value={all.activities}>
        <PersonalBests bests={bests} />
      </ActivitiesContext.Provider>
    </DrawingsContext.Provider>,
  );
  return all;
}

test("the distances are named as races on foot, in kilometres by bike", () => {
  expect(distanceName({ sport: "running", distance: "5k" })).toBe("5K");
  expect(distanceName({ sport: "running", distance: "half" })).toBe("Half marathon");
  expect(distanceName({ sport: "running", distance: "marathon" })).toBe("Marathon");
  expect(distanceName({ sport: "cycling", distance: "160k" })).toBe("160 km");
  expect(bestTime(1394)).toBe("23:14");
  expect(bestTime(6618)).toBe("1:50:18");
});

test("on foot, then by bike, each by distance, with its time and its day", async () => {
  // Out of order: the profile puts them in the order of the distances.
  await show([fortyK, half, fiveK]);
  const box = screen.getByTestId("personal-bests");
  expect(within(box).getByRole("header", { name: "Personal bests" })).toBeOnTheScreen();
  const texts = within(box)
    .getAllByText(/^(RUN|BIKE|5K|Half marathon|40 km)$/)
    .map((node) => node.props.children);
  expect(texts).toEqual(["RUN", "5K", "Half marathon", "BIKE", "40 km"]);
  expect(screen.getByText("1:50:18")).toBeOnTheScreen();
  expect(screen.getByText("Sun 27 Sep 2026")).toBeOnTheScreen();
});

test("a best of a run who looks cannot see is read, never opened", async () => {
  const { openDrawing, openRun } = await show([fiveK]);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByLabelText("5K, 23:14, Sun 18 Oct 2026")).toBeOnTheScreen();
  expect(openDrawing).not.toHaveBeenCalled();
  expect(openRun).not.toHaveBeenCalled();
});

test("the drawing opens for who may see it, the run for its owner", async () => {
  const { openDrawing, openRun } = await show([
    half,
    { ...fortyK, key: "a1b2c3d4e5f60718" },
  ]);
  await fireEvent.press(screen.getByRole("button", { name: /^Half marathon, / }));
  expect(openDrawing).toHaveBeenCalledWith({ id: half.drawing });
  await fireEvent.press(screen.getByRole("button", { name: /^40 km, / }));
  expect(openRun).toHaveBeenCalledWith({ id: "a1b2c3d4e5f60718" });
});

test("no best, no box; a sport without one has no group", async () => {
  await show([]);
  expect(screen.queryByTestId("personal-bests")).toBeNull();
  await show([fiveK]);
  expect(screen.queryByText("BIKE")).toBeNull();
});

test("another member's profile shows its bests under the totals; an older API none", async () => {
  const signedIn: AccountState = { status: "signedIn", session: session as Session };
  const profile = publicProfile as PublicProfile;
  async function page(body: unknown) {
    await render(
      <UserProfilePage
        apiUrl="http://api"
        account={{ state: signedIn, sessionEnded: jest.fn() }}
        publicId={profile.public_id}
        fetchFn={answers({ status: 200, body }) as jest.Mock}
        apiKey={null}
      />,
    );
    expect(await screen.findByText("Ada_runs")).toBeOnTheScreen();
  }
  await page({ ...profile, personal_bests: examples });
  expect(screen.getByTestId("personal-bests")).toBeOnTheScreen();
  const { personal_bests: _bests, ...older } = profile;
  await page(older);
  expect(screen.queryByTestId("personal-bests")).toBeNull();
});
