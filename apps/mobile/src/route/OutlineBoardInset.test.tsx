import type { ImageOutline } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { OutlineBoard } from "./OutlineBoard";

// The phone's real edges, as the native module gives them at start. The real
// provider stays: it is what lets the board read them under the Pager.
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 420, height: 912 },
    insets: { top: 62, right: 0, bottom: 34, left: 0 },
  },
}));

/** What the Pager gives its pages, «Draw» among them: its header keeps the top edge. */
const UNDER_THE_HEADER = { top: 0, right: 0, bottom: 34, left: 0 };

const OUTLINE: ImageOutline = {
  points: [
    [-1, -0.5],
    [1, -0.5],
    [0, 0.5],
    [-1, -0.5],
  ],
  image_points: [
    [0.1, 0.9],
    [0.9, 0.9],
    [0.5, 0.1],
    [0.1, 0.9],
  ],
  aspect: 4 / 3,
  strokes: [],
  image_strokes: [],
};

/** The space above the board, from the screen that holds its title. */
function spaceAboveBoard(): number | undefined {
  let at = screen.getByText("Edit the outline").parent;
  while (at !== null) {
    const style = StyleSheet.flatten(at.props.style) as ViewStyle | undefined;
    if (typeof style?.paddingTop === "number") {
      return style.paddingTop;
    }
    at = at.parent;
  }
  return undefined;
}

test("the board opened from «Draw» starts below the status bar", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={UNDER_THE_HEADER}>
      <OutlineBoard
        visible
        onClose={jest.fn()}
        picture={{ uri: "file:///apple.jpg", width: 800, height: 600 }}
        outline={OUTLINE}
        edits={{
          earlier: [],
          edit: { status: "idle" },
          add: jest.fn(),
          undo: jest.fn(),
        }}
      />
    </SafeAreaInsetsContext.Provider>,
  );
  expect(spaceAboveBoard()).toBe(62);
});
