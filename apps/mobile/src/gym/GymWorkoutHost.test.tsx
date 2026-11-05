/**
 * A workout at the gym from «Start workout» to «Save» (TASK-385 part B,
 * ADR-0327, the user's choices of 2026-11-04): the catalog, a set, its rest
 * by itself, «Same again», «Pause», «Stop» held, the corrections at the end,
 * and «Save», which sends it to the API. An app opened again finds the
 * workout where it was.
 */
import type { Session } from "@shaperoute/shared-types";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ActivitiesContext, type ActivitiesDoor } from "../activities/activitiesDoor";
import { answers } from "../account/testing";
import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { gymToSend } from "./gymOutbox";
import { GymWorkoutHost } from "./GymWorkoutHost";
import { forgetRestQuestion } from "./restAlert";
import { forgetHeldWorkout, startGymWorkout } from "./useWorkout";
import { loadWorkout } from "./workoutStore";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
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
const signedIn = session as Session;
const OWNER = signedIn.user.id;
const T0 = Date.UTC(2026, 10, 5, 17);

function follows(): FollowsDoor {
  return {
    apiUrl: "http://api",
    account: {
      state: { status: "signedIn", session: signedIn },
      sessionEnded: () => {},
    },
    openProfile: () => {},
  } as unknown as FollowsDoor;
}

const refresh = jest.fn();

function activities(signed = true): ActivitiesDoor {
  return {
    signedIn: signed,
    owner: signed ? OWNER : null,
    refresh,
    signIn: jest.fn(),
  } as unknown as ActivitiesDoor;
}

async function show(fetchFn?: jest.Mock, signed = true) {
  await render(
    <FollowsContext.Provider value={follows()}>
      <ActivitiesContext.Provider value={activities(signed)}>
        <GymWorkoutHost fetchFn={fetchFn} />
      </ActivitiesContext.Provider>
    </FollowsContext.Provider>,
  );
}

async function wait(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  files.clear();
  forgetHeldWorkout();
  forgetRestQuestion();
  refresh.mockClear();
  jest.useFakeTimers({ now: T0 });
});

afterEach(() => {
  jest.useRealTimers();
});

async function benchSet(reps: string, kg: string) {
  await fireEvent.changeText(screen.getByTestId("set-reps"), reps);
  await fireEvent.changeText(screen.getByTestId("set-load_kg"), kg);
  await fireEvent.press(screen.getByTestId("log-set"));
}

test("nothing shows without a workout", async () => {
  await show();
  expect(screen.queryByTestId("gym-workout")).toBeNull();
  expect(screen.queryByTestId("exercise-picker")).toBeNull();
});

test("a set, its rest by itself, Skip, Same again", async () => {
  await show();
  await act(async () => startGymWorkout());
  // The first thing: «+ Exercise», the catalog.
  expect(screen.getByTestId("exercise-picker")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("exercise-bench_press"));
  expect(screen.getByText("Bench press")).toBeOnTheScreen();
  expect(screen.getByText("Set 1")).toBeOnTheScreen();

  await wait(60_000);
  await benchSet("10", "60");
  expect(screen.getByTestId("rest-panel")).toBeOnTheScreen();
  expect(screen.getByTestId("rest-clock")).toHaveTextContent("1:30");
  expect(screen.getByText("Next: Bench press · set 2")).toBeOnTheScreen();
  await wait(30_000);
  expect(screen.getByTestId("rest-clock")).toHaveTextContent("1:00");
  await fireEvent.press(screen.getByTestId("rest-skip"));
  expect(screen.queryByTestId("rest-panel")).toBeNull();

  await fireEvent.press(screen.getByTestId("same-again"));
  expect(screen.getByText("1 exercises · 2 sets")).toBeOnTheScreen();
  expect(screen.getByText("60 kg × 10 · 60 kg × 10")).toBeOnTheScreen();
  expect(loadWorkout()?.sets).toHaveLength(2);
});

test("the clock stops in Pause; a set ends it", async () => {
  await show();
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-plank"));
  await wait(60_000);
  await fireEvent.press(screen.getByTestId("gym-pause"));
  expect(screen.getByText("Paused")).toBeOnTheScreen();
  await wait(5 * 60_000);
  expect(screen.getByTestId("gym-clock")).toHaveTextContent("1:00");
  await fireEvent.changeText(screen.getByTestId("set-duration_s"), "1:30");
  await fireEvent.press(screen.getByTestId("log-set"));
  expect(screen.queryByText("Paused")).toBeNull();
  await wait(2_000);
  expect(screen.getByTestId("gym-clock")).toHaveTextContent("1:02");
});

test("an exercise of one's own, with the kind chosen", async () => {
  await show();
  await act(async () => startGymWorkout());
  await fireEvent.changeText(screen.getByTestId("exercise-search"), "Sled push");
  await fireEvent.press(screen.getByTestId("add-own-exercise"));
  await fireEvent.press(screen.getByTestId("own-kind-timed"));
  expect(screen.getByText("Sled push")).toBeOnTheScreen();
  expect(screen.getByTestId("set-duration_s")).toBeOnTheScreen();
  expect(screen.queryByTestId("set-reps")).toBeNull();
});

test("an app opened again finds the workout where it was", async () => {
  await show();
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-bench_press"));
  await benchSet("8", "70");
  await screen.unmount();
  forgetHeldWorkout();
  await show();
  expect(screen.getByText("70 kg × 8")).toBeOnTheScreen();
  expect(screen.getByTestId("rest-panel")).toBeOnTheScreen();
});

test("Still training? after 30 minutes with nothing, and without an answer it ends at the last set", async () => {
  await show();
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-bench_press"));
  await wait(10 * 60_000);
  await benchSet("5", "80");
  await wait(30 * 60_000);
  expect(screen.getByTestId("still-training")).toBeOnTheScreen();
  await wait(5 * 60_000);
  expect(screen.getByTestId("gym-end")).toBeOnTheScreen();
  expect(screen.getByTestId("gym-end-time")).toHaveTextContent("10:00");
});

test("Stop held, a set corrected, Save: it goes to the API and the screen leaves", async () => {
  const fetchFn = answers({
    status: 201,
    body: {
      id: "x",
      started_at: "2026-11-05T17:00:00Z",
      duration_s: 1200,
      rests: 0,
      rest_s: 0,
      show_exercises: true,
      sets: [],
    },
  });
  await show(fetchFn);
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-bench_press"));
  await wait(60_000);
  await benchSet("10", "60");
  await fireEvent.press(screen.getByTestId("rest-skip"));
  await wait(19 * 60_000);
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  expect(screen.getByTestId("gym-end")).toBeOnTheScreen();
  expect(screen.getByTestId("gym-end-time")).toHaveTextContent("20:00");

  await fireEvent.press(screen.getByTestId("gym-set-1"));
  await fireEvent.changeText(screen.getByTestId("set-reps"), "12");
  await fireEvent.press(screen.getByTestId("edit-done"));
  expect(screen.getByText("60 kg × 12")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("gym-save"));
  await act(async () => {});
  expect(screen.queryByTestId("gym-end")).toBeNull();
  expect(loadWorkout()).toBeNull();
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toMatch(/^http:\/\/api\/me\/gym-sessions\/[a-z0-9]{8,40}$/);
  const body = JSON.parse(init?.body as string);
  expect(body).toMatchObject({
    started_at: "2026-11-05T17:00:00.000Z",
    ended_at: "2026-11-05T17:20:00.000Z",
    rests: 0,
    sets: [
      {
        exercise: "bench_press",
        kind: "load",
        reps: 12,
        load_kg: 60,
        at_s: 60,
        live: true,
      },
    ],
  });
  expect(gymToSend(OWNER)).toEqual([]);
  expect(refresh).toHaveBeenCalled();
});

test("without a network the workout waits on the phone", async () => {
  const fetchFn = answers(new Error("Network request failed"));
  await show(fetchFn);
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-plank"));
  await fireEvent.changeText(screen.getByTestId("set-duration_s"), "60");
  await fireEvent.press(screen.getByTestId("log-set"));
  await wait(2 * 60_000);
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  await fireEvent.press(screen.getByTestId("gym-save"));
  await act(async () => {});
  expect(screen.queryByTestId("gym-end")).toBeNull();
  expect(gymToSend(OWNER)).toHaveLength(1);
});

test("Discard asks once more, then forgets the workout", async () => {
  await show();
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-plank"));
  await wait(60_000);
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  await fireEvent.press(screen.getByTestId("gym-discard"));
  expect(screen.getByText("Keep it")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("gym-discard-sure"));
  expect(screen.queryByTestId("gym-end")).toBeNull();
  expect(loadWorkout()).toBeNull();
});

test("signed out, it says to sign in instead of Save", async () => {
  await show(undefined, false);
  await act(async () => startGymWorkout());
  await fireEvent.press(screen.getByTestId("exercise-plank"));
  await wait(60_000);
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  expect(screen.queryByTestId("gym-save")).toBeNull();
  expect(
    screen.getByText("Sign up or log in to keep your runs and share them as drawings."),
  ).toBeOnTheScreen();
});
