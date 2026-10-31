import type { Activity } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { distanceOnSpot, type SpotPlace } from "../paddle/placeSpots";
import { RouteChoice } from "../route/RoutePanel";
import { checkWord } from "../route/wordInput";
import { saveUnitsChoice } from "./units";
import { useDrawDistance } from "./useDrawDistance";

// The distance of «Draw» kept at the root of the app (TASK-182 part E): what
// App.tsx writes by itself, a «Try» or a small lake's distance, shows in the
// app's units too, and the API is asked the same whole metres as before.

afterEach(async () => {
  await act(async () => saveUnitsChoice("phone"));
});

/** A small lake: its shapes fit at 1.5 km (TASK-240). */
const LAKE: SpotPlace = {
  label: "Lago di Tenno",
  point: [45.9187, 10.8318],
  distance_m: 1500,
};

/**
 * «Draw» as App.tsx wires it: the panel with the field, a «Try» that
 * chooses `tryM` (what `RouteOutcome` hands up), the lake chosen as the
 * start, and the metres a request would ask for. `panel` false is «Draw»
 * out of the screen: a route on the map.
 */
function Draw({
  activity = "running",
  tryM = 11_265,
  panel = true,
}: {
  activity?: Activity;
  tryM?: number;
  panel?: boolean;
}) {
  const distance = useDrawDistance(activity);
  return (
    <>
      {panel && (
        <RouteChoice
          kind="shape"
          onKind={jest.fn()}
          shapeText="heart"
          shape="heart"
          onShapeText={jest.fn()}
          reading={null}
          onShapeDone={jest.fn()}
          wordText=""
          onWordText={jest.fn()}
          wordCheck={checkWord("", distance.metres, activity)}
          letterStyle="round"
          onLetterStyle={jest.fn()}
          distanceText={distance.text}
          distanceM={distance.metres}
          image={{ status: "none" }}
          onChooseImage={jest.fn()}
          onDistanceText={distance.type}
          activity={activity}
        />
      )}
      <Pressable accessibilityRole="button" onPress={() => distance.choose(tryM)}>
        <Text>Try</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const fits = distanceOnSpot(LAKE, distance.metres);
          if (fits !== null) {
            distance.choose(fits);
          }
        }}
      >
        <Text>Lake</Text>
      </Pressable>
      <Text testID="asked">
        {distance.metres === null ? "none" : `${distance.metres} m`}
      </Text>
    </>
  );
}

function asked(): string {
  return screen.getByTestId("asked").props.children;
}

function shown(units: "km" | "mi"): string {
  return screen.getByLabelText(units === "mi" ? "Distance in miles" : "Distance in km")
    .props.value;
}

test("«Try» with «Miles»: the field shows its miles, the API gets its metres", async () => {
  saveUnitsChoice("mi");
  await render(<Draw />);
  expect(shown("mi")).toBe("3");
  await fireEvent.press(screen.getByRole("button", { name: "Try" }));
  expect(shown("mi")).toBe("7");
  expect(screen.getByText("mi")).toBeOnTheScreen();
  expect(screen.queryByText("km")).toBeNull();
  expect(asked()).toBe("11265 m");
  // From there − and + go by half a mile (TASK-361).
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(shown("mi")).toBe("7.5");
  expect(asked()).toBe("12070 m");
});

test("«Try» at a tenth of a mile shows that tenth", async () => {
  saveUnitsChoice("mi");
  await render(<Draw tryM={4989} />);
  await fireEvent.press(screen.getByRole("button", { name: "Try" }));
  expect(shown("mi")).toBe("3.1");
  expect(asked()).toBe("4989 m");
});

test("a small lake with «Miles»: 0.9 mi on the field, its 1500 m asked, no refusal", async () => {
  saveUnitsChoice("mi");
  await render(<Draw activity="paddling" />);
  expect(shown("mi")).toBe("1");
  expect(asked()).toBe("1609 m");
  await fireEvent.press(screen.getByRole("button", { name: "Lake" }));
  expect(shown("mi")).toBe("0.9");
  expect(asked()).toBe("1500 m");
  expect(screen.queryByText("Enter a distance between 1 and 3 mi.")).toBeNull();
  // + adds half a mile to it (TASK-361), as to what is typed.
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(shown("mi")).toBe("1.4");
  expect(asked()).toBe("2253 m");
});

test("in kilometres a «Try» writes its km, as before", async () => {
  saveUnitsChoice("km");
  await render(<Draw tryM={12_000} />);
  expect(shown("km")).toBe("5");
  await fireEvent.press(screen.getByRole("button", { name: "Try" }));
  expect(shown("km")).toBe("12");
  expect(screen.getByText("km")).toBeOnTheScreen();
  expect(asked()).toBe("12000 m");
});

test("in kilometres a small lake writes its 1.5 km, as before", async () => {
  saveUnitsChoice("km");
  await render(<Draw activity="paddling" />);
  expect(shown("km")).toBe("2");
  await fireEvent.press(screen.getByRole("button", { name: "Lake" }));
  expect(shown("km")).toBe("1.5");
  expect(asked()).toBe("1500 m");
});

test("«Settings» changes the units with a distance typed, «Draw» on the screen", async () => {
  saveUnitsChoice("km");
  await render(<Draw />);
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "7,5");
  expect(asked()).toBe("7500 m");
  await act(async () => saveUnitsChoice("mi"));
  expect(shown("mi")).toBe("5");
  expect(asked()).toBe("8047 m");
  await act(async () => saveUnitsChoice("km"));
  expect(shown("km")).toBe("8");
  expect(asked()).toBe("8000 m");
});

test("«Settings» changes the units while «Draw» is off the screen: the same", async () => {
  saveUnitsChoice("km");
  const { rerender } = await render(<Draw />);
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "7,5");
  await rerender(<Draw panel={false} />);
  await act(async () => saveUnitsChoice("mi"));
  expect(asked()).toBe("8047 m");
  await rerender(<Draw />);
  expect(shown("mi")).toBe("5");
  expect(asked()).toBe("8047 m");
});

test("«Settings» changes the units after a «Try»: from its metres, whole", async () => {
  saveUnitsChoice("mi");
  const { rerender } = await render(<Draw />);
  await fireEvent.press(screen.getByRole("button", { name: "Try" }));
  await act(async () => saveUnitsChoice("km"));
  expect(shown("km")).toBe("11");
  expect(asked()).toBe("11000 m");
  // Off the screen too.
  await fireEvent.press(screen.getByRole("button", { name: "Try" }));
  await rerender(<Draw panel={false} />);
  await act(async () => saveUnitsChoice("mi"));
  await rerender(<Draw />);
  expect(shown("mi")).toBe("7");
  expect(asked()).toBe("11265 m");
});
