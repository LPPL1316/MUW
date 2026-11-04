import { render, screen } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { space } from "../theme/tokens";
import { SearchScreen } from "./SearchScreen";

// The phone's real edges, as the native module gives them at start. The real
// provider stays: it is what lets the search read them under the tab bar.
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 420, height: 912 },
    insets: { top: 62, right: 0, bottom: 34, left: 0 },
  },
}));
jest.mock("expo-file-system");

/** What the tab bar gives its pages, «Explore» among them: its header keeps the top edge. */
const UNDER_THE_HEADER = { top: 0, right: 0, bottom: 0, left: 0 };

/** The space above the search, from the page that holds its field. */
function spaceAboveField(): number | undefined {
  let at = screen.getByTestId("search-field").parent;
  while (at !== null) {
    const style = StyleSheet.flatten(at.props.style) as ViewStyle | undefined;
    if (typeof style?.paddingTop === "number") {
      return style.paddingTop;
    }
    at = at.parent;
  }
  return undefined;
}

test("the search opened from a page of the tab bar starts below the status bar", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={UNDER_THE_HEADER}>
      <SearchScreen visible onClose={jest.fn()} onOpenExample={jest.fn()} />
    </SafeAreaInsetsContext.Provider>,
  );
  // The status bar's 62, and the page's own small space under it.
  expect(spaceAboveField()).toBe(62 + space.sm);
});
