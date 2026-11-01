import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import type { DrawingDetail } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";
import { Animated, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { GPX_UTI } from "../route/shareGpx";
import { color, font, fontWeight } from "../theme/tokens";
import { DrawingCard } from "./DrawingCard";
import { drawingGpx } from "./drawingRoute";

// «Start» and «Export GPX» on a drawing opened on the map (TASK-307): the
// same card from «Feed» and from a profile.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const { written } =
  jest.requireMock<typeof import("../../__mocks__/expo-file-system")>(
    "expo-file-system",
  );
const isAvailable = jest.mocked(Sharing.isAvailableAsync);
const share = jest.mocked(Sharing.shareAsync);

const DRAWING = drawing as DrawingDetail;

/** The rendered tree as JSON, and every node in it `where` says. */
type Json = { props: Record<string, unknown>; children: (Json | string)[] | null };
function nodes(
  node: Json | string | null | undefined,
  where: (node: Json) => boolean,
): Json[] {
  if (node == null || typeof node === "string") {
    return [];
  }
  const own = where(node) ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap((child) => nodes(child, where))];
}
const NO_TURNS = "This route has no turn directions: follow the line on the map.";

beforeEach(() => {
  written.clear();
  isAvailable.mockReset();
  share.mockReset();
});

test("«Start» runs the track, and says it has no turn directions", async () => {
  const onStart = jest.fn();
  await render(<DrawingCard drawing={DRAWING} onBack={jest.fn()} onStart={onStart} />);
  expect(screen.getByText(NO_TURNS)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test("without a way to run it, no «Start»; the GPX is still there", async () => {
  await render(<DrawingCard drawing={DRAWING} onBack={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(screen.queryByText(NO_TURNS)).toBeNull();
  expect(screen.getByRole("button", { name: "Export GPX" })).toBeTruthy();
});

test("a drawing without a line has neither", async () => {
  await render(
    <DrawingCard
      drawing={{ ...DRAWING, track: [] }}
      onBack={jest.fn()}
      onStart={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Export GPX" })).toBeNull();
});

test("«Export GPX» writes the track on the phone and opens the share sheet", async () => {
  isAvailable.mockResolvedValue(true);
  share.mockResolvedValue();
  await render(
    <DrawingCard drawing={DRAWING} onBack={jest.fn()} onStart={jest.fn()} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Export GPX" }));
  const uri = "file:///cache/muw-star-4km.gpx";
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith(uri, {
      mimeType: "application/gpx+xml",
      UTI: GPX_UTI,
      dialogTitle: "Export GPX",
    }),
  );
  expect(written.get(uri)).toBe(drawingGpx(DRAWING));
  expect(await screen.findByRole("button", { name: "Export GPX" })).toBeTruthy();
  expect(screen.queryByText("The GPX could not be made. Try again.")).toBeNull();
});

test("a phone that cannot share says the GPX was not made", async () => {
  isAvailable.mockResolvedValue(false);
  await render(<DrawingCard drawing={DRAWING} onBack={jest.fn()} />);
  await fireEvent.press(screen.getByRole("button", { name: "Export GPX" }));
  expect(await screen.findByText("The GPX could not be made. Try again.")).toBeTruthy();
  expect(share).not.toHaveBeenCalled();
});

test("a failure of one drawing is not shown under another", async () => {
  isAvailable.mockResolvedValue(true);
  share.mockRejectedValue(new Error("closed"));
  const view = await render(<DrawingCard drawing={DRAWING} onBack={jest.fn()} />);
  await fireEvent.press(screen.getByRole("button", { name: "Export GPX" }));
  expect(await screen.findByText("The GPX could not be made. Try again.")).toBeTruthy();
  await view.rerender(
    <DrawingCard drawing={{ ...DRAWING, id: "another" }} onBack={jest.fn()} />,
  );
  expect(screen.queryByText("The GPX could not be made. Try again.")).toBeNull();
});

test("the title medium, not bold; the actions after a hairline, answering through Tap (TASK-339)", async () => {
  // Seen, not run: an animation left running would spill into the next test.
  const timing = jest
    .spyOn(Animated, "timing")
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const tagged = {
    ...DRAWING,
    tags: [{ public_id: "p-adam", username: "adam.trento" }],
  };
  await render(<DrawingCard drawing={tagged} onBack={jest.fn()} />);
  expect(screen.getByText(DRAWING.title ?? "")).toHaveStyle({
    fontSize: font.cardTitle.fontSize,
    fontWeight: font.cardTitle.fontWeight,
    color: color.text,
  });
  expect(screen.getByText("4.00 km")).toHaveStyle({ fontWeight: font.body.fontWeight });
  // One hairline, before the reactions and the actions.
  expect(
    nodes(
      screen.toJSON() as unknown as Json | null,
      (node) =>
        (
          StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) as {
            backgroundColor?: string;
          }
        )?.backgroundColor === color.hairline,
    ),
  ).toHaveLength(1);
  // A tagged name is medium too, and its pill answers the finger.
  const tag = screen.getByRole("button", { name: /'s profile$/ });
  expect(screen.getByText("adam.trento")).toHaveStyle({
    fontWeight: fontWeight.medium,
  });
  await fireEvent(tag, "pressIn");
  await fireEvent(
    screen.getByRole("button", { name: "Back to the profile" }),
    "pressIn",
  );
  expect(timing).toHaveBeenCalledTimes(2);
  timing.mockRestore();
});
