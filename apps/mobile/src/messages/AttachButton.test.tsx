import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AttachButton, type AttachKind } from "./AttachButton";

// On iOS the system's library, shown while a sheet is closing, never comes up
// (TASK-358): what was chosen waits for the sheet to be gone. The real order
// is only seen on a phone; this test keeps the code asking for it.

// What the Modal was told to call when it has gone: the test says when.
const mockGone: { current: (() => void) | undefined } = { current: undefined };

jest.mock("react-native/Libraries/Modal/Modal", () => ({
  __esModule: true,
  default: ({
    visible,
    onDismiss,
    children,
  }: {
    visible?: boolean;
    onDismiss?: () => void;
    children?: unknown;
  }) => {
    mockGone.current = onDismiss;
    return visible === true ? children : null;
  },
}));

const KINDS: AttachKind[] = ["photo", "video", "drawing"];
const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const realOS = Platform.OS;

afterEach(() => {
  Platform.OS = realOS;
});

/** The «+» on screen, its sheet open, and how to tell it has gone. */
async function openSheet() {
  const onPick = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <AttachButton kinds={KINDS} disabled={false} onPick={onPick} />
    </SafeAreaProvider>,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Add a photo, a video or a drawing" }),
  );
  return { onPick, gone: () => act(async () => mockGone.current?.()) };
}

test.each([
  ["Photo", "photo"],
  ["Video", "video"],
  ["Drawing", "drawing"],
])("on iOS «%s» opens only once the sheet has gone, and once", async (label, kind) => {
  Platform.OS = "ios";
  const { onPick, gone } = await openSheet();
  await fireEvent.press(screen.getByRole("button", { name: label }));
  expect(onPick).not.toHaveBeenCalled();
  await gone();
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onPick).toHaveBeenCalledWith(kind);
  await gone();
  expect(onPick).toHaveBeenCalledTimes(1);
});

test("«Cancel» opens nothing when the sheet has gone", async () => {
  Platform.OS = "ios";
  const { onPick, gone } = await openSheet();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  await gone();
  expect(onPick).not.toHaveBeenCalled();
});

test("on Android what was chosen opens at once", async () => {
  Platform.OS = "android";
  const { onPick } = await openSheet();
  await fireEvent.press(screen.getByRole("button", { name: "Photo" }));
  expect(onPick).toHaveBeenCalledWith("photo");
});
