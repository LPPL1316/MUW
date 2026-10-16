import type { RouteResult } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { RouteOutcome } from "../api/routes";
import { forgetFeedMaps } from "../feed/FeedMaps";
import { saveLanguageChoice } from "../i18n/language";
import { forgetNearby } from "./nearbyCities";
import { forgetSamples, SAMPLE_SHAPES } from "./nearbySamples";
import { awayKm, NearbyTowns } from "./NearbyTowns";
import { cardMapsCredit } from "./RouteCard";

const API = "http://api.test";
const CALDONAZZO: [number, number] = [46.0036, 11.2647];
const result = fixture as unknown as RouteResult;
const done: RouteOutcome = { kind: "route", result };
const towns = [
  {
    label: "Levico Terme, Trentino – Alto Adige/Südtirol, Italy",
    point: [46.0091259, 11.3017774],
    away_m: 2929,
  },
  {
    label: "Pergine Valsugana, Trentino – Alto Adige/Südtirol, Italy",
    point: [46.0605291, 11.2406747],
    away_m: 6594,
  },
  {
    label: "Trento, Trentino – Alto Adige/Südtirol, Italy",
    point: [46.0664228, 11.1257601],
    away_m: 12760,
  },
];

beforeEach(() => {
  forgetNearby();
  forgetSamples();
  forgetFeedMaps();
});

afterEach(() => saveLanguageChoice("phone"));

function answering(body: unknown, status = 200): typeof fetch {
  return jest.fn(() => Promise.resolve(Response.json(body, { status }))) as never;
}

// One function for a body, as the app has one `fetch`: a new one at each
// drawing of the element would be a new API each time.
const apis = new Map<string, typeof fetch>();
function api(body: unknown, status = 200): typeof fetch {
  const key = `${status} ${JSON.stringify(body)}`;
  const kept = apis.get(key) ?? answering(body, status);
  apis.set(key, kept);
  return kept;
}

/** A request that never answers: the cards stay as they start. */
const never = jest.fn(() => new Promise<RouteOutcome>(() => {})) as never;

async function shown(element: React.ReactElement) {
  const view = await render(element);
  await act(async () => {});
  return view;
}

test("a card for each town near the start, with how far it is", async () => {
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: towns })}
      request={never}
    />,
  );
  expect(await screen.findByText("NEARBY TOWNS")).toBeOnTheScreen();
  expect(screen.getByText("Levico Terme")).toBeOnTheScreen();
  expect(screen.getByText("Pergine Valsugana")).toBeOnTheScreen();
  expect(screen.getByText("Trento")).toBeOnTheScreen();
  // The first is being drawn; the others wait their turn the same way.
  expect(screen.getByText("2.9 km away · Drawing…")).toBeOnTheScreen();
  expect(screen.getByText("13 km away · Drawing…")).toBeOnTheScreen();
  expect(screen.getAllByTestId("route-card")).toHaveLength(3);
  // No drawing yet, no map under it: no credit.
  expect(screen.queryByText(cardMapsCredit())).toBeNull();
});

test("a town tapped opens as a city", async () => {
  const onCity = jest.fn();
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={onCity}
      fetchFn={api({ places: towns })}
      request={never}
    />,
  );
  const card = await screen.findByLabelText("Pergine Valsugana, 6.6 km away");
  await fireEvent.press(card);
  expect(onCity).toHaveBeenCalledWith({
    label: "Pergine Valsugana, Trentino – Alto Adige/Südtirol, Italy",
    point: [46.0605291, 11.2406747],
  });
});

test("a sample drawn is on its card, with the maps' credit", async () => {
  const request = jest.fn(() => Promise.resolve(done)) as never;
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: towns.slice(0, 1) })}
      request={request}
    />,
  );
  expect(await screen.findByText("2.9 km away")).toBeOnTheScreen();
  // Its shapes one after the other, each in its turn in the app's queue
  // (TASK-287): no more pause between them.
  expect(request).toHaveBeenCalledTimes(SAMPLE_SHAPES.length);
  expect(screen.getByText(cardMapsCredit())).toBeOnTheScreen();
});

const withPhotos = [
  {
    ...towns[0],
    photo: { url: "/city-photos/Q1.jpg", credit: "© LBM1948 · CC BY-SA 4.0" },
  },
  { ...towns[1], photo: { url: "/city-photos/Q2.jpg", credit: null } },
  towns[2],
];

test("a town's photo in the place of its drawing, with its credit (TASK-283)", async () => {
  // Trento's samples are still being drawn.
  const request = jest.fn((_api: string, body: { start: [number, number] }) =>
    body.start[0] === towns[2].point[0]
      ? new Promise<RouteOutcome>(() => {})
      : Promise.resolve(done),
  ) as never;
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: withPhotos })}
      request={request}
    />,
  );
  const photos = await screen.findAllByTestId("route-card-photo");
  expect(photos.map((photo) => photo.props.source.uri)).toEqual([
    `${API}/city-photos/Q1.jpg`,
    `${API}/city-photos/Q2.jpg`,
  ]);
  // Who, shortened when it is long, and the licence, never.
  expect(screen.getByText("© LBM1948 ·")).toBeOnTheScreen();
  expect(screen.getByText("CC BY-SA 4.0")).toBeOnTheScreen();
  // A photo is not waiting for a drawing; the town without one still is.
  expect(screen.getByText("2.9 km away")).toBeOnTheScreen();
  expect(screen.getByText("6.6 km away")).toBeOnTheScreen();
  expect(screen.getByText("13 km away · Drawing…")).toBeOnTheScreen();
  // Levico's shape is drawn all the same, but not on its card: no map, no
  // maps' credit.
  expect(request).toHaveBeenCalled();
  expect(screen.queryByTestId("route-card-map")).toBeNull();
  expect(screen.queryByText(cardMapsCredit())).toBeNull();
  // The cards open the towns as before.
  expect(screen.getByLabelText("Levico Terme, 2.9 km away")).toBeOnTheScreen();
});

test("a photo that does not load gives its card back to the drawing", async () => {
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: withPhotos.slice(0, 1) })}
      request={never}
    />,
  );
  const photo = await screen.findByTestId("route-card-photo");
  await act(async () => {
    fireEvent(photo, "error", { nativeEvent: { error: "404" } });
  });
  expect(screen.queryByTestId("route-card-photo")).toBeNull();
  expect(screen.queryByText("CC BY-SA 4.0")).toBeNull();
  expect(screen.getByText("2.9 km away · Drawing…")).toBeOnTheScreen();
});

test("the page's own credit takes the place of the section's", async () => {
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: towns.slice(0, 1) })}
      request={jest.fn(() => Promise.resolve(done)) as never}
      credit={false}
    />,
  );
  expect(await screen.findByText("2.9 km away")).toBeOnTheScreen();
  expect(screen.queryByText(cardMapsCredit())).toBeNull();
});

test("nothing without towns, without a start, or without an answer", async () => {
  const none = await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: [] })}
      request={never}
    />,
  );
  expect(none.toJSON()).toBeNull();
  await none.unmount();
  forgetNearby();
  const fetchFn = answering({ places: towns });
  const noStart = await shown(
    <NearbyTowns
      apiUrl={API}
      near={null}
      width={360}
      onCity={jest.fn()}
      fetchFn={fetchFn}
      request={never}
    />,
  );
  expect(noStart.toJSON()).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
  await noStart.unmount();
  const off = await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ error: { code: "unavailable", message: "off" } }, 503)}
      request={never}
    />,
  );
  expect(off.toJSON()).toBeNull();
});

test("the samples stop when the section leaves the page", async () => {
  let release: (outcome: RouteOutcome) => void = () => {};
  const request = jest.fn(
    () => new Promise<RouteOutcome>((resolve) => (release = resolve)),
  );
  const view = await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: towns })}
      request={request as never}
    />,
  );
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const signal = (request.mock.calls[0] as unknown[])[2] as { signal: AbortSignal };
  await view.unmount();
  expect(signal.signal.aborted).toBe(true);
  await act(async () => release(done));
  expect(request).toHaveBeenCalledTimes(1);
});

test("in Italian, with the comma", async () => {
  saveLanguageChoice("it");
  await shown(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={api({ places: towns })}
      request={never}
    />,
  );
  expect(await screen.findByText("PAESI VICINI")).toBeOnTheScreen();
  expect(screen.getByLabelText("Levico Terme, a 2,9 km")).toBeOnTheScreen();
  expect(awayKm(12760)).toBe("13");
  expect(awayKm(9940)).toBe("9,9");
});
