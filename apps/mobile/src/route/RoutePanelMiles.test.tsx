import type { Activity, RouteRequest, RouteResult } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import { saveLanguageChoice } from "../i18n/language";
import { saveUnitsChoice } from "../units/units";
import { distanceForSport, toDistanceM } from "./distance";
import { RouteChoice, RouteOutcome } from "./RoutePanel";
import { checkWord } from "./wordInput";

// «Draw» with «Miles» (TASK-182 part B): the distance is typed and stepped
// in miles, the API is asked in whole metres, and what the panel says of a
// route is in miles. `RoutePanel.test.tsx` says the km, unchanged.

afterEach(async () => {
  await act(async () => {
    saveUnitsChoice("phone");
    saveLanguageChoice("phone");
  });
});

/**
 * The distance as the app's screen keeps it (App.tsx): the field's text,
 * started for the sport, and the metres a request would ask for.
 */
function Draw({
  activity = "running",
  word = "",
}: {
  activity?: Activity;
  word?: string;
}) {
  const [text, setText] = useState(() => distanceForSport("5", activity));
  const distanceM = toDistanceM(text, activity);
  return (
    <>
      <RouteChoice
        kind={word === "" ? "shape" : "word"}
        onKind={jest.fn()}
        shapeText="heart"
        shape="heart"
        onShapeText={jest.fn()}
        reading={null}
        onShapeDone={jest.fn()}
        wordText={word}
        onWordText={jest.fn()}
        wordCheck={checkWord(word, distanceM, activity)}
        letterStyle="round"
        onLetterStyle={jest.fn()}
        distanceText={text}
        distanceM={distanceM}
        image={{ status: "none" }}
        onChooseImage={jest.fn()}
        onDistanceText={setText}
        activity={activity}
      />
      <Text testID="asked">{distanceM === null ? "none" : `${distanceM} m`}</Text>
    </>
  );
}

function asked(): string {
  return screen.getByTestId("asked").props.children;
}

const LONG = "Long routes take longer: up to a few minutes.";

test("the distance starts at 3 mi, and a typed one is asked in whole metres", async () => {
  saveUnitsChoice("mi");
  await render(<Draw />);
  const field = screen.getByLabelText("Distance in miles");
  expect(field.props.value).toBe("3");
  expect(screen.getByText("mi")).toBeOnTheScreen();
  expect(screen.queryByText("km")).toBeNull();
  expect(asked()).toBe("4828 m");

  await fireEvent.changeText(field, "4.5");
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("4.5");
  expect(asked()).toBe("7242 m");
  await fireEvent.changeText(field, "4,5");
  expect(asked()).toBe("7242 m");
  await fireEvent.changeText(field, "13");
  expect(asked()).toBe("20921 m");
});

test("− and + step by half a mile (TASK-361), within the miles of the sport", async () => {
  saveUnitsChoice("mi");
  await render(<Draw />);
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("3.5");
  expect(asked()).toBe("5633 m");
  for (let i = 0; i < 6; i++) {
    await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  }
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("1");
  expect(asked()).toBe("1609 m");
  // A decimal typed keeps its separator.
  await fireEvent.changeText(screen.getByLabelText("Distance in miles"), "12,5");
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("13");
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(asked()).toBe("20921 m");
});

test.each([
  ["running", "3", "14", "Enter a distance between 1 and 13 mi."],
  ["cycling", "7", "6", "Enter a distance between 7 and 18 mi."],
  ["paddling", "1", "3,5", "Enter a distance between 1 and 3 mi."],
] as const)(
  "%s starts at %s mi, and %s mi is refused in words",
  async (activity, starts, typed, refusal) => {
    saveUnitsChoice("mi");
    await render(<Draw activity={activity} />);
    const field = screen.getByLabelText("Distance in miles");
    expect(field.props.value).toBe(starts);
    expect(screen.queryByText(refusal)).toBeNull();
    await fireEvent.changeText(field, typed);
    expect(screen.getByText(refusal)).toBeOnTheScreen();
    expect(asked()).toBe("none");
    // − or + brings it back within the limits.
    await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
    expect(screen.queryByText(refusal)).toBeNull();
    expect(asked()).not.toBe("none");
  },
);

test("what is not a number of miles is refused too, in the app's language", async () => {
  saveUnitsChoice("mi");
  await render(<Draw />);
  for (const typed of ["", "abc", "4,55", "0,5"]) {
    await fireEvent.changeText(screen.getByLabelText("Distance in miles"), typed);
    expect(screen.getByLabelText("Distance in miles").props.value).toBe(typed);
    expect(screen.getByText("Enter a distance between 1 and 13 mi.")).toBeOnTheScreen();
    expect(asked()).toBe("none");
  }
  await act(async () => saveLanguageChoice("it"));
  await fireEvent.changeText(screen.getByLabelText("Distance in miles"), "40");
  expect(screen.getByLabelText("Distanza in miglia").props.value).toBe("40");
  expect(screen.getByText("Inserisci una distanza fra 1 e 13 mi.")).toBeOnTheScreen();
});

test("the long-route note keeps its threshold in metres", async () => {
  saveUnitsChoice("mi");
  await render(<Draw />);
  // 9 mi are 14.5 km, 10 mi are 16.1: the note comes over 15 km.
  await fireEvent.changeText(screen.getByLabelText("Distance in miles"), "9");
  expect(screen.queryByText(LONG)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Distance in miles"), "10");
  expect(screen.getByText(LONG)).toBeOnTheScreen();
});

test("«Settings» changed while a distance is typed: the same distance, whole", async () => {
  await render(<Draw />);
  // In km, as ever.
  const field = screen.getByLabelText("Distance in km");
  expect(field.props.value).toBe("5");
  expect(screen.getByText("km")).toBeOnTheScreen();
  await fireEvent.changeText(field, "7,5");
  expect(asked()).toBe("7500 m");

  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("5");
  expect(screen.getByText("mi")).toBeOnTheScreen();
  expect(asked()).toBe("8047 m");

  await act(async () => saveUnitsChoice("km"));
  expect(screen.getByLabelText("Distance in km").props.value).toBe("8");
  expect(asked()).toBe("8000 m");

  // Out of the limits of the new unit: brought within them.
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "21");
  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("13");
  expect(asked()).toBe("20921 m");
});

test("a word says in miles what it needs, and a tap asks for the next mile", async () => {
  saveUnitsChoice("mi");
  await render(<Draw word="ciao" />);
  // 3 mi to start; CIAO needs 12 km.
  expect(
    screen.getByText("“CIAO” needs at least 7.5 mi: 1.9 mi for each letter."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Use 8 mi"));
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("8");
  expect(asked()).toBe("12875 m");
  expect(
    screen.getByText("4 letters: at least 7.5 mi. A word takes a few minutes to draw."),
  ).toBeOnTheScreen();
});

// --- under the map ----------------------------------------------------------

const START: [number, number] = [46.0671, 11.1214];

const heart: RouteRequest = {
  start: START,
  shape: "heart",
  // 3 mi.
  distance_m: 4828,
  activity: "running",
};

const drawn: RouteResult = {
  points: [START, START],
  distance_m: 5200,
  similarity: 0.9,
  shape: "heart",
  warnings: [],
  directions: [],
};

function outcome(
  view: Parameters<typeof RouteOutcome>[0]["view"],
  {
    onTryDistance = jest.fn(),
    onSignal = jest.fn(),
    choices = [] as RouteResult[],
  } = {},
) {
  return (
    <RouteOutcome
      view={view}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={onTryDistance}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
      choices={choices}
      chosen={0}
      onSignal={onSignal}
    />
  );
}

test("the wait names the miles asked for", async () => {
  saveUnitsChoice("mi");
  const view = (request: RouteRequest) =>
    outcome({ status: "waiting", request, startedAt: 0, phase: "computing" });
  const { rerender } = await render(view(heart));
  expect(screen.getByText("Drawing a 3 mi heart…")).toBeOnTheScreen();
  await rerender(view({ ...heart, distance_m: 7242 }));
  expect(screen.getByText("Drawing a 4.5 mi heart…")).toBeOnTheScreen();
  await rerender(
    view({ start: START, word: "CIAO", distance_m: 12875, activity: "running" }),
  );
  expect(screen.getByText("Drawing “CIAO”, 8 mi…")).toBeOnTheScreen();
});

test("the route says its miles, the miles asked and those of A, B, C", async () => {
  saveUnitsChoice("mi");
  const other = { ...drawn, distance_m: 4600, similarity: 0.8 };
  await render(
    outcome(
      { status: "done", request: heart, result: drawn },
      { choices: [drawn, other] },
    ),
  );
  expect(screen.getByText("3.2 mi")).toBeOnTheScreen();
  expect(screen.getByText("heart · on roads · target 3 mi")).toBeOnTheScreen();
  expect(screen.getByLabelText(/^Route A, 3\.2 mi, /)).toBeOnTheScreen();
  expect(screen.getByLabelText(/^Route B, 2\.9 mi, /)).toBeOnTheScreen();
  expect(screen.queryByText(/ km/)).toBeNull();

  // It follows «Settings» at once, and back.
  await act(async () => saveUnitsChoice("km"));
  expect(screen.getByText("5.2 km")).toBeOnTheScreen();
  expect(screen.getByText("heart · on roads · target 4.828 km")).toBeOnTheScreen();
  expect(screen.getByLabelText(/^Route A, 5\.2 km, /)).toBeOnTheScreen();
});

test("on the water the target is in miles too", async () => {
  saveUnitsChoice("mi");
  await render(
    outcome({
      status: "done",
      request: { ...heart, distance_m: 3219, activity: "paddling" },
      result: { ...drawn, distance_m: 3219 },
    }),
  );
  expect(screen.getByText("2.0 mi")).toBeOnTheScreen();
  expect(screen.getByText("heart · on the water · target 2 mi")).toBeOnTheScreen();
});

test("«better at about» is a whole mile, and Try asks for it in metres", async () => {
  saveUnitsChoice("mi");
  const onTryDistance = jest.fn();
  // 9 mi asked; the API says 12 km, 7.46 mi.
  const nine = { ...heart, distance_m: 14484 };
  await render(
    outcome(
      {
        status: "done",
        request: nine,
        result: { ...drawn, distance_m: 15200, better_distance_m: 12_000 },
      },
      { onTryDistance },
    ),
  );
  expect(
    screen.getByText("This shape comes out better at about 7 mi."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Try 7 mi"));
  expect(onTryDistance).toHaveBeenCalledWith(11265);
  // What the screen then writes in the field (km to the metre) is that
  // same request, so the route stays on the screen.
  expect(toDistanceM(String(11265 / 1000))).toBe(11265);
});

test("a shape that does not fit offers the mile it fits at", async () => {
  saveUnitsChoice("mi");
  const onTryDistance = jest.fn();
  const onSignal = jest.fn();
  const failed = (suggested: number) =>
    outcome(
      {
        status: "failed",
        request: heart,
        problem: {
          kind: "api_error",
          code: "shape_not_drawable",
          message: "no",
          suggested_distance_m: suggested,
        },
      },
      { onTryDistance, onSignal },
    );
  const { rerender } = await render(failed(7000));
  expect(
    screen.getByText(
      "This shape does not fit the roads here at this distance. It fits at about 4 mi.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Try 4 mi"));
  expect(onTryDistance).toHaveBeenCalledWith(6437);
  expect(onSignal).toHaveBeenCalledWith({
    kind: "hint_taken",
    shape: "heart",
    hint: "try_distance",
    distance_m: 4828,
    to_m: 6437,
  });
  // 5 km fit, 3 mi were asked: not 3 mi again.
  await rerender(failed(5000));
  await fireEvent.press(screen.getByText("Try 3.1 mi"));
  expect(onTryDistance).toHaveBeenLastCalledWith(4989);
});

test("a word with the pen up splits its miles", async () => {
  saveUnitsChoice("mi");
  // North in a line: letters 0–100 m and 200–300 m, a walk of 100 m between.
  const metre = 1 / 111_195;
  const points = [0, 100, 200, 300].map((m): [number, number] => [
    46.0122 + m * metre,
    11.2986,
  ]);
  const result: RouteResult = {
    points,
    distance_m: 9700,
    similarity: 0.9,
    shape: null,
    word: "IO",
    warnings: [],
    directions: [],
    walks: [[1, 2]],
  };
  const view = (activity: Activity, shown: RouteResult) =>
    outcome({
      status: "done",
      request: {
        start: points[0],
        ...(shown.word ? { word: shown.word } : { shape: "smiley" as const }),
        pen_up: true,
        distance_m: 9656,
        activity,
      },
      result: shown,
    });
  const { rerender } = await render(view("running", result));
  expect(screen.getByText("6.0 mi")).toBeOnTheScreen();
  expect(
    screen.getByText("6.0 mi of letters + 0.1 mi walking between them"),
  ).toBeOnTheScreen();
  await rerender(view("cycling", result));
  expect(
    screen.getByText("6.0 mi of letters + 0.1 mi riding between them"),
  ).toBeOnTheScreen();
  const pieces: RouteResult = { ...result, shape: "smiley", word: null };
  await rerender(view("running", pieces));
  expect(
    screen.getByText("6.0 mi of drawing + 0.1 mi walking between the parts"),
  ).toBeOnTheScreen();
  await rerender(view("cycling", pieces));
  expect(
    screen.getByText("6.0 mi of drawing + 0.1 mi riding between the parts"),
  ).toBeOnTheScreen();
  await rerender(view("paddling", pieces));
  expect(
    screen.getByText("6.0 mi of drawing + 0.1 mi paddling between the parts"),
  ).toBeOnTheScreen();
  await act(async () => saveLanguageChoice("it"));
  await rerender(view("running", pieces));
  expect(
    screen.getByText("6,0 mi di disegno + 0,1 mi a piedi fra una parte e l'altra"),
  ).toBeOnTheScreen();
});

test("in kilometres the field and the tiles read as before the units", async () => {
  const { rerender } = await render(<Draw />);
  expect(screen.getByLabelText("Distance in km").props.value).toBe("5");
  expect(screen.getByText("km")).toBeOnTheScreen();
  expect(asked()).toBe("5000 m");
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "22");
  expect(screen.getByText("Enter a distance between 1 and 21 km.")).toBeOnTheScreen();
  // Nothing typed in km is taken for miles.
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "7,5");
  expect(screen.getByLabelText("Distance in km").props.value).toBe("7,5");
  expect(asked()).toBe("7500 m");

  const five = { ...heart, distance_m: 5000 };
  const other = { ...drawn, distance_m: 4600, similarity: 0.8 };
  await rerender(
    outcome(
      { status: "done", request: five, result: drawn },
      { choices: [drawn, other] },
    ),
  );
  expect(screen.getByText("5.2 km")).toBeOnTheScreen();
  expect(screen.getByText("heart · on roads · target 5 km")).toBeOnTheScreen();
  expect(
    screen.getByLabelText("Route A, 5.2 km, 90% like the shape"),
  ).toBeOnTheScreen();
  expect(screen.getByText("4.6 km · 80%")).toBeOnTheScreen();
  expect(screen.queryByText(/ mi\b/)).toBeNull();
});
