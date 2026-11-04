import { render, screen } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import type { PostRun } from "./postRun";
import { SharePost } from "./SharePost";

jest.mock("expo-file-system");
jest.mock("react-native-view-shot");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
// The phone's real edges, as the native module gives them at start. The real
// provider stays: it is what lets the post read them under the Pager.
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 420, height: 912 },
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
}));

/** What the Pager gives its pages: its header keeps the top edge. */
const UNDER_THE_HEADER = { top: 0, right: 0, bottom: 34, left: 0 };

const RUN: PostRun = {
  key: "run-1",
  title: "Heart in Trento",
  track: [
    [46.07, 11.12],
    [46.08, 11.12],
  ],
  distanceM: 1100,
  durationMs: 6 * 60 * 1000,
};

/** The space above «Close», from the screen that holds it. */
function spaceAboveClose(): number | undefined {
  let at = screen.getByRole("header", { name: "Share your run" }).parent;
  while (at !== null) {
    const style = StyleSheet.flatten(at.props.style) as ViewStyle | undefined;
    if (typeof style?.paddingTop === "number") {
      return style.paddingTop;
    }
    at = at.parent;
  }
  return undefined;
}

test("the post opened from the Feed starts below the status bar", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={UNDER_THE_HEADER}>
      <SharePost run={RUN} onClose={jest.fn()} />
    </SafeAreaInsetsContext.Provider>,
  );
  expect(spaceAboveClose()).toBe(59);
});
