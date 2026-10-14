import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { DrawIdeas, TOUR_CATEGORIES, toursFrom } from "./DrawIdeas";
import { SAMPLE_PICTURES } from "./samplePictures";

/**
 * The two rows at the foot of «Draw» (TASK-280): the city tours around the
 * start and the ready-made pictures. The app around them is in
 * __tests__/AppDrawIdeas.test.tsx.
 */

const TRENTO: [number, number] = [46.0679, 11.1211];

test("where the tours start: «near your start» from the GPS, a place by its name", () => {
  expect(toursFrom(null)).toBeNull();
  expect(toursFrom({ point: TRENTO, source: "gps" })).toBe("near your start");
  expect(
    toursFrom({
      point: TRENTO,
      source: "search",
      label: "Trento, Trentino-Alto Adige",
    }),
  ).toBe("near Trento");
});

test("the four tours the user chose, each saying where it starts; a tap asks for it", async () => {
  const onTour = jest.fn();
  await render(
    <DrawIdeas
      where="near your start"
      onTour={onTour}
      chosen={null}
      onPicture={jest.fn()}
    />,
  );
  expect(TOUR_CATEGORIES).toEqual([
    "Famous Places",
    "Best Views",
    "Hidden Gems",
    "Romantic",
  ]);
  expect(screen.getByText("CITY TOURS")).toBeOnTheScreen();
  const row = within(screen.getByTestId("city-tours"));
  for (const category of TOUR_CATEGORIES) {
    expect(
      row.getByRole("button", { name: `${category}, near your start` }),
    ).toBeOnTheScreen();
  }
  expect(row.getAllByText("near your start")).toHaveLength(4);
  await fireEvent.press(
    row.getByRole("button", { name: "Best Views, near your start" }),
  );
  expect(onTour).toHaveBeenCalledWith("Best Views");
});

test("without a start there are no tours, the pictures stay", async () => {
  await render(
    <DrawIdeas where={null} onTour={jest.fn()} chosen={null} onPicture={jest.fn()} />,
  );
  expect(screen.queryByText("CITY TOURS")).toBeNull();
  expect(screen.queryByTestId("city-tours")).toBeNull();
  expect(screen.getByText("PICTURES")).toBeOnTheScreen();
});

test("the twelve pictures, each by its name; a tap chooses it, the chosen one shows", async () => {
  const onPicture = jest.fn();
  await render(
    <DrawIdeas
      where="near your start"
      onTour={jest.fn()}
      chosen="anchor"
      onPicture={onPicture}
    />,
  );
  const row = within(screen.getByTestId("pictures"));
  expect(row.getAllByRole("button")).toHaveLength(12);
  for (const picture of SAMPLE_PICTURES) {
    expect(row.getByRole("button", { name: picture.name })).toBeOnTheScreen();
  }
  expect(row.getByRole("button", { name: "Anchor" })).toBeSelected();
  expect(row.getByRole("button", { name: "Rocket" })).not.toBeSelected();
  await fireEvent.press(row.getByRole("button", { name: "Rocket" }));
  expect(onPicture).toHaveBeenCalledWith(
    SAMPLE_PICTURES.find((picture) => picture.id === "rocket"),
  );
});
