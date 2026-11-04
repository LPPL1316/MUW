import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import type { Account } from "../account/useAccount";
import { saveLanguageChoice } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { type ProfilePage, ProfileScreen } from "../screens/ProfileScreen";
import { askTour } from "./useTour";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("./useTour", () => ({ askTour: jest.fn() }));

const signedIn = session as Session;

function account(state: Account["state"]): Account {
  return {
    state,
    busy: null,
    problem: null,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    editProfile: jest.fn(),
    changeEmail: jest.fn(),
    changePhone: jest.fn(),
    changeNotifications: jest.fn(),
    clearProblem: jest.fn(),
    sessionEnded: jest.fn(),
  };
}

const pages: ProfilePage[] = [];
const onBack = jest.fn();

/** «Profile» as the layer keeps it: the page it is asked for is the page. */
function Profile({ of, first }: { of: Account; first: ProfilePage }) {
  useLanguage();
  const [page, setPage] = useState<ProfilePage>(first);
  return (
    <ProfileScreen
      account={of}
      page={page}
      onPage={(next) => {
        pages.push(next);
        setPage(next);
      }}
      hint={null}
      onBack={onBack}
    />
  );
}

const SIGNED_OUT = account({ status: "signedOut", notice: null });
const SIGNED_IN = account({ status: "signedIn", session: signedIn });

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
  pages.length = 0;
  onBack.mockClear();
  jest.mocked(askTour).mockClear();
});

test.each([
  ["without an account", SIGNED_OUT],
  ["with an account", SIGNED_IN],
] as const)(
  "«Guide» on the first page of «Profile» %s opens the guide",
  async (_, of) => {
    await render(<Profile of={of} first="account" />);
    await fireEvent.press(screen.getByRole("button", { name: "Guide" }));
    expect(pages).toEqual(["help"]);
    // Named as its row, then the text's own title.
    expect(screen.getByRole("header", { name: "Guide" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "How MuW works" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Watch the tour" })).toBeOnTheScreen();
    // «←» comes back to the first page, not to «Settings».
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(pages).toEqual(["help", "account"]);
    expect(screen.getByRole("button", { name: "Guide" })).toBeOnTheScreen();
    expect(onBack).not.toHaveBeenCalled();
  },
);

test("with an account «Settings» is the gear at the top, «Guide» a row under it", async () => {
  await render(<Profile of={SIGNED_IN} first="account" />);
  const names = screen
    .getAllByRole("button")
    .map((button) => button.props.accessibilityLabel as string | undefined);
  // The gear at the top right (TASK-367), before the rows; «Guide» further down.
  expect(names.indexOf("Settings")).toBeGreaterThanOrEqual(0);
  expect(names.indexOf("Settings")).toBeLessThan(names.indexOf("Guide"));
  expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Guide" })).toHaveLength(1);
});

test("without an account «Guide» is the last row, under the form", async () => {
  await render(<Profile of={SIGNED_OUT} first="account" />);
  const names = screen
    .getAllByRole("button")
    .map((button) => button.props.accessibilityLabel as string | undefined);
  expect(names[names.length - 1]).toBe("Guide");
});

test("«Watch the tour» closes «Profile» and asks for the tour", async () => {
  await render(<Profile of={SIGNED_OUT} first="account" />);
  await fireEvent.press(screen.getByRole("button", { name: "Guide" }));
  await fireEvent.press(screen.getByRole("button", { name: "Watch the tour" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(askTour).toHaveBeenCalledTimes(1);
});

test("«Help» in «Settings» offers the tour too, and goes back to «Settings»", async () => {
  await render(<Profile of={SIGNED_IN} first="settings" />);
  // Inside «Settings» there is no «Guide» row: «Help» is there.
  expect(screen.queryByRole("button", { name: "Guide" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Help" }));
  expect(screen.getByRole("header", { name: "Help" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Watch the tour" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(pages).toEqual(["help", "settings"]);
});

test("without an account the guide stays open; «Terms» still needs one", async () => {
  await render(<Profile of={SIGNED_OUT} first="help" />);
  expect(pages).toEqual([]);
  expect(screen.getByRole("header", { name: "How MuW works" })).toBeOnTheScreen();
});

test("in Italian the row is «Guida» and the button «Rivedi il tour»", async () => {
  await act(async () => saveLanguageChoice("it"));
  await render(<Profile of={SIGNED_OUT} first="account" />);
  await fireEvent.press(screen.getByRole("button", { name: "Guida" }));
  expect(screen.getByRole("header", { name: "Guida" })).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "Come funziona MuW" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Rivedi il tour" })).toBeOnTheScreen();
});
