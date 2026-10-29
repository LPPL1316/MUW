import { readFileSync } from "fs";
import { join } from "path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import {
  ActivitiesContext,
  type ActivitiesDoor,
  useActivitiesDoor,
} from "../activities/activitiesDoor";
import { AddPastActivity } from "./AddPastActivity";
import type { PickFile, Picked } from "./pickActivityFile";

// «Add past activity» in «My activities» (TASK-312): «From a file», the
// file read on the phone, its errors in words, then the form of the end of
// a run marked «Imported», and «Save».

jest.mock("expo-file-system");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../settings/useSport", () => ({ useSport: () => "run" }));

const FOLDER = join(__dirname, "../../__tests__/fixtures/imports");

function file(name: string): Picked {
  return { kind: "picked", bytes: new Uint8Array(readFileSync(join(FOLDER, name))) };
}

function spies() {
  return {
    toDrawing: jest.fn(),
    toPhotos: jest.fn(),
    toStrava: jest.fn(),
    recordImported: jest.fn(() => true),
    alreadyKept: jest.fn(async () => false),
  };
}

async function show(
  door: Partial<ActivitiesDoor>,
  picked: Picked | (() => Promise<Picked>),
  available = true,
) {
  const pickFile: PickFile =
    typeof picked === "function" ? picked : jest.fn(async () => picked);
  function WithDoor() {
    const nothing = useActivitiesDoor();
    return (
      <ActivitiesContext.Provider value={{ ...nothing, signedIn: true, ...door }}>
        <AddPastActivity available={available} pickFile={pickFile} />
      </ActivitiesContext.Provider>
    );
  }
  await render(<WithDoor />);
  return pickFile;
}

async function fromFile() {
  await fireEvent.press(screen.getByRole("button", { name: "Add past activity" }));
  await fireEvent.press(screen.getByText("From a file"));
}

test("without the file picker in the app there is nothing to add", async () => {
  await show(spies(), file("strava-run.gpx"), false);
  expect(screen.queryByText("Add past activity")).toBeNull();
});

test("the button opens «From a file», with what to pick and how", async () => {
  await show(spies(), file("strava-run.gpx"));
  expect(screen.queryByText("From a file")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Add past activity" }));
  expect(screen.getByText("From a file")).toBeTruthy();
  expect(screen.getByText("GPX, TCX or FIT from Strava, Garmin, Komoot…")).toBeTruthy();
  expect(
    screen.getByText(
      "Export the activity as a file from the other app or its website, save it in Files, then pick it here.",
    ),
  ).toBeTruthy();
  // Tapped again, it closes.
  await fireEvent.press(screen.getByRole("button", { name: "Add past activity" }));
  expect(screen.queryByText("From a file")).toBeNull();
});

test("a Strava GPX becomes the form, «Imported», and «Save» keeps it", async () => {
  const door = spies();
  await show(door, file("strava-run.gpx"));
  await fromFile();
  expect(await screen.findByTestId("imported-form")).toBeTruthy();
  expect(screen.getByText("Imported")).toBeTruthy();
  expect(
    screen.getByText("Imported activities don't count for Play or contests."),
  ).toBeTruthy();
  // The run of the file: the sport it says, and no «Send to Strava».
  expect(screen.getByRole("radio", { name: "Run", checked: true })).toBeTruthy();
  expect(screen.queryByText("Send to Strava")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Title"), "Old 10k");
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  expect(door.toStrava).toHaveBeenCalledWith(null);
  expect(door.toDrawing).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Old 10k", visibility: "only_me" }),
  );
  expect(door.recordImported).toHaveBeenCalledTimes(1);
  const [run] = door.recordImported.mock.calls[0] as unknown as [
    { id: string; request: { source: string; track: unknown[] } },
  ];
  expect(run.request.source).toBe("file");
  expect(run.request.track).toHaveLength(40);
  expect(door.alreadyKept).toHaveBeenCalledWith(run.id);
  // Kept: back to the button.
  expect(screen.queryByTestId("imported-form")).toBeNull();
  expect(screen.getByRole("button", { name: "Add past activity" })).toBeTruthy();
});

test("a Garmin TCX starts as a ride, the sport the file says", async () => {
  await show(spies(), file("garmin-ride.tcx"));
  await fromFile();
  expect(await screen.findByTestId("imported-form")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Bike", checked: true })).toBeTruthy();
});

test("a FIT from a Garmin watch becomes the form too", async () => {
  await show(spies(), file("garmin-run.fit"));
  await fromFile();
  expect(await screen.findByTestId("imported-form")).toBeTruthy();
});

test("«Discard» after a yes goes back to the button, saving nothing", async () => {
  const door = spies();
  await show(door, file("strava-run.gpx"));
  await fromFile();
  await screen.findByTestId("imported-form");
  await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
  await fireEvent.press(screen.getByRole("button", { name: "Discard run" }));
  expect(screen.queryByTestId("imported-form")).toBeNull();
  expect(door.recordImported).not.toHaveBeenCalled();
});

test("a phone too full to keep it leaves the form there", async () => {
  const door = { ...spies(), recordImported: jest.fn(() => false) };
  await show(door, file("strava-run.gpx"));
  await fromFile();
  await screen.findByTestId("imported-form");
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  expect(screen.getByTestId("imported-form")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
});

test.each([
  ["komoot-route.gpx", "This file has no times: it is a route, not an activity."],
  ["treadmill.tcx", "This file has no positions."],
])("%s says why it is not an activity", async (name, words) => {
  await show(spies(), file(name));
  await fromFile();
  expect(await screen.findByRole("alert")).toHaveTextContent(words);
  // «From a file» stays, for another file.
  expect(screen.getByText("From a file")).toBeTruthy();
});

test("a file of another kind, too big, or unreadable says so", async () => {
  const answers: Picked[] = [
    { kind: "picked", bytes: new Uint8Array(Buffer.from("hello")) },
    { kind: "too_big" },
    { kind: "unreadable" },
  ];
  await show(spies(), async () => answers.shift()!);
  await fromFile();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This file is not GPX, TCX or FIT.",
  );
  await fireEvent.press(screen.getByText("From a file"));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This file is too big (over 25 MB).",
    ),
  );
  await fireEvent.press(screen.getByText("From a file"));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong."),
  );
});

test("a file kept already says so, with no form", async () => {
  const door = { ...spies(), alreadyKept: jest.fn(async () => true) };
  await show(door, file("strava-run.gpx"));
  await fromFile();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Already in My activities.",
  );
  expect(screen.queryByTestId("imported-form")).toBeNull();
});

test("no file chosen: back to the choices, without a word", async () => {
  await show(spies(), { kind: "canceled" });
  await fromFile();
  await waitFor(() => expect(screen.getByText("From a file")).toBeTruthy());
  expect(screen.queryByRole("alert")).toBeNull();
});
