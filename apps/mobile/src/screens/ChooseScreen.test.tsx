/**
 * The first screen's run button: yellow by the user's choice (TASK-220,
 * ADR-0183) until TASK-361, which leaves the yellow to the route's button
 * alone: outlined, with the runner beside its words.
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking, Text } from "react-native";

import { color } from "../theme/tokens";
import { ChooseScreen, MapError } from "./ChooseScreen";

const mockReverseGeocode = jest.fn();
jest.mock("expo-location", () => ({
  ...jest.requireActual("expo-location"),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
}));

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

async function choose(
  runLabel?: string,
  more: {
    denied?: boolean;
    mapError?: string;
    onMapRetry?: () => void;
    runIcon?: string;
  } = {},
) {
  await render(
    <ChooseScreen
      status="From your position"
      denied={more.denied ?? false}
      mode="gps"
      onMode={jest.fn()}
      searching={false}
      onPlace={jest.fn()}
      near={null}
      mapError={more.mapError ?? null}
      onMapRetry={more.onMapRetry}
      footer={<Text>Draw route</Text>}
      onRun={jest.fn()}
      runLabel={runLabel}
      runIcon={more.runIcon}
    >
      <Text>Shapes</Text>
    </ChooseScreen>,
  );
}

test("«Run without a route» is outlined, not yellow: the yellow is the route's", async () => {
  await choose();
  const button = screen.getByRole("button", { name: "Run without a route" });
  expect(button).not.toHaveStyle({ backgroundColor: color.accent });
  expect(button).toHaveStyle({ borderColor: color.borderStrong });
  expect(screen.getByText("Run without a route")).toHaveStyle({ color: color.text });
  // The runner and the words are one button (TASK-361).
  expect(screen.getByText("🏃")).toBeOnTheScreen();
});

test("«Ride without a route», with «Bike», is outlined too, with a bike", async () => {
  await choose("Ride without a route", { runIcon: "🚴" });
  const button = screen.getByRole("button", { name: "Ride without a route" });
  expect(button).not.toHaveStyle({ backgroundColor: color.accent });
  expect(screen.getByText("🚴")).toBeOnTheScreen();
});

// A map that could not load (TASK-259): the map's own words, not the reason
// for the log nor «reopen the app»; «Retry» loads it again from «Draw».
test("the map that could not load: what to do, and «Retry»", async () => {
  const onMapRetry = jest.fn();
  await choose(undefined, { mapError: "MapLibre GL JS did not load", onMapRetry });
  expect(
    screen.getByText("The map could not be loaded. Check the network."),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/MapLibre/)).toBeNull();
  expect(screen.queryByText(/reopen the app/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(onMapRetry).toHaveBeenCalledTimes(1);
});

test("without a screen to retry it, the map's words only", async () => {
  await render(<MapError reason="style not found" />);
  expect(
    screen.getByText("The map could not be loaded. Check the network."),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});

test("the position refused: «Open Settings» opens the app's settings", async () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  await choose(undefined, { denied: true });
  await fireEvent.press(screen.getByRole("button", { name: "Open Settings" }));
  expect(openSettings).toHaveBeenCalledTimes(1);
  openSettings.mockRestore();
});

describe("the start by its street (TASK-361)", () => {
  async function onGps(more: { mode?: "gps" | "place"; denied?: boolean } = {}) {
    await render(
      <ChooseScreen
        status="Starting from your position."
        denied={more.denied ?? false}
        mode={more.mode ?? "gps"}
        onMode={jest.fn()}
        searching={more.mode === "place"}
        onPlace={jest.fn()}
        near={[46.0122, 11.2986]}
        mapError={null}
        footer={<Text>Draw route</Text>}
      >
        <Text>Shapes</Text>
      </ChooseScreen>,
    );
    await act(async () => {});
  }

  beforeEach(() => {
    mockReverseGeocode.mockResolvedValue([
      { street: "Via Roma", streetNumber: "3", city: "Levico Terme" },
    ]);
  });

  test("with the GPS, the street and the town", async () => {
    await onGps();
    expect(screen.getByTestId("start-address")).toHaveTextContent(
      "📍 Via Roma, Levico Terme",
    );
    expect(screen.queryByText("Starting from your position.")).toBeNull();
  });

  test("with «Another place» or the location refused, the line as before", async () => {
    await onGps({ mode: "place" });
    expect(screen.queryByTestId("start-address")).toBeNull();
    expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  });

  test("no answer: the line as before", async () => {
    mockReverseGeocode.mockResolvedValue([]);
    await onGps();
    expect(screen.queryByTestId("start-address")).toBeNull();
  });
});

test("the page ends below the button at its foot (TASK-361)", async () => {
  await choose();
  const padded = () => JSON.stringify(screen.toJSON()).includes('"paddingBottom":144');
  expect(padded()).toBe(false);
  // The docked box around the button reports its height: the page's
  // content ends 120 + 24 lower.
  await fireEvent(screen.getByTestId("draw-footer"), "layout", {
    nativeEvent: { layout: { x: 0, y: 700, width: 390, height: 120 } },
  });
  expect(padded()).toBe(true);
});
