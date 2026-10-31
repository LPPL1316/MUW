import open from "@shaperoute/shared-types/fixtures/contest.json";
import type { Contest } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { space } from "../theme/tokens";
import { ContestCard } from "./ContestCard";

// The phone's real edges, as the native module gives them at start. The real
// provider stays: it is what lets the rules read them under the Pager.
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 420, height: 912 },
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
}));

/** What the Pager gives its pages: its header keeps the top edge. */
const UNDER_THE_HEADER = { top: 0, right: 0, bottom: 34, left: 0 };

/** The space above the rules, from the page that holds their title. */
function spaceAboveRules(): number | undefined {
  let at = screen.getByRole("header", { name: "Official rules" }).parent;
  while (at !== null) {
    const style = StyleSheet.flatten(at.props.style) as ViewStyle | undefined;
    if (typeof style?.paddingTop === "number") {
      return style.paddingTop;
    }
    at = at.parent;
  }
  return undefined;
}

test("the rules opened from the Feed's card start below the status bar", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={UNDER_THE_HEADER}>
      <ContestCard contest={open as Contest} mine={null} onOpen={jest.fn()} />
    </SafeAreaInsetsContext.Provider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "How it works" }));
  expect(spaceAboveRules()).toBe(59 + space.xl);
});
