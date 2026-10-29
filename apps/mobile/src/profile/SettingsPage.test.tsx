import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { answers } from "../account/testing";
import type { Account } from "../account/useAccount";
import { saveLanguageChoice } from "../i18n/language";
import { useLanguage } from "../i18n/useLanguage";
import { SettingsPage } from "./SettingsPage";

// «Push notifications» asks the phone first (TASK-262): the phone faked.
jest.mock("expo-notifications");

const signedIn = session as Session;

/** The page under a root that follows the language, as in the app (TASK-210). */
function AsInTheApp(props: ComponentProps<typeof SettingsPage>) {
  useLanguage();
  return <SettingsPage {...props} />;
}

/** What «Settings» asks «Profile» to open (TASK-184). */
const onAbout = jest.fn();

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
  onAbout.mockClear();
});

async function show(
  over: Partial<Account> = {},
  feedbackApi?: ComponentProps<typeof SettingsPage>["feedbackApi"],
) {
  const account: Account = {
    state: { status: "signedIn", session: signedIn },
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
    ...over,
  };
  await render(
    <AsInTheApp
      user={signedIn.user}
      account={account}
      onAbout={onAbout}
      feedbackApi={feedbackApi}
    />,
  );
  return account;
}

test("the account, by name and email", async () => {
  await show();
  expect(screen.getByText("ACCOUNT")).toBeOnTheScreen();
  expect(screen.getByText("Runner_42")).toBeOnTheScreen();
  expect(screen.getByText("runner@example.com")).toBeOnTheScreen();
});

test("every row works: only «Paragliding» says «Soon»", async () => {
  await show();
  // The notifications were the last settings to come (TASK-185). The bike
  // (TASK-190) and paddling (TASK-191) are ready in «Sport» (TASK-189);
  // paragliding is the one sport to come (TASK-305 D0).
  expect(screen.getAllByText("Soon")).toHaveLength(1);
  expect(screen.getAllByLabelText(/coming soon$/)).toHaveLength(1);
  expect(screen.getByLabelText("Paragliding, coming soon")).toBeOnTheScreen();
  // The picture (TASK-178), the email and the phone number (TASK-183), the
  // language (TASK-210), «Add a place» (TASK-334), the units (TASK-182),
  // the tone (TASK-263), the three texts of «ABOUT» (TASK-184) and the ways
  // out are buttons. «Send feedback» waits for a server that takes it
  // (TASK-308, below).
  expect(screen.getAllByRole("button")).toHaveLength(12);
  expect(screen.getByRole("button", { name: "Profile picture" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Change email" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Phone number, Add" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Language, English" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Units, Kilometres" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Tone, Dark" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Log out" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Delete account" })).toBeOnTheScreen();
});

test("on a server that takes feedback, «Send feedback» has its own section (TASK-308)", async () => {
  const fetchFn: jest.Mock = answers({ status: 204 });
  await show({}, { baseUrl: "http://api", fetchFn, key: null });
  const row = await screen.findByRole("button", { name: "Send feedback" });
  expect(screen.getByText("FEEDBACK")).toBeOnTheScreen();
  expect(fetchFn.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
    ["http://api/feedback", "GET"],
  ]);
  expect(row).not.toBeExpanded();
  await fireEvent.press(row);
  expect(row).toBeExpanded();
  expect(screen.getByLabelText("Your message")).toHaveDisplayValue("");
});

test("on the server of today, which answers 404, there is no «FEEDBACK» to write in (TASK-308)", async () => {
  const fetchFn: jest.Mock = answers({ status: 404, body: { detail: "Not Found" } });
  await show({}, { baseUrl: "http://api", fetchFn, key: null });
  await act(async () => {});
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("FEEDBACK")).toBeNull();
  expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(12);
});

test("without a network nothing is shown either (TASK-308)", async () => {
  const fetchFn: jest.Mock = answers(new TypeError("offline"));
  await show({}, { baseUrl: "http://api", fetchFn, key: null });
  await act(async () => {});
  expect(screen.queryByText("FEEDBACK")).toBeNull();
});

test("«Help», «Terms» and «Privacy» are rows that open their page (TASK-184)", async () => {
  await show();
  expect(screen.getByText("ABOUT")).toBeOnTheScreen();
  for (const name of ["Help", "Terms", "Privacy"]) {
    expect(screen.queryByLabelText(`${name}, coming soon`)).toBeNull();
  }
  await fireEvent.press(screen.getByRole("button", { name: "Help" }));
  await fireEvent.press(screen.getByRole("button", { name: "Terms" }));
  await fireEvent.press(screen.getByRole("button", { name: "Privacy" }));
  expect(onAbout.mock.calls).toEqual([["help"], ["terms"], ["privacy"]]);
});

test("the notifications are three switches kept in the account, email and push off at first (TASK-185, TASK-284)", async () => {
  const account = await show({ changeNotifications: jest.fn(async () => null) });
  expect(screen.getByText("NOTIFICATIONS")).toBeOnTheScreen();
  const email = screen.getByRole("switch", { name: "Email notifications" });
  const push = screen.getByRole("switch", { name: "Push notifications" });
  expect(screen.getAllByRole("switch")).toHaveLength(3);
  expect(email).not.toBeChecked();
  expect(push).not.toBeChecked();
  expect(screen.getByRole("switch", { name: "Email when I'm away" })).toBeChecked();
  // The page says what push and the emails send (TASK-262, TASK-284).
  expect(
    screen.getByText(
      "Push notifications tell you at once about follow requests, reactions, comments and tags. Email notifications sends the same news in one email a day at most. Email when I'm away: one email if you don't open MuW for 2 weeks.",
    ),
  ).toBeOnTheScreen();
  // The phone allows them when asked (the mock of expo-notifications).
  await fireEvent.press(push);
  expect(account.changeNotifications).toHaveBeenCalledWith({ push: true });
  await fireEvent.press(email);
  expect(account.changeNotifications).toHaveBeenLastCalledWith({ email: true });
});

test("«Change email» and «Phone number» ask the account (TASK-183)", async () => {
  const account = await show({
    changeEmail: jest.fn(async () => null),
    changePhone: jest.fn(async () => null),
  });
  await fireEvent.press(screen.getByRole("button", { name: "Change email" }));
  await fireEvent.changeText(screen.getByLabelText("new email"), "new@example.com");
  await fireEvent.changeText(screen.getByLabelText("password"), "the password");
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(account.changeEmail).toHaveBeenCalledWith({
    email: "new@example.com",
    password: "the password",
  });
  await fireEvent.press(screen.getByRole("button", { name: "Phone number, Add" }));
  await fireEvent.changeText(screen.getByLabelText("phone number"), "+39 333 123 4567");
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(account.changePhone).toHaveBeenCalledWith({ phone: "+393331234567" });
});

test("«Sport» has «Run» chosen, «Bike» and «Paddle» to choose", async () => {
  await show();
  expect(screen.getByText("SPORT")).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "Run" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Bike" })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: "Paddle" })).not.toBeChecked();
});

test("«Log out» logs out at once", async () => {
  const account = await show();
  await fireEvent.press(screen.getByRole("button", { name: "Log out" }));
  expect(account.signOut).toHaveBeenCalledTimes(1);
});

test("«Delete account» asks first; «Keep my account» goes back", async () => {
  const account = await show();
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(screen.getByText(/^Delete your account\?/)).toBeOnTheScreen();
  expect(account.deleteAccount).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Keep my account" }));
  expect(screen.queryByText(/^Delete your account\?/)).toBeNull();
  expect(account.clearProblem).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  await fireEvent.press(screen.getByRole("button", { name: "Delete my account" }));
  expect(account.deleteAccount).toHaveBeenCalledTimes(1);
});

test("while deleting, nothing else can be pressed, and a failure is said", async () => {
  await show({ busy: "delete", problem: "The API did not answer." });
  expect(screen.getByRole("button", { name: "Log out" })).toBeDisabled();
  expect(screen.getByText("The API did not answer.")).toBeOnTheScreen();
});

test("«Language» is among the preferences and turns the whole page at once (TASK-210)", async () => {
  await show();
  expect(screen.getByText("PREFERENCES")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Language, English" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Deutsch" }));
  expect(screen.getByText("PRÄFERENZEN")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Sprache, Deutsch" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Abmelden" })).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "Einheiten, Kilometer" }),
  ).toBeOnTheScreen();
  expect(screen.getByText("BENACHRICHTIGUNGEN")).toBeOnTheScreen();
  expect(
    screen.getByRole("switch", { name: "Push-Benachrichtigungen" }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Hilfe" })).toBeOnTheScreen();
  expect(screen.queryByText("Log out")).toBeNull();
  // The account's own words are not translated.
  expect(screen.getByText("Runner_42")).toBeOnTheScreen();
});
