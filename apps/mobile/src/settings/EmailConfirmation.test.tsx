import session from "@shaperoute/shared-types/fixtures/session.json";
import type { User } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import type { AccountEmail } from "../account/accountEmail";
import { EmailSetting } from "./EmailSetting";

// Under «Change email» (TASK-300): an address not confirmed, or a new one
// waiting for its link, from a server that sends these emails only.

const NOT_CONFIRMED = { ...session.user, email_confirmed: false } as User;
const CONFIRMED = { ...session.user, email_confirmed: true } as User;
const WAITING = {
  ...CONFIRMED,
  pending_email: "runner.new@example.com",
} as User;

function emails(changes: Partial<AccountEmail> = {}): AccountEmail {
  return {
    on: true,
    check: jest.fn(),
    askReset: jest.fn(async () => null),
    sendAgain: jest.fn(async () => null),
    cancelChange: jest.fn(async () => null),
    ...changes,
  };
}

async function show(user: User, email: AccountEmail | undefined = emails()) {
  const changeEmail = jest.fn(async () => null);
  const shown = await render(
    <EmailSetting user={user} account={{ changeEmail, email }} />,
  );
  return { shown, changeEmail, email };
}

test("the server is asked once whether it sends these emails", async () => {
  const email = emails({ on: false });
  await show(NOT_CONFIRMED, email);
  expect(email.check).toHaveBeenCalled();
  // Off: nothing said, nothing to tap.
  expect(screen.queryByText("Email not confirmed")).toBeNull();
});

test("an address not confirmed says so, and sends the link again", async () => {
  const { email } = await show(NOT_CONFIRMED);
  expect(screen.getByText("Email not confirmed")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Send the link again" }));
  expect(email?.sendAgain).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText("Link sent to runner@example.com. Look in spam too."),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Cancel change" })).toBeNull();
});

test("a confirmed address says nothing", async () => {
  await show(CONFIRMED);
  expect(screen.queryByText("Email not confirmed")).toBeNull();
  expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
});

test("an account of an API before TASK-300 says nothing", async () => {
  const { email_confirmed: _no, pending_email: _none, ...before } = session.user;
  await show(before as User);
  expect(screen.queryByText("Email not confirmed")).toBeNull();
});

test("a new address waits: sent again, or the change dropped", async () => {
  const { email } = await show(WAITING);
  expect(
    screen.getByText(
      "Waiting for runner.new@example.com: open the link we sent there.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Send again" }));
  expect(
    screen.getByText("Link sent to runner.new@example.com. Look in spam too."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel change" }));
  expect(email?.cancelChange).toHaveBeenCalledTimes(1);
});

test("what went wrong is said where the buttons are", async () => {
  await show(
    NOT_CONFIRMED,
    emails({
      sendAgain: jest.fn(
        async () => "Too many emails asked: wait a few minutes and try again.",
      ),
    }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Send the link again" }));
  expect(
    screen.getByText("Too many emails asked: wait a few minutes and try again."),
  ).toBeOnTheScreen();
});

test("right after «Change email», the line says where the link went", async () => {
  const { shown, changeEmail } = await show(CONFIRMED);
  await fireEvent.press(screen.getByRole("button", { name: "Change email" }));
  await fireEvent.changeText(
    screen.getByLabelText("new email"),
    "Runner.New@example.com",
  );
  await fireEvent.changeText(
    screen.getByLabelText("password"),
    "correct horse battery",
  );
  await fireEvent.press(screen.getByRole("button", { name: /^Sav/ }));
  expect(changeEmail).toHaveBeenCalled();
  // The account comes back from the API with the address waiting.
  await shown.rerender(
    <EmailSetting user={WAITING} account={{ changeEmail, email: emails() }} />,
  );
  expect(
    screen.getByText(
      "We sent a link to runner.new@example.com. Your email changes when you open it.",
    ),
  ).toBeOnTheScreen();
});
