import people from "@shaperoute/shared-types/fixtures/people.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { apiError } from "../account/testing";
import { IslandLayer } from "../ui/IslandLayer";
import { forgetBlocked, useBlockedNow } from "./blockedNow";
import { BLOCK_EXPLAINED, ReportMenu } from "./ReportMenu";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The «…» of a post and of a profile (TASK-121, ADR-0228): «Report» with a
// reason of the short list, «Block» after asking.

const URL = "http://api";
const TOKEN = "the-token";
const [ada] = people.people;
const DRAWING = "5f0c2a9e-81d4-4b7a-9c3e-6d2f1a0b8e57";

/** A fake API by method and path; what it was asked, in order. */
function api(answers: Record<string, () => Response>) {
  const asked: { call: string; body: unknown }[] = [];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    const call = `${init?.method ?? "GET"} ${input.replace(URL, "")}`;
    asked.push({
      call,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const answer = answers[call];
    if (answer === undefined) {
      throw new Error(`Not in this test: ${call}`);
    }
    return answer();
  });
  return { fetchFn: fetchFn as unknown as jest.Mock, asked };
}

const done = () => new Response(null, { status: 204 });

/** What «Feed» reads to hide a member's cards. */
function Probe() {
  return <Text>{useBlockedNow(ada.public_id) ? "hidden" : "shown"}</Text>;
}

async function show(fetchFn: jest.Mock) {
  const onBlocked = jest.fn();
  const onSessionEnded = jest.fn();
  await render(
    <>
      <Probe />
      <ReportMenu
        apiUrl={URL}
        token={TOKEN}
        target={{ kind: "drawing", id: DRAWING }}
        person={ada}
        onBlocked={onBlocked}
        onSessionEnded={onSessionEnded}
        fetchFn={fetchFn}
        apiKey={null}
      />
      <IslandLayer />
    </>,
  );
  return { onBlocked, onSessionEnded };
}

const open = () => fireEvent.press(screen.getByRole("button", { name: "More" }));

beforeEach(forgetBlocked);

test("closed, only the «…» is on the screen", async () => {
  const { fetchFn } = api({});
  await show(fetchFn);
  expect(screen.getByRole("button", { name: "More" })).toHaveTextContent("…");
  expect(screen.queryByText("Report")).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});

test("«Report» asks why, sends the reason, closes and the island says thanks", async () => {
  const { fetchFn, asked } = api({ "POST /reports": done });
  await show(fetchFn);
  await open();
  expect(screen.getByRole("button", { name: "Block Ada_runs" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Report" }));
  expect(
    screen.getByRole("header", { name: "Why are you reporting this?" }),
  ).toBeOnTheScreen();
  // The five reasons, in the order of the list.
  for (const reason of [
    "Spam",
    "Offensive or hateful",
    "Harassment or bullying",
    "Nudity or sexual content",
    "Something else",
  ]) {
    expect(screen.getByRole("button", { name: reason })).toBeOnTheScreen();
  }
  await fireEvent.press(screen.getByRole("button", { name: "Harassment or bullying" }));
  expect(
    await screen.findByText("Thanks for telling us. We will look at it."),
  ).toBeOnTheScreen();
  expect(asked).toEqual([
    {
      call: "POST /reports",
      body: { kind: "drawing", id: DRAWING, reason: "harassment" },
    },
  ]);
  // The sheet is gone: the thanks is in the island, over the app (TASK-388).
  expect(
    screen.queryByRole("header", { name: "Why are you reporting this?" }),
  ).toBeNull();
  expect(screen.getByTestId("island")).toHaveTextContent(
    "Thanks for telling us. We will look at it.",
  );
});

test("«Block» asks first, saying what it does", async () => {
  const { fetchFn } = api({});
  const { onBlocked } = await show(fetchFn);
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "Block Ada_runs" }));
  expect(screen.getByRole("header", { name: "Block Ada_runs?" })).toBeOnTheScreen();
  expect(screen.getByText(BLOCK_EXPLAINED)).toBeOnTheScreen();
  // «Cancel» closes the sheet, and nothing is sent.
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText(BLOCK_EXPLAINED)).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
  expect(onBlocked).not.toHaveBeenCalled();
});

test("blocked, the member is gone from what is on the screen", async () => {
  const { fetchFn, asked } = api({ [`PUT /users/${ada.public_id}/block`]: done });
  const { onBlocked } = await show(fetchFn);
  expect(screen.getByText("shown")).toBeOnTheScreen();
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "Block Ada_runs" }));
  await fireEvent.press(screen.getByRole("button", { name: "Block" }));
  await act(async () => {});
  expect(asked.map(({ call }) => call)).toEqual([`PUT /users/${ada.public_id}/block`]);
  expect(onBlocked).toHaveBeenCalledTimes(1);
  expect(screen.getByText("hidden")).toBeOnTheScreen();
  // The sheet closed by itself.
  expect(screen.queryByText(BLOCK_EXPLAINED)).toBeNull();
});

test("a block that did not go says why, and blocks nobody", async () => {
  const { fetchFn } = api({
    [`PUT /users/${ada.public_id}/block`]: () =>
      Response.json(apiError("http_error", "No profile with this id."), {
        status: 404,
      }),
  });
  const { onBlocked } = await show(fetchFn);
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "Block Ada_runs" }));
  await fireEvent.press(screen.getByRole("button", { name: "Block" }));
  expect(await screen.findByText("This is not available any more.")).toBeOnTheScreen();
  expect(onBlocked).not.toHaveBeenCalled();
});

test("an expired session ends the session", async () => {
  const { fetchFn } = api({
    "POST /reports": () => Response.json(apiError("session_expired"), { status: 401 }),
  });
  const { onSessionEnded } = await show(fetchFn);
  await open();
  await fireEvent.press(screen.getByRole("button", { name: "Report" }));
  await fireEvent.press(screen.getByRole("button", { name: "Spam" }));
  expect(
    await screen.findByText("Your session has ended. Log in again."),
  ).toBeOnTheScreen();
  expect(onSessionEnded).toHaveBeenCalledWith(TOKEN);
});
