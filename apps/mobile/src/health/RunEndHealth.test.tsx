import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { activityKey } from "../activities/activityKey";
import {
  ActivitiesContext,
  type ActivitiesDoor,
  useActivitiesDoor,
} from "../activities/activitiesDoor";
import { RunEnd } from "../activities/RunEnd";
import type { SavedRun } from "../navigation/trackStore";
import { HEALTH_CHOICE_FILE } from "./healthChoice";
import type { HealthPermission, HealthPhone, HealthStore } from "./healthPhone";

// The end of a run with the phone's health data (TASK-321): a fake phone
// stands for Apple Health and Health Connect, and the documents folder is
// in memory, with the run the phone kept.

jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, files, Paths: { document: { uri: "file:///documents/" } } };
});

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");

const START = Date.UTC(2026, 9, 28, 7, 0, 0);
const RUN: SavedRun = {
  version: 1,
  route: [],
  track: {
    fixes: [
      { point: [46.0679, 11.1211], timeMs: START, accuracyM: 5 },
      { point: [46.0701, 11.1243], timeMs: START + 300_000, accuracyM: 8 },
    ],
    distanceM: 1200,
  },
  status: "stopped",
};

function fakePhone(permission: HealthPermission, store: HealthStore = "apple") {
  const phone = {
    store,
    available: jest.fn(async () => true),
    permission: jest.fn(async () => permission),
    ask: jest.fn(async () => {}),
    write: jest.fn(async () => true),
  };
  return phone satisfies HealthPhone;
}

function sayYes() {
  files.set(`file:///documents/${HEALTH_CHOICE_FILE}`, '{"on":true}');
}

function End({
  health,
  door = {},
  onDiscard = jest.fn(),
}: {
  health: HealthPhone | null;
  door?: Partial<ActivitiesDoor>;
  onDiscard?: () => void;
}) {
  const nothing = useActivitiesDoor();
  return (
    <ActivitiesContext.Provider value={{ ...nothing, signedIn: true, ...door }}>
      <RunEnd onSave={() => true} onDiscard={onDiscard} health={health} />
    </ActivitiesContext.Provider>
  );
}

beforeEach(() => {
  files.clear();
  files.set("file:///documents/current-run.json", JSON.stringify(RUN));
});

test("a build without the native module: no line", async () => {
  await render(<End health={null} />);
  expect(screen.queryByText("Save to Apple Health")).toBeNull();
  expect(screen.queryByText(/Fitness app/)).toBeNull();
});

test("an iPad without health data: no line", async () => {
  const phone = fakePhone("unasked");
  phone.available.mockResolvedValue(false);
  await render(<End health={phone} />);
  await waitFor(() => expect(phone.available).toHaveBeenCalled());
  expect(screen.queryByText("Save to Apple Health")).toBeNull();
});

test("before the yes: the button opens the sheet, and the yes is kept", async () => {
  const phone = fakePhone("unasked");
  await render(<End health={phone} />);
  expect(
    await screen.findByText(
      "Your activities also go to the Fitness app, with the route.",
    ),
  ).toBeTruthy();
  phone.permission.mockResolvedValue("allowed");
  await fireEvent.press(screen.getByRole("button", { name: "Save to Apple Health" }));
  expect(await screen.findByText("Also to Apple Health, with Save.")).toBeTruthy();
  expect(phone.ask).toHaveBeenCalledTimes(1);
  expect(files.get(`file:///documents/${HEALTH_CHOICE_FILE}`)).toBe('{"on":true}');
  expect(screen.queryByRole("button", { name: "Save to Apple Health" })).toBeNull();
});

test("a no at the sheet: the line says where to allow it", async () => {
  const phone = fakePhone("unasked");
  await render(<End health={phone} />);
  phone.permission.mockResolvedValue("refused");
  await fireEvent.press(
    await screen.findByRole("button", { name: "Save to Apple Health" }),
  );
  expect(
    await screen.findByText(
      "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.",
    ),
  ).toBeTruthy();
});

test("after the yes, Save writes the run there, as the form says it was", async () => {
  sayYes();
  const phone = fakePhone("allowed");
  await render(<End health={phone} />);
  expect(await screen.findByText("Also to Apple Health, with Save.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(phone.write).toHaveBeenCalledTimes(1));
  expect(phone.write).toHaveBeenCalledWith(
    expect.objectContaining({
      activity: "running",
      startMs: START,
      endMs: START + 300_000,
      distanceM: 1200,
      syncId: activityKey(RUN.track.fixes[0]),
    }),
  );
});

test("turned off in the Health app since the yes: nothing is written", async () => {
  sayYes();
  const phone = fakePhone("refused");
  await render(<End health={phone} />);
  expect(
    await screen.findByText(
      "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.",
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(phone.permission).toHaveBeenCalledTimes(2));
  expect(phone.write).not.toHaveBeenCalled();
});

test("Discard writes nothing", async () => {
  sayYes();
  const phone = fakePhone("allowed");
  const onDiscard = jest.fn();
  await render(<End health={phone} onDiscard={onDiscard} />);
  await screen.findByText("Also to Apple Health, with Save.");
  await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
  await fireEvent.press(screen.getByRole("button", { name: "Discard run" }));
  expect(onDiscard).toHaveBeenCalled();
  expect(phone.write).not.toHaveBeenCalled();
});

test("signed out: no Save, no line", async () => {
  const phone = fakePhone("unasked");
  await render(<End health={phone} door={{ signedIn: false }} />);
  expect(screen.queryByText("Save to Apple Health")).toBeNull();
});

test("on Android, Health Connect's words", async () => {
  const phone = fakePhone("unasked", "healthConnect");
  await render(<End health={phone} />);
  expect(
    await screen.findByText(
      "Your activities also go to Health Connect, with the route.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save to Health Connect" })).toBeTruthy();
});
