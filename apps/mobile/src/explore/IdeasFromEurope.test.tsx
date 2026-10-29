import done from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { cardMapsCredit } from "./RouteCard";
import type { ThemedIdea } from "./themedIdeas";
import { IdeasFromEurope } from "./IdeasFromEurope";
import type { ThemedResult } from "./themedRoutes";

const result = done.result as ThemedResult;
const idea = (city: string, category: string, shape: string): ThemedIdea => ({
  id: `${city}-${category}-${shape}`,
  city,
  category,
  text: `${category} ${shape} 8 km`,
  preview: [
    [41.89, 12.49],
    [41.891, 12.491],
    [41.89, 12.49],
  ],
  result: { ...result, shape, city, distance_m: 8123 },
});
const IDEAS = [
  idea("Rome", "Famous Places", "star"),
  idea("Paris", "Best Views", "heart"),
];

test("a row of cards, each the city, its shape, its category and its length", async () => {
  const onIdea = jest.fn();
  await render(<IdeasFromEurope width={350} onIdea={onIdea} ideas={IDEAS} />);
  expect(screen.getByText("IDEAS FROM EUROPE")).toBeOnTheScreen();
  const row = within(screen.getByTestId("themed-ideas"));
  expect(row.getAllByRole("button")).toHaveLength(2);
  expect(row.getByText("Rome · Star")).toBeOnTheScreen();
  expect(row.getByText("Famous Places · 8.1 km")).toBeOnTheScreen();
  expect(row.getByText("Paris · Heart")).toBeOnTheScreen();
  // The maps under the lines say whose they are.
  expect(screen.getByText(cardMapsCredit())).toBeOnTheScreen();

  await fireEvent.press(row.getByLabelText("Paris, Heart, Best Views, 8.1 km"));
  expect(onIdea).toHaveBeenCalledWith(IDEAS[1]);
});

test("without ideas there is nothing", async () => {
  await render(<IdeasFromEurope width={350} onIdea={jest.fn()} ideas={[]} />);
  expect(screen.queryByText("IDEAS FROM EUROPE")).toBeNull();
});
