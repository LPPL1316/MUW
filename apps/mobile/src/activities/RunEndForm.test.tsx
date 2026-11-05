import { fireEvent, render, screen } from "@testing-library/react-native";

import { NOT_CHOSEN } from "../api/drawings";
import type { PickedDrawingPhoto } from "../social/pickDrawingPhoto";
import { ONLY_ME_PHOTOS } from "../social/PublicParts";
import {
  forgetVisibilityOf,
  loadVisibility,
  saveVisibility,
} from "../social/visibilityChoice";
import {
  ActivitiesContext,
  type ActivitiesDoor,
  useActivitiesDoor,
} from "./activitiesDoor";
import { RunEnd } from "./RunEnd";

// The form at the end of a run (TASK-208): «Only me» and the sport of
// «Settings» at every run; what is chosen goes with «Save», the photos too.

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
  return {
    File,
    Paths: {
      document: { uri: "file:///documents/" },
      cache: { uri: "file:///cache/" },
    },
  };
});
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

let mockSport: "run" | "bike" | "paddle" = "run";
jest.mock("../settings/useSport", () => ({ useSport: () => mockSport }));

const picked = jest.fn(async (): Promise<PickedDrawingPhoto> => ({
  kind: "picked",
  base64: "c2hydW5r",
  width: 1080,
  height: 810,
}));

function WithDoor({
  door,
  onSave = () => true,
  imported,
}: {
  door: Partial<ActivitiesDoor>;
  onSave?: () => boolean;
  imported?: { sport: null };
}) {
  const nothing = useActivitiesDoor();
  return (
    <ActivitiesContext.Provider value={{ ...nothing, signedIn: true, ...door }}>
      <RunEnd onSave={onSave} onDiscard={jest.fn()} pick={picked} imported={imported} />
    </ActivitiesContext.Provider>
  );
}

function spies() {
  return {
    toDrawing: jest.fn(),
    toPhotos: jest.fn(),
    toOrder: jest.fn(),
    toStrava: jest.fn(),
  };
}

async function save() {
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
}

const OWNER = 7;
const EVERY_MEMBER = "Every member sees it in your profile.";

beforeEach(() => {
  mockSport = "run";
  forgetVisibilityOf(OWNER);
});

// «Who can see it» starts from the last choice saved (TASK-352, ADR-0304).

test("«Everyone» saved once: the next run starts there, and says so over «Save»", async () => {
  const door = { ...spies(), owner: OWNER };
  const first = await render(<WithDoor door={door} />);
  expect(screen.getByRole("radio", { name: "Only me", checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Everyone" }));
  // Chosen here, in the form: its words under the chips are enough.
  expect(screen.getAllByText(EVERY_MEMBER)).toHaveLength(1);
  await save();
  await first.unmount();

  const next = { ...spies(), owner: OWNER };
  await render(<WithDoor door={next} />);
  expect(screen.getByRole("radio", { name: "Everyone", checked: true })).toBeTruthy();
  expect(screen.getAllByText(EVERY_MEMBER)).toHaveLength(2);
  // Nothing goes until «Save»: closing here publishes nothing.
  expect(next.toDrawing).not.toHaveBeenCalled();
  await save();
  expect(next.toDrawing).toHaveBeenCalledWith({
    ...NOT_CHOSEN,
    visibility: "everyone",
  });
});

test("taken off, it stays off for the next run", async () => {
  saveVisibility(OWNER, "everyone");
  const door = { ...spies(), owner: OWNER };
  const first = await render(<WithDoor door={door} />);
  await fireEvent.press(screen.getByRole("radio", { name: "Only me" }));
  expect(screen.queryByText(EVERY_MEMBER)).toBeNull();
  await save();
  expect(door.toDrawing).toHaveBeenCalledWith(null);
  await first.unmount();
  await render(<WithDoor door={{ ...spies(), owner: OWNER }} />);
  expect(screen.getByRole("radio", { name: "Only me", checked: true })).toBeTruthy();
});

test("only a run kept remembers: not a touch, nor a «Save» that failed", async () => {
  const door = { ...spies(), owner: OWNER };
  await render(<WithDoor door={door} onSave={() => false} />);
  await fireEvent.press(screen.getByRole("radio", { name: "Everyone" }));
  expect(loadVisibility(OWNER)).toBe("only_me");
  await save();
  expect(loadVisibility(OWNER)).toBe("only_me");
});

test("an activity from a file starts «Only me» and leaves the choice alone", async () => {
  saveVisibility(OWNER, "everyone");
  const door = { ...spies(), owner: OWNER };
  await render(<WithDoor door={door} imported={{ sport: null }} />);
  expect(screen.getByRole("radio", { name: "Only me", checked: true })).toBeTruthy();
  expect(screen.queryByText(EVERY_MEMBER)).toBeNull();
  await save();
  expect(door.toDrawing).toHaveBeenCalledWith(null);
  expect(loadVisibility(OWNER)).toBe("everyone");
});

test("another account does not start from this one's choice", async () => {
  saveVisibility(OWNER, "everyone");
  await render(<WithDoor door={{ ...spies(), owner: OWNER + 1 }} />);
  expect(screen.getByRole("radio", { name: "Only me", checked: true })).toBeTruthy();
});

test("nothing chosen: «Only me», the run a run, and «Save» sends no drawing", async () => {
  const door = spies();
  await render(<WithDoor door={door} />);
  expect(screen.getByRole("radio", { name: "Only me", checked: true })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Run", checked: true })).toBeTruthy();
  await save();
  expect(door.toDrawing).toHaveBeenCalledWith(null);
  expect(door.toPhotos).toHaveBeenCalledWith([]);
  expect(door.toStrava).toHaveBeenCalledWith(null);
});

test("the sport of «Settings» is the activity, and counts as chosen", async () => {
  mockSport = "bike";
  const door = spies();
  await render(<WithDoor door={door} />);
  expect(screen.getByRole("radio", { name: "Bike", checked: true })).toBeTruthy();
  await save();
  expect(door.toDrawing).toHaveBeenCalledWith({ ...NOT_CHOSEN, activity: "cycling" });
});

test("the title, how it went and who can see it go whole with «Save»", async () => {
  const door = spies();
  await render(<WithDoor door={door} />);
  await fireEvent.changeText(screen.getByLabelText("Title"), " Sunday heart ");
  await fireEvent.changeText(screen.getByLabelText("How did it go?"), "Heavy legs.");
  await fireEvent.press(screen.getByRole("radio", { name: "Followers" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Paddle" }));
  await save();
  expect(door.toDrawing).toHaveBeenCalledWith({
    title: "Sunday heart",
    description: "Heavy legs.",
    activity: "paddling",
    tags: [],
    visibility: "followers",
  });
});

test("the map moved after a photo: «Save» sends the photos and the order", async () => {
  const door = spies();
  await render(<WithDoor door={door} />);
  await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  expect(await screen.findByLabelText("Photo 1")).toBeTruthy();
  // VoiceOver's «Move right» on the map, as a drag would.
  await fireEvent(screen.getByTestId("tile-drawing"), "accessibilityAction", {
    nativeEvent: { actionName: "moveRight" },
  });
  await save();
  expect(door.toPhotos).toHaveBeenCalledWith(["c2hydW5r"]);
  expect(door.toOrder).toHaveBeenCalledWith(["photo:1", "drawing"]);
});

test("the photos chosen go with «Save», in order, and «Only me» warns they stay here", async () => {
  const door = spies();
  await render(<WithDoor door={door} />);
  expect(screen.queryByText(ONLY_ME_PHOTOS)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  expect(await screen.findByLabelText("Photo 1")).toBeTruthy();
  expect(screen.getByText(ONLY_ME_PHOTOS)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Take a photo" }));
  expect(await screen.findByLabelText("Photo 2")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Remove photo 1" }));
  // The photos are counted as the post shows them: one is left.
  expect(screen.queryByLabelText("Photo 2")).toBeNull();
  expect(screen.getByLabelText("Photo 1")).toBeTruthy();
  await save();
  expect(door.toPhotos).toHaveBeenCalledWith(["c2hydW5r"]);
  // The map first, as every post before TASK-348: no order to send.
  expect(door.toOrder).toHaveBeenCalledWith(null);
  // Nothing else chosen: the photos are the phone's, no drawing is sent.
  expect(door.toDrawing).toHaveBeenCalledWith(null);
});
