import { fireEvent, render, screen } from "@testing-library/react-native";

import { SignInScreen, type SignInMode } from "./SignInScreen";

function show({
  initialMode = "signUp",
  busy = false,
  problem = null,
  notice = null,
}: {
  initialMode?: SignInMode;
  busy?: boolean;
  problem?: string | null;
  notice?: { text: string; tone: "warning" | "muted" } | null;
} = {}) {
  const onSignUp = jest.fn();
  const onLogIn = jest.fn();
  const onMode = jest.fn();
  const shown = render(
    <SignInScreen
      initialMode={initialMode}
      busy={busy}
      problem={problem}
      notice={notice}
      onSignUp={onSignUp}
      onLogIn={onLogIn}
      onMode={onMode}
    />,
  );
  return { shown, onSignUp, onLogIn, onMode };
}

/** The button at the foot of the form, not the tab of the same name. */
function submit() {
  return screen.getByTestId("account-submit");
}

test("signing up sends what was typed, with the box ticked", async () => {
  const { shown, onSignUp } = show();
  await shown;
  await fireEvent.changeText(screen.getByLabelText("email"), "runner@example.com");
  await fireEvent.changeText(screen.getByLabelText("username"), "Runner_42");
  await fireEvent.changeText(
    screen.getByLabelText("password"),
    "correct horse battery",
  );
  const box = screen.getByRole("checkbox", {
    name: "I am at least 16",
    checked: false,
  });
  await fireEvent.press(box);
  expect(
    screen.getByRole("checkbox", { name: "I am at least 16", checked: true }),
  ).toBe(box);
  await fireEvent.press(submit());
  expect(onSignUp).toHaveBeenCalledWith({
    email: "runner@example.com",
    username: "Runner_42",
    password: "correct horse battery",
    atLeast16: true,
    noAwayEmail: false,
  });
});

test("the email when away is said, and its box starts unticked (TASK-284)", async () => {
  const { shown, onSignUp } = show();
  await shown;
  expect(
    screen.getByText(
      "If you don't open MuW for 2 weeks, we email you once with what's new.",
    ),
  ).toBeOnTheScreen();
  const box = screen.getByRole("checkbox", {
    name: "Don't send me these emails",
    checked: false,
  });
  await fireEvent.press(box);
  await fireEvent.press(submit());
  expect(onSignUp).toHaveBeenCalledWith(expect.objectContaining({ noAwayEmail: true }));
});

test("the box unticked is sent as it is: the account says why not", async () => {
  const { shown, onSignUp } = show();
  await shown;
  await fireEvent.press(submit());
  expect(onSignUp).toHaveBeenCalledWith({
    email: "",
    username: "",
    password: "",
    atLeast16: false,
    noAwayEmail: false,
  });
});

test("«Log in» asks only for email and password", async () => {
  const { shown, onLogIn, onMode, onSignUp } = show();
  await shown;
  await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
  expect(onMode).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("username")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("email"), "runner@example.com");
  await fireEvent.changeText(screen.getByLabelText("password"), "secret password");
  await fireEvent(screen.getByLabelText("password"), "submitEditing");
  expect(onLogIn).toHaveBeenCalledWith({
    email: "runner@example.com",
    password: "secret password",
  });
  await fireEvent.press(submit());
  expect(onLogIn).toHaveBeenCalledTimes(2);
  expect(onSignUp).not.toHaveBeenCalled();
});

test("the chosen form again is not a change", async () => {
  const { shown, onMode } = show({ initialMode: "logIn" });
  await shown;
  expect(screen.getByRole("button", { name: "Log in", selected: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Log in", selected: true }));
  expect(onMode).not.toHaveBeenCalled();
});

test("while waiting the button says so and sends nothing", async () => {
  const { shown, onSignUp } = show({ busy: true });
  await shown;
  expect(screen.getByText("Signing up…")).toBeTruthy();
  await fireEvent.press(submit());
  expect(onSignUp).not.toHaveBeenCalled();
});

test("the problem and the notice are on the screen", async () => {
  const { shown } = show({
    initialMode: "logIn",
    problem: "Wrong email or password.",
    notice: { text: "Your session has ended. Log in again.", tone: "warning" },
  });
  await shown;
  expect(screen.getByText("Wrong email or password.")).toBeTruthy();
  expect(screen.getByText("Your session has ended. Log in again.")).toBeTruthy();
});
