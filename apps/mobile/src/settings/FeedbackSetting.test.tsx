import session from "@shaperoute/shared-types/fixtures/session.json";
import { MAX_FEEDBACK_LENGTH, type Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { AccountOutcome } from "../api/accounts";
import type { AccountState } from "../account/useAccount";
import { FeedbackSetting } from "./FeedbackSetting";

const signedIn = session as Session;
const API = "https://api.example.com";
const OK: AccountOutcome<null> = { kind: "ok", value: null };

function apiError(
  code: string,
  retryAfterS: number | null = null,
): AccountOutcome<null> {
  return {
    kind: "api_error",
    code,
    message: "words of the API",
    retryAfterS,
  } as AccountOutcome<null>;
}

async function show(
  send: jest.Mock = jest.fn(async () => OK),
  { baseUrl = API, state }: { baseUrl?: string | null; state?: AccountState } = {},
) {
  const account = {
    state: state ?? { status: "signedIn" as const, session: signedIn },
    sessionEnded: jest.fn(),
  };
  await render(<FeedbackSetting account={account} send={send} baseUrl={baseUrl} />);
  return { send, account };
}

async function open() {
  await fireEvent.press(screen.getByRole("button", { name: "Send feedback" }));
}

async function write(text: string) {
  await fireEvent.changeText(screen.getByLabelText("Your message"), text);
}

async function submit() {
  await fireEvent.press(screen.getByRole("button", { name: /^Send(ing…)?$/ }));
}

test("the row is closed until tapped, then says what the message is for and what goes with it", async () => {
  await show();
  expect(screen.queryByLabelText("Your message")).toBeNull();
  await open();
  expect(screen.getByRole("button", { name: "Send feedback" })).toBeExpanded();
  expect(
    screen.getByText(
      "Ideas, problems, anything that would make MuW better: we read every message.",
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(
      "It reaches us with your username, your email and the app's version, so we can answer you.",
    ),
  ).toBeOnTheScreen();
  const field = screen.getByLabelText("Your message");
  expect(field).toHaveProp("multiline", true);
  expect(field).toHaveProp("maxLength", MAX_FEEDBACK_LENGTH);
});

test("sending gives the API the words with the session, then thanks and closes", async () => {
  const { send } = await show();
  await open();
  await write("  Love the hearts!\nMore shapes, please.  ");
  await submit();
  expect(send).toHaveBeenCalledTimes(1);
  const [url, token, request] = send.mock.calls[0];
  expect([url, token]).toEqual([API, signedIn.token]);
  expect(request.text).toBe("Love the hearts!\nMore shapes, please.");
  expect(Object.keys(request).sort()).toEqual(["app_version", "platform", "text"]);
  expect(screen.queryByLabelText("Your message")).toBeNull();
  expect(screen.getByText("Thank you! Your message reached us.")).toBeOnTheScreen();
  // Opened again, the field is empty and the thanks are gone.
  await open();
  expect(screen.getByLabelText("Your message")).toHaveDisplayValue("");
  expect(screen.queryByText("Thank you! Your message reached us.")).toBeNull();
});

test("nothing written is said before anything is sent", async () => {
  const { send } = await show();
  await open();
  await write("   ");
  await submit();
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText("Write something first.")).toBeOnTheScreen();
});

test("past the limit of the day the words stay and the page says tomorrow", async () => {
  await show(jest.fn(async () => apiError("too_many_requests", 3600)));
  await open();
  await write("One more idea");
  await submit();
  expect(
    screen.getByText("You sent a lot of feedback today. Try again tomorrow."),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Your message")).toHaveDisplayValue("One more idea");
});

test("no connection is said under «Send», the words kept", async () => {
  await show(jest.fn(async () => ({ kind: "unreachable", url: API })));
  await open();
  await write("Hello");
  await submit();
  expect(
    screen.getByText(/^No connection\. Check the network and try again\./),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Your message")).toHaveDisplayValue("Hello");
});

test("a session over signs out, as everywhere", async () => {
  const { account } = await show(jest.fn(async () => apiError("session_expired")));
  await open();
  await write("Hello");
  await submit();
  expect(account.sessionEnded).toHaveBeenCalledWith(signedIn.token);
});

test("an app without the address of its service says so and sends nothing", async () => {
  const { send } = await show(undefined, { baseUrl: null });
  await open();
  await write("Hello");
  await submit();
  expect(send).not.toHaveBeenCalled();
  expect(
    screen.getByText("The app cannot reach the service. Update the app."),
  ).toBeOnTheScreen();
});

test("a second tap while the first is on its way sends nothing more", async () => {
  let answer: (outcome: AccountOutcome<null>) => void = () => {};
  const send = jest.fn(
    () =>
      new Promise<AccountOutcome<null>>((resolve) => {
        answer = resolve;
      }),
  );
  await show(send);
  await open();
  await write("Hello");
  await submit();
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await submit();
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => answer(OK));
  expect(screen.getByText("Thank you! Your message reached us.")).toBeOnTheScreen();
});

test("closed without sending, the words wait for the next tap", async () => {
  await show();
  await open();
  await write("Half an idea");
  await open();
  expect(screen.queryByLabelText("Your message")).toBeNull();
  await open();
  expect(screen.getByLabelText("Your message")).toHaveDisplayValue("Half an idea");
});
