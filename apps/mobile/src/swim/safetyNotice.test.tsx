import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { forgetNoticeSeen, markNoticeSeen, noticeSeen } from "../paddle/safetyNotice";

import {
  forgetSwimNoticeSeen,
  markSwimNoticeSeen,
  SWIM_NOTICE_FILE,
  swimNoticeSeen,
  useSwimNotice,
} from "./safetyNotice";
import { SWIM_NOTICE_LINES, SWIM_NOTICE_TITLE, SwimNotice } from "./SwimNotice";
import { SWIM_ROUTE_NOTE, SwimRouteNote } from "./SwimRouteNote";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The phone's documents folder, in memory: what is written stays there for
// the next read, as after closing the app.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  const state = { failing: false };
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      if (state.failing) {
        throw new Error("No space left on device");
      }
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } }, files, state };
});

const disk = jest.requireMock<{
  files: Map<string, string>;
  state: { failing: boolean };
}>("expo-file-system");
const NOTICE_URI = `file:///documents/${SWIM_NOTICE_FILE}`;

beforeEach(() => {
  disk.files.clear();
  disk.state.failing = false;
  forgetSwimNoticeSeen();
  forgetNoticeSeen();
});

afterEach(() => saveLanguageChoice("phone"));

test("not read on a new phone; read, it stays read at the next opening", () => {
  expect(swimNoticeSeen()).toBe(false);
  markSwimNoticeSeen();
  expect(disk.files.get(NOTICE_URI)).toBe('{"seen":true}');
  forgetSwimNoticeSeen();
  expect(swimNoticeSeen()).toBe(true);
});

test("the paddle's notice read is not the swim's, nor the other way round", () => {
  markNoticeSeen();
  expect(swimNoticeSeen()).toBe(false);
  forgetNoticeSeen();
  disk.files.clear();
  markSwimNoticeSeen();
  expect(noticeSeen()).toBe(false);
});

test("a file that does not read is a notice not read", () => {
  for (const text of ["", "not json", "null", "true", '{"seen":"yes"}', "{}"]) {
    disk.files.set(NOTICE_URI, text);
    forgetSwimNoticeSeen();
    expect(swimNoticeSeen()).toBe(false);
  }
});

test("a phone that refuses to write keeps it read until the app closes", () => {
  disk.state.failing = true;
  expect(() => markSwimNoticeSeen()).not.toThrow();
  expect(swimNoticeSeen()).toBe(true);
  forgetSwimNoticeSeen();
  expect(swimNoticeSeen()).toBe(false);
});

test("the first «Start» waits for «I understand», the next ones go at once", async () => {
  const start = jest.fn();
  const { result } = await renderHook(() => useSwimNotice());
  await act(async () => result.current.ask(start));
  expect(result.current.asking).toBe(true);
  expect(start).not.toHaveBeenCalled();
  await act(async () => result.current.accept());
  expect(result.current.asking).toBe(false);
  expect(start).toHaveBeenCalledTimes(1);
  expect(swimNoticeSeen()).toBe(true);

  await act(async () => result.current.ask(start));
  expect(result.current.asking).toBe(false);
  expect(start).toHaveBeenCalledTimes(2);
});

test("«Not now» starts nothing and asks again at the next «Start»", async () => {
  const start = jest.fn();
  const { result } = await renderHook(() => useSwimNotice());
  await act(async () => result.current.ask(start));
  await act(async () => result.current.dismiss());
  expect(result.current.asking).toBe(false);
  expect(start).not.toHaveBeenCalled();
  expect(swimNoticeSeen()).toBe(false);
  await act(async () => result.current.ask(start));
  expect(result.current.asking).toBe(true);
});

test("the notice says the four things the user approved, with «I understand» and «Not now»", async () => {
  const onAccept = jest.fn();
  const onDismiss = jest.fn();
  await render(<SwimNotice visible onAccept={onAccept} onDismiss={onDismiss} />);
  expect(SWIM_NOTICE_TITLE).toBe("Before you swim");
  expect(screen.getByText(SWIM_NOTICE_TITLE)).toBeOnTheScreen();
  // The emoji is for the eyes only.
  expect(screen.getByText("🏊", { includeHiddenElements: true })).toBeOnTheScreen();
  expect(SWIM_NOTICE_LINES).toEqual([
    "Never swim alone. Tow a bright swim buoy and wear a bright cap.",
    "Check the water, the weather, the flags and the local rules: swimming areas, boat lanes, harbours. MuW does not know them.",
    "The route stays between 20 and 150 m from the shore. That does not make it safe or allowed.",
    "If you feel tired or cold, head for the shore at once.",
  ]);
  for (const line of SWIM_NOTICE_LINES) {
    expect(screen.getByText(line)).toBeOnTheScreen();
  }
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  expect(onAccept).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Not now" }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test("hidden, the notice shows nothing", async () => {
  await render(
    <SwimNotice visible={false} onAccept={jest.fn()} onDismiss={jest.fn()} />,
  );
  expect(screen.queryByText(SWIM_NOTICE_TITLE)).toBeNull();
});

test("the notice and the line under the route speak Italian", async () => {
  await act(async () => saveLanguageChoice("it"));
  await render(<SwimNotice visible onAccept={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.getByText("Prima di nuotare")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Ho capito" })).toBeOnTheScreen();
  await render(<SwimRouteNote />);
  expect(
    screen.getByText("Entro 150 m dalla riva. Non nuotare mai da solo."),
  ).toBeOnTheScreen();
});

test("under every swim, the line the user approved", async () => {
  expect(SWIM_ROUTE_NOTE).toBe("Within 150 m of the shore. Never swim alone.");
  await render(<SwimRouteNote />);
  expect(screen.getByText(SWIM_ROUTE_NOTE)).toBeOnTheScreen();
});
