import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { Place } from "../places/photon";
import { CityPicker } from "./ExploreTools";

const newYork: Place = { label: "New York, United States", point: [40.7127, -74.006] };
const paris: Place = {
  label: "Paris, Ile-de-France, France",
  point: [48.8535, 2.3484],
};
const parma: Place = { label: "Parma, Emilia-Romagna, Italy", point: [44.802, 10.328] };
const arena: Place = {
  label: "Verona Arena, Verona, Italy",
  point: [45.439, 10.9949],
  kind: "place",
};

function answers(places: Place[]) {
  return jest.fn().mockResolvedValue(Response.json({ places }));
}

test("a featured city is one tap: its centre comes from the API", async () => {
  const fetchFn = answers([newYork]);
  const onCity = jest.fn();
  await render(
    <CityPicker apiUrl="http://api" city={null} onCity={onCity} fetchFn={fetchFn} />,
  );
  await fireEvent.press(screen.getByText("New York"));
  expect(fetchFn.mock.calls[0][0]).toBe("http://api/cities?q=New%20York");
  expect(onCity).toHaveBeenCalledWith(newYork);
});

test("a featured city the phone has opens at once; one asked is kept (TASK-287)", async () => {
  const fetchFn = answers([newYork]);
  const onCity = jest.fn();
  const kept = new Map<string, Place>([["Paris", paris]]);
  const featured = {
    read: (name: string) => kept.get(name) ?? null,
    keep: jest.fn((name: string, place: Place) => kept.set(name, place)),
  };
  await render(
    <CityPicker
      apiUrl="http://api"
      city={null}
      onCity={onCity}
      fetchFn={fetchFn}
      featured={featured}
    />,
  );
  await fireEvent.press(screen.getByText("Paris"));
  expect(onCity).toHaveBeenCalledWith(paris);
  // Told to the API all the same, but not asked for.
  expect(fetchFn.mock.calls.map(([url]) => url)).toEqual(["http://api/signals"]);
  expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({
    kind: "city_chosen",
    label: paris.label,
    via: "featured",
  });

  await fireEvent.press(screen.getByText("New York"));
  expect(onCity).toHaveBeenLastCalledWith(newYork);
  expect(featured.keep).toHaveBeenCalledWith("New York", newYork);
  fetchFn.mockClear();
  await fireEvent.press(screen.getByText("New York"));
  expect(fetchFn.mock.calls.map(([url]) => url)).toEqual(["http://api/signals"]);
});

test("cities from around the world, and the recent ones first", async () => {
  await render(
    <CityPicker apiUrl="http://api" city={null} onCity={jest.fn()} recent={[parma]} />,
  );
  for (const name of ["London", "Tokyo", "Dubai", "Torino", "Barcelona"]) {
    expect(screen.getByText(name)).toBeOnTheScreen();
  }
  expect(screen.getByText("↺ Parma")).toBeOnTheScreen();
});

async function typeIn(text: string, fetchFn: typeof fetch, onCity = jest.fn()) {
  await render(
    <CityPicker
      apiUrl="http://api"
      city={null}
      onCity={onCity}
      fetchFn={fetchFn}
      suggestDelayMs={10}
    />,
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("Type a city or a place"),
    text,
  );
  await act(async () => {
    jest.advanceTimersByTime(20);
  });
  return onCity;
}

test("typing suggests cities, and a tap chooses one", async () => {
  jest.useFakeTimers();
  const fetchFn = answers([parma, paris]);
  const onCity = jest.fn();
  await render(
    <CityPicker
      apiUrl="http://api"
      city={null}
      onCity={onCity}
      fetchFn={fetchFn}
      suggestDelayMs={10}
    />,
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("Type a city or a place"),
    "Par",
  );
  await act(async () => {
    jest.advanceTimersByTime(20);
  });
  expect(fetchFn.mock.calls[0][0]).toBe("http://api/city-suggestions?q=Par");
  expect(screen.getByText("City centre · Ile-de-France, France")).toBeOnTheScreen();
  await fireEvent.press(await screen.findByLabelText(paris.label));
  // An API before TASK-138 says no kind: a city.
  expect(onCity).toHaveBeenCalledWith({ ...paris, kind: "city" });
  jest.useRealTimers();
});

test("places come too, half a word is enough (TASK-138)", async () => {
  jest.useFakeTimers();
  const onCity = await typeIn("arena di ver", answers([arena, parma]));
  expect(screen.getByText("Verona Arena")).toBeOnTheScreen();
  expect(screen.getByText("Verona, Italy")).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText(arena.label));
  expect(onCity).toHaveBeenCalledWith(arena);
  jest.useRealTimers();
});

test("Enter takes the first suggestion", async () => {
  jest.useFakeTimers();
  const fetchFn = answers([arena, parma]);
  const onCity = await typeIn("arena", fetchFn);
  await fireEvent(
    screen.getByPlaceholderText("Type a city or a place"),
    "submitEditing",
  );
  expect(onCity).toHaveBeenCalledWith(arena);
  // Asked once; then the choice told to the API (TASK-142).
  expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
    "http://api/city-suggestions?q=arena",
    "http://api/signals",
  ]);
  expect(JSON.parse(fetchFn.mock.calls[1][1].body)).toEqual({
    kind: "city_chosen",
    label: arena.label,
    point: arena.point,
    place: true,
    via: "suggestion",
  });
  jest.useRealTimers();
});

test("nothing found says so", async () => {
  jest.useFakeTimers();
  await typeIn("zzz", answers([]));
  expect(screen.getByText("No city or place matches “zzz”.")).toBeOnTheScreen();
  jest.useRealTimers();
});

test("one letter asks nothing", async () => {
  jest.useFakeTimers();
  const fetchFn = answers([paris]);
  await render(
    <CityPicker
      apiUrl="http://api"
      city={null}
      onCity={jest.fn()}
      fetchFn={fetchFn}
      suggestDelayMs={10}
    />,
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText("Type a city or a place"),
    "P",
  );
  await act(async () => {
    jest.advanceTimersByTime(50);
  });
  expect(fetchFn).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test("«Near me» is the first choice, on until a city is chosen (TASK-176)", async () => {
  const onCity = jest.fn();
  await render(
    <CityPicker apiUrl="http://api" city={null} onCity={onCity} recent={[parma]} />,
  );
  const chips = screen.getAllByRole("button");
  expect(chips[0]).toHaveTextContent("Near me");
  expect(chips[0]).toBeSelected();
  expect(chips[1]).toHaveTextContent("↺ Parma");
  expect(screen.getByTestId("near-me-mark")).toBeOnTheScreen();
  // No button apart from the row: «My start» is gone.
  expect(screen.queryByText("My start")).toBeNull();
});

test("from a chosen city, «Near me» goes back to the start", async () => {
  const onCity = jest.fn();
  await render(
    <CityPicker
      apiUrl="http://api"
      city={newYork}
      onCity={onCity}
      recent={[newYork]}
    />,
  );
  // The city is the chip that is on, «Near me» the way back.
  expect(screen.getByRole("button", { name: "↺ New York" })).toBeSelected();
  const nearMe = screen.getByRole("button", { name: "Near me" });
  expect(nearMe).not.toBeSelected();
  await fireEvent.press(nearMe);
  expect(onCity).toHaveBeenCalledWith(null);
});

test("a city search that fails says so", async () => {
  const fetchFn = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
  await render(
    <CityPicker apiUrl="http://api" city={null} onCity={jest.fn()} fetchFn={fetchFn} />,
  );
  await fireEvent.press(screen.getByText("Tokyo"));
  expect(await screen.findByText(/did not answer/)).toBeOnTheScreen();
});

test("the city chosen is told to the API, with how it was chosen (TASK-142)", async () => {
  const onSignal = jest.fn();
  const onCity = jest.fn();
  await render(
    <CityPicker
      apiUrl="http://api"
      city={null}
      onCity={onCity}
      recent={[parma]}
      fetchFn={answers([newYork])}
      onSignal={onSignal}
    />,
  );
  await fireEvent.press(screen.getByText("↺ Parma"));
  await fireEvent.press(screen.getByText("New York"));
  expect(onSignal.mock.calls.map(([signal]) => signal)).toEqual([
    { kind: "city_chosen", label: parma.label, point: parma.point, via: "recent" },
    {
      kind: "city_chosen",
      label: newYork.label,
      point: newYork.point,
      via: "featured",
    },
  ]);
});

test("a name typed and searched with Enter is told as typed", async () => {
  const onSignal = jest.fn();
  await render(
    <CityPicker
      apiUrl="http://api"
      city={null}
      onCity={jest.fn()}
      fetchFn={answers([paris])}
      onSignal={onSignal}
    />,
  );
  const field = screen.getByPlaceholderText("Type a city or a place");
  await fireEvent.changeText(field, "Paris");
  await fireEvent(field, "submitEditing");
  expect(onSignal).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "city_chosen", label: paris.label, via: "typed" }),
  );
});

test("of two cities asked, the last asked wins (TASK-254)", async () => {
  const london: Place = {
    label: "London, England, United Kingdom",
    point: [51.5, -0.12],
  };
  const pending = new Map<string, (response: Response) => void>();
  const fetchFn = jest.fn(
    (input: RequestInfo | URL) =>
      new Promise<Response>((resolve) => {
        pending.set(decodeURIComponent(String(input).split("q=")[1]), resolve);
      }),
  );
  const onCity = jest.fn();
  const { unmount } = await render(
    <CityPicker apiUrl="http://api" city={null} onCity={onCity} fetchFn={fetchFn} />,
  );
  await fireEvent.press(screen.getByText("Paris"));
  await fireEvent.press(screen.getByText("London"));
  expect(screen.getByText("London …")).toBeOnTheScreen();
  // London answers first, then Paris, late: the city stays London.
  await act(async () => pending.get("London")?.(Response.json({ places: [london] })));
  expect(onCity).toHaveBeenCalledWith(london);
  await act(async () => pending.get("Paris")?.(Response.json({ places: [paris] })));
  expect(onCity).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Paris …")).toBeNull();

  // Asked, then «Near me» before the answer: the answer is not a choice.
  await fireEvent.press(screen.getByText("Rome"));
  await fireEvent.press(screen.getByText("Near me"));
  await act(async () => pending.get("Rome")?.(Response.json({ places: [parma] })));
  expect(onCity).toHaveBeenLastCalledWith(null);
  expect(onCity).toHaveBeenCalledTimes(2);

  // Gone from the screen: a late answer chooses nothing.
  await fireEvent.press(screen.getByText("Tokyo"));
  await unmount();
  await act(async () => pending.get("Tokyo")?.(Response.json({ places: [newYork] })));
  expect(onCity).toHaveBeenCalledTimes(2);
});
