import detail from "@shaperoute/shared-types/fixtures/drawing-details.json";
import skiNames from "@shaperoute/shared-types/fixtures/ski-names.json";
import type { DrawingDetail, SkiNames } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { DrawingCard } from "./DrawingCard";
import { DrawingsContext, useDrawingsDoor } from "./drawingsDoor";
import { FollowsContext } from "./followsDoor";

// The post of a day of skiing has its lifts and pistes under the
// description (TASK-375 part D); any other post never asks for them.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const DRAWING = detail as DrawingDetail;

function Card({ drawing, names }: { drawing: DrawingDetail; names: jest.Mock }) {
  const nothing = useDrawingsDoor();
  return (
    <DrawingsContext.Provider value={{ ...nothing, skiNamesOf: names }}>
      <FollowsContext.Provider
        value={{
          apiUrl: null,
          account: {
            state: { status: "signedOut", notice: null },
            sessionEnded: jest.fn(),
          },
          openProfile: jest.fn(),
        }}
      >
        <DrawingCard drawing={drawing} onBack={jest.fn()} />
      </FollowsContext.Provider>
    </DrawingsContext.Provider>
  );
}

test("a day of skiing shows its lifts and pistes", async () => {
  const names = jest.fn(async () => skiNames as SkiNames);
  await render(<Card drawing={{ ...DRAWING, activity: "skiing" }} names={names} />);
  expect(names).toHaveBeenCalledWith(DRAWING.id);
  expect(await screen.findByText("Lifts and pistes")).toBeOnTheScreen();
  expect(screen.getByText("Pista Rossa ×2")).toBeOnTheScreen();
});

test("a run, and a day of cross-country skiing, never ask for them", async () => {
  const names = jest.fn(async () => skiNames as SkiNames);
  await render(<Card drawing={DRAWING} names={names} />);
  await render(<Card drawing={{ ...DRAWING, activity: "xc_skiing" }} names={names} />);
  expect(names).not.toHaveBeenCalled();
  expect(screen.queryByText("Lifts and pistes")).toBeNull();
});
