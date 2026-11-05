import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ISLAND_HOLD_MS } from "./Island";
import { IslandLayer, sayInIsland } from "./IslandLayer";
import { useReduceMotion } from "./useReduceMotion";

// Where `sayInIsland` speaks (TASK-388 B): the newest layer on screen.

jest.mock("./useReduceMotion");
jest.mocked(useReduceMotion).mockReturnValue(true);

const THANKS = "Thanks for telling us. We will look at it.";

/** The app with its layer, and a sheet with its own, open or closed. */
function App() {
  const [sheet, setSheet] = useState(false);
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={() => setSheet(!sheet)}>
        <Text>Sheet</Text>
      </Pressable>
      {sheet && (
        <View testID="sheet">
          <IslandLayer />
        </View>
      )}
      <View testID="app-layer">
        <IslandLayer />
      </View>
    </View>
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("the layer over the app says it, outside any SafeAreaProvider", async () => {
  await render(<App />);
  expect(screen.queryByTestId("island")).toBeNull();
  await act(() => sayInIsland(THANKS));
  expect(screen.getByText(THANKS)).toBeOnTheScreen();
  expect(screen.getByTestId("app-layer")).toContainElement(
    screen.getByTestId("island"),
  );
  await act(() => jest.advanceTimersByTimeAsync(ISLAND_HOLD_MS + 2000));
  expect(screen.queryByTestId("island")).toBeNull();
});

test("an open sheet's layer speaks before the app's, and the app's after it closes", async () => {
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: "Sheet" }));
  await act(() => sayInIsland(THANKS));
  expect(screen.getByTestId("sheet")).toContainElement(screen.getByTestId("island"));
  await act(() => jest.advanceTimersByTimeAsync(ISLAND_HOLD_MS + 2000));
  await fireEvent.press(screen.getByRole("button", { name: "Sheet" }));
  await act(() => sayInIsland(THANKS));
  expect(screen.getByTestId("app-layer")).toContainElement(
    screen.getByTestId("island"),
  );
});

test("nothing happens with no layer on screen", async () => {
  await render(<Text>Alone</Text>);
  await act(() => sayInIsland(THANKS));
  expect(screen.queryByText(THANKS)).toBeNull();
});
