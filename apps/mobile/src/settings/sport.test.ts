import {
  activityOf,
  canChoose,
  DEFAULT_SPORT,
  loadSport,
  saveSport,
  SPORT_FILE,
  SPORTS,
  type SportOption,
  subscribeSport,
  withoutRouteLabel,
} from "./sport";

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
const SPORT_URI = `file:///documents/${SPORT_FILE}`;

/** As before TASK-190: only run ready. */
const RUN_ONLY: SportOption[] = SPORTS.map((option) =>
  option.id === "run" ? option : { ...option, ready: false },
);

beforeEach(() => {
  disk.files.clear();
  disk.state.failing = false;
});

test("run, bike and paddle, all three can be chosen (TASK-190, TASK-191)", () => {
  expect(SPORTS.map((option) => option.name)).toEqual([
    "Run",
    "Bike",
    "Paddle",
    "Open water swim",
    "Paragliding",
  ]);
  expect(SPORTS.filter((option) => option.ready).map((option) => option.id)).toEqual([
    "run",
    "bike",
    "paddle",
  ]);
  expect(canChoose("run")).toBe(true);
  expect(canChoose("bike")).toBe(true);
  expect(canChoose("paddle")).toBe(true);
  expect(canChoose("golf")).toBe(false);
});

test("«Paragliding» comes last, only «Soon»: never chosen, never a route (TASK-305 D0)", () => {
  expect(SPORTS.at(-1)).toEqual({
    id: "paragliding",
    emoji: "🪂",
    name: "Paragliding",
    ready: false,
  });
  expect(canChoose("paragliding")).toBe(false);
  // A phone that somehow kept it reads it as run, as any sport not ready.
  saveSport("paragliding");
  expect(loadSport()).toBe("run");
  // Wherever the sports are told apart, it goes as a run.
  expect(activityOf("paragliding")).toBe("running");
  expect(withoutRouteLabel("paragliding")).toBe("Run without a route");
});

test("«Open water swim» 🏊 comes after «Paddle», «Soon» until the server swims (TASK-323 C)", () => {
  const index = SPORTS.findIndex((option) => option.id === "swim");
  expect(SPORTS[index - 1]?.id).toBe("paddle");
  expect(SPORTS[index]).toEqual({
    id: "swim",
    emoji: "🏊",
    name: "Open water swim",
    ready: false,
  });
  expect(canChoose("swim")).toBe(false);
  saveSport("swim");
  expect(loadSport()).toBe("run");
  // Asked as a swim since C2, in its own words.
  expect(activityOf("swim")).toBe("swimming");
  expect(withoutRouteLabel("swim")).toBe("Swim without a route");
});

test("«Draw» asks for a bike route with «Bike», the water with «Paddle»", () => {
  expect(activityOf("run")).toBe("running");
  expect(activityOf("bike")).toBe("cycling");
  expect(activityOf("paddle")).toBe("paddling");
});

test("the way out with the track only says the sport", () => {
  expect(withoutRouteLabel("run")).toBe("Run without a route");
  expect(withoutRouteLabel("bike")).toBe("Ride without a route");
  expect(withoutRouteLabel("paddle")).toBe("Paddle without a route");
});

test("with nothing chosen, the sport is run", () => {
  expect(DEFAULT_SPORT).toBe("run");
  expect(loadSport()).toBe("run");
});

test("a sport that is ready is kept for the next opening", () => {
  saveSport("bike");
  expect(disk.files.get(SPORT_URI)).toBe('{"sport":"bike"}');
  expect(loadSport()).toBe("bike");
});

test("a saved sport that is not ready reads as run", () => {
  // «Paddle» kept since TASK-191, read by an app that has it and by one
  // without it.
  saveSport("paddle");
  expect(loadSport()).toBe("paddle");
  expect(loadSport(RUN_ONLY)).toBe("run");
  // As a phone that kept «Bike» reads in an app without it.
  saveSport("bike");
  expect(loadSport(RUN_ONLY)).toBe("run");
});

test("a file that does not read gives run", () => {
  for (const text of ["", "not json", "null", '"bike"', '{"sport":"golf"}', "{}"]) {
    disk.files.set(SPORT_URI, text);
    expect(loadSport()).toBe("run");
  }
});

test("a phone that refuses to write breaks nothing", () => {
  disk.state.failing = true;
  expect(() => saveSport("run")).not.toThrow();
  expect(loadSport()).toBe("run");
});

test("each sport saved is told to whoever listens, until they stop", () => {
  const heard: string[] = [];
  const stop = subscribeSport((sport) => heard.push(sport));
  saveSport("bike");
  saveSport("run");
  stop();
  saveSport("bike");
  expect(heard).toEqual(["bike", "run"]);
});

test("a choice the phone could not keep is still told: it holds while open", () => {
  disk.state.failing = true;
  const heard: string[] = [];
  const stop = subscribeSport((sport) => heard.push(sport));
  saveSport("bike");
  stop();
  expect(heard).toEqual(["bike"]);
  expect(loadSport()).toBe("run");
});
