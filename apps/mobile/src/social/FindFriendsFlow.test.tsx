import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import drawings from "@shaperoute/shared-types/fixtures/drawings.json";
import people from "@shaperoute/shared-types/fixtures/people.json";
import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import type { MemorySecureStore } from "../account/testing";
import { OwnProfile, ProfileLayer } from "../screens/ProfileLayer";
import { useDrawingsDoor } from "./drawingsDoor";
import { FindFriendsButton } from "./FindFriendsButton";

// «Find friends» as the app has it (TASK-215): the button of «Feed» opens
// the search over the app, a name opens the profile, and a drawing opened
// from that profile comes back to it.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../account/testing")>("../account/testing")
    .memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const KEY = "shaperoute.session";
const [ada] = people.people;
const ADA = { ...publicProfile, public_id: ada.public_id, drawings: 1 };

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The fake API, by method and path; the rest is out of reach. */
function api(answers: Record<string, () => Response>) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const answer = answers[`${init?.method ?? "GET"} ${path}`];
    if (answer === undefined) {
      throw new Error(`Not in this test: ${init?.method ?? "GET"} ${path}`);
    }
    return answer();
  });
}

/** The map, as far as a drawing opened goes: its way back. */
function Map() {
  const { opened, back } = useDrawingsDoor();
  if (opened === null) {
    return null;
  }
  return (
    <Pressable onPress={back} accessibilityRole="button">
      <Text>Back from {opened.title}</Text>
    </Pressable>
  );
}

async function showFeed() {
  await render(
    <ProfileLayer apiUrl={API}>
      <FindFriendsButton />
      <Map />
    </ProfileLayer>,
  );
}

beforeEach(() => {
  store.kept.clear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("from «Feed» to a friend's drawing and back to their profile", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  api({
    "GET /me": () => Response.json(session.user),
    "GET /users?q=ada": () => Response.json(people),
    [`GET /users/${ada.public_id}`]: () => Response.json(ADA),
    [`GET /users/${ada.public_id}/drawings`]: () => Response.json(drawings),
    [`GET /drawings/${drawing.id}`]: () => Response.json(drawing),
  });
  await showFeed();
  await fireEvent.press(screen.getByRole("button", { name: "Find friends" }));
  expect(screen.getByRole("header", { name: "Find friends" })).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByPlaceholderText("Name"), "ada");
  await fireEvent.press(await screen.findByRole("button", { name: "Ada_runs" }));
  expect(await screen.findByText(ADA.bio)).toBeOnTheScreen();

  await fireEvent.press(await screen.findByRole("button", { name: /^Sunday heart/ }));
  // The map: the search is out of sight, kept behind it.
  await fireEvent.press(
    await screen.findByRole("button", { name: `Back from ${drawing.title}` }),
  );
  expect(screen.getByText(ADA.bio)).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();

  // Back twice: the names found, then «Feed».
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Ada_runs" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Find friends" })).toBeNull();
  expect(screen.getByRole("button", { name: "Find friends" })).toBeOnTheScreen();
});

test("without an account, the page of the profile comes first and says why", async () => {
  api({});
  await render(
    <ProfileLayer apiUrl={API}>
      <FindFriendsButton />
      {/* The fourth page of the pager (TASK-278 part B). */}
      <OwnProfile active />
    </ProfileLayer>,
  );
  expect(screen.queryByText("Log in to find your friends.")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Find friends" }));
  expect(await screen.findByText("Log in to find your friends.")).toBeOnTheScreen();
  expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
  expect(screen.queryByPlaceholderText("Name")).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
});
