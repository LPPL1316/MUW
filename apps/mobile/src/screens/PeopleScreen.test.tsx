import people from "@shaperoute/shared-types/fixtures/people.json";
import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { LatLon, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";

import { answers } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { forgetFeedMaps, useFeedMap } from "../feed/FeedMaps";
import { SEARCH_DELAY_MS } from "../social/PeopleSearch";
import { PeopleScreen } from "./PeopleScreen";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const [ada] = people.people;

beforeEach(() => {
  jest.useFakeTimers();
  forgetFeedMaps();
});

afterEach(() => {
  jest.useRealTimers();
});

async function show(fetchFn: jest.Mock, onBack = jest.fn()) {
  await render(
    <PeopleScreen
      apiUrl={URL}
      account={{ state: signedIn, sessionEnded: jest.fn() }}
      onBack={onBack}
      fetchFn={fetchFn}
      apiKey={null}
    />,
  );
  return onBack;
}

test("a name found opens the profile; back finds the names as they were", async () => {
  const fetchFn = answers(
    { status: 200, body: people },
    { status: 200, body: { ...publicProfile, public_id: ada.public_id } },
  );
  const onBack = await show(fetchFn);
  expect(screen.getByRole("header", { name: "Find friends" })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByPlaceholderText("Name"), "ada");
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
  });
  await fireEvent.press(screen.getByRole("button", { name: "Ada_runs" }));

  // The profile, read only: the page of TASK-116.
  expect(await screen.findByText(publicProfile.bio)).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();
  expect(fetchFn.mock.calls[1][0]).toBe(`${URL}/users/${ada.public_id}`);
  expect(screen.queryByPlaceholderText("Name")).not.toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByText(publicProfile.bio)).toBeNull();
  expect(screen.getByPlaceholderText("Name").props.value).toBe("ada");
  expect(screen.getByRole("button", { name: "Ada_runs" })).toBeOnTheScreen();
  // Nothing asked again.
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(onBack).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("behind a drawing the page is out of sight, and keeps what was typed", async () => {
  const fetchFn = jest.fn();
  const view = await render(
    <PeopleScreen
      apiUrl={URL}
      account={{ state: signedIn, sessionEnded: jest.fn() }}
      onBack={jest.fn()}
      fetchFn={fetchFn}
      apiKey={null}
    />,
  );
  await fireEvent.changeText(screen.getByPlaceholderText("Name"), "a");
  await view.rerender(
    <PeopleScreen
      apiUrl={URL}
      account={{ state: signedIn, sessionEnded: jest.fn() }}
      onBack={jest.fn()}
      hidden
      fetchFn={fetchFn}
      apiKey={null}
    />,
  );
  expect(screen.queryByPlaceholderText("Name")).not.toBeOnTheScreen();
  await view.rerender(
    <PeopleScreen
      apiUrl={URL}
      account={{ state: signedIn, sessionEnded: jest.fn() }}
      onBack={jest.fn()}
      fetchFn={fetchFn}
      apiKey={null}
    />,
  );
  expect(screen.getByPlaceholderText("Name").props.value).toBe("a");
});

test("over the big map its own page takes the maps of the drawings, not while hidden", async () => {
  const square: LatLon[] = [
    [46.06, 11.12],
    [46.06, 11.13],
    [46.07, 11.13],
    [46.06, 11.12],
  ];
  // A drawing of the profile, waiting for its map; «Feed» is not there.
  function Drawing() {
    useFeedMap("a", square, 96, 96, 8);
    return null;
  }
  const people = (hidden: boolean) => (
    <>
      <Drawing />
      <PeopleScreen
        apiUrl={URL}
        account={{ state: signedIn, sessionEnded: jest.fn() }}
        onBack={jest.fn()}
        hidden={hidden}
        fetchFn={jest.fn()}
        apiKey={null}
      />
    </>
  );
  const page = () =>
    screen.queryByTestId("feed-map-page", { includeHiddenElements: true });
  const view = await render(people(true));
  expect(page()).toBeNull();

  await view.rerender(people(false));
  const { width, height } = Dimensions.get("window");
  expect(page()?.parent).toHaveStyle({ width, height });
});
