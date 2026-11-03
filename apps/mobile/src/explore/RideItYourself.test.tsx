import { fireEvent, render, screen } from "@testing-library/react-native";

import { BIKE_IDEAS, bikeIdeaDetail, bikeIdeaName, bikeIdeaRoute } from "./bikeIdeas";
import { optionsOf, toRequest } from "./explored";
import { RideItYourself } from "./RideItYourself";

jest.mock("react-native-webview");

test("the three routes the user chose for Explore, all by bike", () => {
  expect(BIKE_IDEAS.map((idea) => idea.id)).toEqual([
    "bike-ghost",
    "bike-bat",
    "bike-pumpkin",
  ]);
  expect(BIKE_IDEAS.every((idea) => idea.activity === "cycling")).toBe(true);
});

test("a card says the city, the figure, the bike and the true distance, nothing else", async () => {
  await render(<RideItYourself width={360} onOpen={() => {}} maps={false} />);
  expect(screen.getByText("RIDE IT YOURSELF")).toBeTruthy();
  expect(screen.getByText("Barcelona · Ghost")).toBeTruthy();
  expect(screen.getByText("Madrid · Bat")).toBeTruthy();
  expect(screen.getByText("Turin · Pumpkin")).toBeTruthy();
  expect(
    screen.getByText("Routes drawn by MuW. Nobody has ridden them yet."),
  ).toBeTruthy();
  expect(screen.queryByText(/calories|kcal|min\b|km\/h/i)).toBeNull();
});

test("no name of a season on a card", () => {
  for (const idea of BIKE_IDEAS) {
    expect(bikeIdeaName(idea)).not.toMatch(/halloween|autumn/i);
  }
});

test("a tap opens the card's route", async () => {
  const onOpen = jest.fn();
  await render(<RideItYourself width={360} onOpen={onOpen} maps={false} />);
  await fireEvent.press(screen.getByText("Madrid · Bat"));
  expect(onOpen).toHaveBeenCalledWith(
    expect.objectContaining({ id: "bike-bat", shape: "bat" }),
  );
});

test.each(BIKE_IDEAS.map((idea) => idea.id))(
  "%s is whole on the phone, a bike route Start can read",
  (id) => {
    const detail = bikeIdeaDetail(id);
    if (detail === undefined) {
      throw new Error(id);
    }
    const request = toRequest(detail);
    expect(request).toMatchObject({ activity: "cycling", start: detail.points[0] });
    const idea = BIKE_IDEAS.find((one) => one.id === id)!;
    expect(optionsOf(bikeIdeaRoute(idea), detail)).toHaveLength(1);
  },
);

test("any other id is not one of them", () => {
  expect(bikeIdeaDetail("trento-star")).toBeUndefined();
});
