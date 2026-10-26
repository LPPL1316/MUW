import { fireEvent, render, screen } from "@testing-library/react-native";

import type { AccountEmail } from "../account/accountEmail";
import { SignInScreen, type SignInMode } from "./SignInScreen";

// «Forgot password?» under «Log in» (TASK-300): only from a server that
// sends the email, and what it says once asked is the same whoever has the
// address.

const SENT =
  "If an account has this email, a link is on its way. It works for 1 hour; look in spam too.";

type AskReset = (email: string) => Promise<string | null>;

/** «Log in» first; `on` false: a server that sends no email. */
function show({
  initialMode = "logIn",
  on = true,
  askReset = jest.fn(async () => null),
}: {
  initialMode?: SignInMode;
  on?: boolean;
  askReset?: AskReset;
} = {}) {
  const onMode = jest.fn();
  const email: AccountEmail = {
    on,
    check: jest.fn(),
    askReset,
    sendAgain: jest.fn(async () => null),
    cancelChange: jest.fn(async () => null),
  };
  const shown = render(
    <SignInScreen
      initialMode={initialMode}
      busy={false}
      problem={null}
      notice={null}
      onSignUp={jest.fn()}
      onLogIn={jest.fn()}
      onMode={onMode}
      email={email}
    />,
  );
  return { shown, askReset, onMode, email };
}

function forgot() {
  return screen.queryByRole("button", { name: "Forgot password?" });
}

test("only under «Log in»: the server is asked when «Log in» shows", async () => {
  const { shown, email } = show({ initialMode: "signUp" });
  await shown;
  expect(forgot()).toBeNull();
  // A new phone opens on «Sign up», and asks nothing more than before.
  expect(email.check).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
  expect(email.check).toHaveBeenCalled();
  expect(forgot()).toBeOnTheScreen();
});

test("not from a server that sends no email", async () => {
  await show({ on: false }).shown;
  expect(forgot()).toBeNull();
});

test("it starts from the email written, and says the same whoever has it", async () => {
  const { shown, askReset, onMode } = show();
  await shown;
  await fireEvent.changeText(screen.getByLabelText("email"), "runner@example.com");
  await fireEvent.press(forgot()!);
  // The problem of «Log in» goes with it.
  expect(onMode).toHaveBeenCalled();
  expect(screen.getByLabelText("email")).toHaveDisplayValue("runner@example.com");
  expect(
    screen.getByText(
      "Write the email of your account: we send it a link to choose a new password.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Send the link" }));
  expect(askReset).toHaveBeenCalledWith("runner@example.com");
  expect(screen.getByText(SENT)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Send the link" })).toBeNull();
  // Back where it was: «Log in», with what was written.
  await fireEvent.press(screen.getByRole("button", { name: "Back to Log in" }));
  expect(screen.getByTestId("account-submit")).toHaveTextContent("Log in");
  expect(screen.getByLabelText("email")).toHaveDisplayValue("runner@example.com");
});

test("what went wrong is said, and the address stays to try again", async () => {
  const askReset = jest.fn(
    async (): Promise<string | null> =>
      "Too many emails asked: wait a few minutes and try again.",
  );
  await show({ askReset }).shown;
  await fireEvent.press(forgot()!);
  await fireEvent.changeText(screen.getByLabelText("email"), "runner@example.com");
  await fireEvent.press(screen.getByRole("button", { name: "Send the link" }));
  expect(
    screen.getByText("Too many emails asked: wait a few minutes and try again."),
  ).toBeOnTheScreen();
  expect(screen.queryByText(SENT)).toBeNull();
  expect(screen.getByLabelText("email")).toHaveDisplayValue("runner@example.com");
});
