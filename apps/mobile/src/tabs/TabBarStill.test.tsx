import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useReduceMotion } from "../ui/useReduceMotion";
import { TabShell } from "./TabShell";

jest.mock("../ui/useReduceMotion");
const reduceMotion = jest.mocked(useReduceMotion);

// «Reduce Motion» on (TASK-367, with TASK-339's Tap): the tabs do not
// shrink when pressed, and a page comes at once, nothing slides.

function Shell() {
  const [page, setPage] = useState(0);
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TabShell
        pages={[
          {
            title: "Feed",
            label: "Feed",
            icon: "house",
            render: () => <Text>Feed page</Text>,
          },
          {
            title: "Draw",
            label: "Draw",
            icon: "pencil",
            render: () => <Text>Draw page</Text>,
          },
        ]}
        page={page}
        onPage={setPage}
      />
    </SafeAreaProvider>
  );
}

test("with «Reduce Motion» the tabs stay still and the page comes at once", async () => {
  reduceMotion.mockReturnValue(true);
  await render(<Shell />);
  const tab = screen.getByRole("tab", { name: "Draw" });
  // A plain Pressable: no scale to animate.
  expect(StyleSheet.flatten(tab.props.style).transform).toBeUndefined();
  await fireEvent.press(tab);
  expect(screen.getByText("Draw page")).toBeOnTheScreen();
  expect(screen.getByRole("tab", { name: "Draw" })).toBeSelected();
});

test("without it the tabs answer the finger with the press's scale", async () => {
  reduceMotion.mockReturnValue(false);
  await render(<Shell />);
  const tab = screen.getByRole("tab", { name: "Draw" });
  expect(StyleSheet.flatten(tab.props.style).transform).toBeDefined();
});
