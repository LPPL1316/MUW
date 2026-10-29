import done from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";

import { forgetPlacePhotos } from "./placePhotos";
import { mapStops, passedStops, StopPhotos } from "./StopPhotos";
import type { ThemedStop } from "./themedRoutes";

const API = "http://192.168.1.23:8000";
const stops = done.result.stops as ThemedStop[];

/** An idea's places: their items, no photos, as tools/themed_ideas.py
 * writes them. */
const IDEA: ThemedStop[] = [
  { name: "Colosseo", point: [41.8902, 12.4922], passed: true, wikidata: "Q10285" },
  { name: "Vicolo", point: [41.8903, 12.4925], passed: true, wikidata: null },
  { name: "Pantheon", point: [41.8986, 12.4769], passed: true, wikidata: "Q99309" },
  { name: "Trevi", point: [41.9009, 12.4833], passed: false, wikidata: "Q186579" },
];

beforeEach(() => {
  forgetPlacePhotos();
});

test("the places passed by, numbered as the map numbers them", () => {
  expect(passedStops(stops).map((s) => [s.n, s.name])).toEqual([
    [1, "Strada di Galliera"],
    [2, "La lotta tra la tigre e il serpente"],
  ]);
  const onMap = mapStops(stops);
  expect(onMap.map((s) => s.name)).toEqual([
    "1 Strada di Galliera",
    "2 La lotta tra la tigre e il serpente",
    ...stops.slice(2).map((s) => s.name),
  ]);
  expect(onMap.map((s) => s.point)).toEqual(stops.map((s) => s.point));
});

test("a route the API planned: its photos, the credit small on them, a name alone without", async () => {
  const fetchFn = jest.fn();
  const onPlace = jest.fn();
  await render(
    <StopPhotos stops={stops} apiUrl={API} onPlace={onPlace} fetchFn={fetchFn} />,
  );
  const cards = screen.getAllByTestId("stop-photo");
  expect(cards).toHaveLength(2);
  const first = within(cards[0]);
  expect(first.getByText("1 Strada di Galliera")).toBeOnTheScreen();
  expect(first.getByTestId("stop-photo-image").props.source).toEqual({
    uri: `${API}/city-photos/Q3970434.jpg`,
    headers: {},
  });
  expect(first.getByText("Wikimedia Commons ·")).toBeOnTheScreen();
  expect(first.getByText("CC BY-SA 4.0")).toBeOnTheScreen();
  // An item but no free photo: the name alone.
  const second = within(cards[1]);
  expect(second.getByText("2 La lotta tra la tigre e il serpente")).toBeOnTheScreen();
  expect(second.queryByTestId("stop-photo-image")).toBeNull();
  // Nothing asked: the photos came with the route.
  expect(fetchFn).not.toHaveBeenCalled();

  await fireEvent.press(
    screen.getByRole("button", { name: "2 La lotta tra la tigre e il serpente" }),
  );
  expect(onPlace).toHaveBeenCalledWith([44.5025217, 11.3461454]);
});

test("an idea asks the API for its places' photos, by their items", async () => {
  const fetchFn = jest.fn(async () =>
    Response.json({
      photos: { Q10285: { url: "/city-photos/Q10285.jpg", credit: "© A · CC0" } },
    }),
  );
  await render(<StopPhotos stops={IDEA} apiUrl={API} fetchFn={fetchFn} />);
  await act(async () => {});
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(String((fetchFn.mock.calls[0] as unknown[])[0])).toBe(
    `${API}/place-photos?items=Q10285%2CQ99309`,
  );
  const cards = screen.getAllByTestId("stop-photo");
  expect(
    cards.map((c) => within(c).queryByTestId("stop-photo-image") !== null),
  ).toEqual([true, false, false]);
  expect(within(cards[2]).getByText("3 Pantheon")).toBeOnTheScreen();
  expect(screen.queryByText(/Trevi/)).toBeNull();
});

test("a photo that does not load leaves the name alone", async () => {
  await render(<StopPhotos stops={stops} apiUrl={API} fetchFn={jest.fn()} />);
  await fireEvent(screen.getByTestId("stop-photo-image"), "error");
  expect(screen.queryByTestId("stop-photo-image")).toBeNull();
  expect(screen.getByText("1 Strada di Galliera")).toBeOnTheScreen();
});

test("an API before the photos: the names alone; none passed by: no row", async () => {
  const old = stops.map(({ name, point, passed }) => ({ name, point, passed }));
  await render(<StopPhotos stops={old} apiUrl={API} fetchFn={jest.fn()} />);
  expect(screen.getAllByTestId("stop-photo")).toHaveLength(2);
  expect(screen.queryByTestId("stop-photo-image")).toBeNull();

  const none = stops.map((s) => ({ ...s, passed: false }));
  await render(<StopPhotos stops={none} apiUrl={API} fetchFn={jest.fn()} />);
  expect(screen.queryByTestId("stop-photos")).toBeNull();
});
