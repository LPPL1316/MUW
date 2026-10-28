import drawings from "@shaperoute/shared-types/fixtures/drawings.json";
import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Drawing, DrawingsPage, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { answers } from "../account/testing";
import { dayLabel } from "../activities/activityText";
import type { AccountOutcome } from "../api/accounts";
import { UserProfilePage } from "../profile/UserProfilePage";
import { DrawingsContext, type DrawingsDoor } from "./drawingsDoor";
import { drawingName, DrawingsGrid } from "./DrawingsGrid";

const [HEART] = drawings.drawings as Drawing[];
const ID = publicProfile.public_id;

/** A drawing of the example, another one. */
function another(n: number): Drawing {
  return { ...HEART, id: `drawing-${n}`, title: `Drawing ${n}`, score: null };
}

/** A door whose pages are `pages`, in order. */
function door(...pages: AccountOutcome<DrawingsPage>[]) {
  const pageOf = jest.fn(async () => pages.shift() ?? null);
  const open = jest.fn();
  const value: DrawingsDoor = {
    publicKeys: new Set(),
    refreshMine: () => {},
    choiceOf: async () => null,
    choose: async () => null,
    photosOf: () => [],
    keepPhotoOf: () => false,
    removePhotoOf: () => {},
    photoSource: () => null,
    pageOf,
    opening: null,
    openProblem: null,
    open,
    opened: null,
    back: () => {},
    leave: () => {},
  };
  return { value, pageOf, open };
}

function page(
  list: Drawing[],
  next: string | null = null,
): AccountOutcome<DrawingsPage> {
  return { kind: "ok", value: { drawings: list, next, total: list.length } };
}

test("a drawing is read by its title, or by the day it was run", () => {
  expect(drawingName(HEART)).toBe("Sunday heart by the river");
  expect(drawingName({ ...HEART, title: null })).toBe(dayLabel(HEART.started_at));
  // The day, never the time of day.
  expect(dayLabel(new Date(2026, 9, 2, 8, 12).toISOString())).toBe("Fri 2 Oct 2026");
  expect(dayLabel("yesterday")).toBe("");
});

test("the drawings of a profile, three a row, without their score; a tap opens one", async () => {
  const { value, pageOf, open } = door(page([HEART, another(2)]));
  await render(
    <DrawingsContext.Provider value={value}>
      <DrawingsGrid publicId={ID} own={false} />
    </DrawingsContext.Provider>,
  );
  expect(await screen.findAllByTestId("drawing-cell")).toHaveLength(2);
  expect(pageOf).toHaveBeenCalledWith(ID, null);
  // The heart has a score (87): nobody sees it, nobody hears it.
  expect(screen.queryByText(/Score/)).toBeNull();
  expect(screen.queryByRole("button", { name: /score/ })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Drawing 2, open on the map" }),
  ).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole("button", {
      name: "Sunday heart by the river, open on the map",
    }),
  );
  expect(open).toHaveBeenCalledWith(HEART);
  expect(screen.queryByText("Show more")).toBeNull();
});

test("«Show more» brings the next page, without a drawing twice", async () => {
  const { value, pageOf } = door(
    page([HEART, another(2)], "cursor-1"),
    page([another(2), another(3)]),
  );
  await render(
    <DrawingsContext.Provider value={value}>
      <DrawingsGrid publicId={ID} own />
    </DrawingsContext.Provider>,
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getAllByTestId("drawing-cell")).toHaveLength(3));
  expect(pageOf).toHaveBeenLastCalledWith(ID, "cursor-1");
  expect(screen.queryByText("Show more")).toBeNull();
});

test("an empty profile of another says only that", async () => {
  const { value } = door(page([]));
  await render(
    <DrawingsContext.Provider value={value}>
      <DrawingsGrid publicId={ID} own={false} />
    </DrawingsContext.Provider>,
  );
  expect(await screen.findByText("No drawings yet.")).toBeOnTheScreen();
});

test("drawings that could not come can be asked again", async () => {
  const { value, pageOf } = door(
    { kind: "unreachable", url: "http://api" },
    page([HEART]),
  );
  await render(
    <DrawingsContext.Provider value={value}>
      <DrawingsGrid publicId={ID} own />
    </DrawingsContext.Provider>,
  );
  expect(
    await screen.findByText(
      "No connection. Check the network and try again. (Cannot reach the API at http://api.)",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findAllByTestId("drawing-cell")).toHaveLength(1);
  expect(pageOf).toHaveBeenCalledTimes(2);
});

test("a drawing that did not open says why", async () => {
  const { value } = door(page([HEART]));
  await render(
    <DrawingsContext.Provider
      value={{ ...value, openProblem: "This drawing is no longer public." }}
    >
      <DrawingsGrid publicId={ID} own />
    </DrawingsContext.Provider>,
  );
  expect(
    await screen.findByText("This drawing is no longer public."),
  ).toBeOnTheScreen();
});

test("another member's profile shows their drawings under it", async () => {
  const { value, pageOf } = door(page([HEART]));
  const fetchFn: jest.Mock = answers({
    status: 200,
    body: { ...publicProfile, drawings: 1 },
  });
  await render(
    <DrawingsContext.Provider value={value}>
      <UserProfilePage
        apiUrl="http://api"
        account={{
          state: { status: "signedIn", session: session as Session },
          sessionEnded: jest.fn(),
        }}
        publicId={ID}
        fetchFn={fetchFn}
        apiKey={null}
      />
    </DrawingsContext.Provider>,
  );
  expect(await screen.findByText(/^1 drawing ·/)).toBeOnTheScreen();
  expect(screen.getByText("Drawings")).toBeOnTheScreen();
  expect(await screen.findAllByTestId("drawing-cell")).toHaveLength(1);
  expect(pageOf).toHaveBeenCalledWith(ID, null);
});
