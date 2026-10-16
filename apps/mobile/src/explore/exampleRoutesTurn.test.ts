/**
 * How far an example's shape is turned (TASK-232, ADR-0195): kept with the
 * example as the engine said it, for its card and for the map, also in the
 * phone's file. The rest of the examples is in exampleRoutes.test.ts.
 */
import type { RouteResult, Shape } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";
import tiltedFixture from "@shaperoute/shared-types/fixtures/route-result-tilted.json";
import { act, renderHook } from "@testing-library/react-native";

import type { requestRoute, RouteOutcome } from "../api/routes";
import type { Place } from "../places/photon";
import {
  asRecommended,
  cityKey,
  drawExamples,
  type ExampleDetail,
  forgetExamples,
  movedExample,
  readKept,
  type Storage,
  useCityExamples,
} from "./exampleRoutes";
import { turnOf } from "./recommendedRoutes";

const upright = fixture as unknown as RouteResult;
const [other] = upright.alternatives ?? [];
/** The engine's route turned 30° counterclockwise; the other one 20° clockwise. */
const tilted: RouteResult = {
  ...upright,
  rotation_deg: 30,
  alternatives: [{ ...other, rotation_deg: -20 }],
};
const vercelli: Place = {
  label: "Vercelli, Piedmont, Italy",
  point: [45.3252, 8.4228],
  kind: "city",
};

/** A file in memory, as the phone's. */
function memory(): Storage & { kept: Record<string, ExampleDetail[]> } {
  const store = {
    kept: {} as Record<string, ExampleDetail[]>,
    load: () => JSON.parse(JSON.stringify(store.kept)),
    save: (kept: Record<string, ExampleDetail[]>) => {
      store.kept = kept;
    },
  };
  return store;
}

/** The API by hand: each request waits until the test answers it. */
function api() {
  const asked: { shape: Shape; answer: (o: RouteOutcome) => void }[] = [];
  const request = jest.fn(
    (_url: string, body: { shape?: Shape | null }) =>
      new Promise<RouteOutcome>((resolve) => {
        asked.push({ shape: body.shape as Shape, answer: resolve });
      }),
  ) as unknown as typeof requestRoute & jest.Mock;
  return { request, asked };
}

beforeEach(() => {
  forgetExamples();
});

afterAll(() => {
  forgetExamples();
});

test("the turn to keep: degrees that turn, nothing else", () => {
  expect(turnOf({ rotation_deg: 30 })).toEqual({ rotation_deg: 30 });
  expect(turnOf({ rotation_deg: -12.5 })).toEqual({ rotation_deg: -12.5 });
  // Upright, or not said, or not degrees: none.
  expect(turnOf({ rotation_deg: 0 })).toEqual({});
  expect(turnOf({})).toEqual({});
  expect(turnOf({ rotation_deg: "30" })).toEqual({});
  expect(turnOf({ rotation_deg: Number.NaN })).toEqual({});
});

test("an example says how it is turned, on its card and whole, each route its own", () => {
  const { route, detail } = asRecommended(vercelli, "heart", tilted);
  expect(route.rotation_deg).toBe(30);
  expect(detail.rotation_deg).toBe(30);
  expect(detail.alternatives?.map((a) => a.rotation_deg)).toEqual([-20]);
});

test("the contract's tilted route: turned 30°, its alternative upright", () => {
  const { route, detail } = asRecommended(
    vercelli,
    "heart",
    tiltedFixture as unknown as RouteResult,
  );
  expect(route.rotation_deg).toBe(30);
  expect(detail.rotation_deg).toBe(30);
  expect(detail.alternatives).toHaveLength(1);
  expect("rotation_deg" in (detail.alternatives?.[0] ?? {})).toBe(false);
});

test("an upright example, or one of an older API, says nothing: as before", () => {
  const { route, detail } = asRecommended(vercelli, "heart", upright);
  expect("rotation_deg" in route).toBe(false);
  expect("rotation_deg" in detail).toBe(false);
  const zero = asRecommended(vercelli, "circle", { ...upright, rotation_deg: 0 });
  expect("rotation_deg" in zero.route).toBe(false);
  expect("rotation_deg" in zero.detail).toBe(false);
});

test("an example drawn again elsewhere takes the turn of its new route", () => {
  const { detail } = asRecommended(vercelli, "heart", tilted);
  expect(movedExample(detail, { ...upright, rotation_deg: -40 }).rotation_deg).toBe(
    -40,
  );
  // Upright where it was moved: no turn left over from where it was.
  expect("rotation_deg" in movedExample(detail, upright)).toBe(false);
});

test("the file keeps the turn: the next time the card is turned, nothing asked", async () => {
  const first = api();
  const storage = memory();
  drawExamples("http://api", vercelli, { request: first.request, storage });
  // The circle is asked first, then the heart; the file is written once
  // the star is drawn too (TASK-287).
  await act(async () => first.asked[0].answer({ kind: "route", result: upright }));
  await act(async () => first.asked[1].answer({ kind: "route", result: tilted }));
  await act(async () => first.asked[2].answer({ kind: "route", result: upright }));
  expect(first.asked[1].shape).toBe("heart");
  forgetExamples(); // the app closed

  const kept = readKept(storage.load())[cityKey(vercelli.point)];
  const heart = kept.find((d) => d.shape === "heart");
  expect(heart?.rotation_deg).toBe(30);
  expect(heart?.alternatives?.map((a) => a.rotation_deg)).toEqual([-20]);

  const again = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request: again.request, storage }),
  );
  const [card] = hook.current.examples ?? [];
  expect(card.shape).toBe("heart");
  expect(card.status === "ready" && card.route.rotation_deg).toBe(30);
  // The circle was kept upright: its card says nothing.
  const circle = hook.current.examples?.find((e) => e.shape === "circle");
  expect(circle?.status === "ready" && "rotation_deg" in circle.route).toBe(false);
  expect(again.asked.map((a) => a.shape)).not.toContain("heart");
});

test("an example kept before the turn stays north up, and is not drawn again", async () => {
  const storage = memory();
  const { detail } = asRecommended(vercelli, "heart", upright);
  storage.kept = { [cityKey(vercelli.point)]: [detail] };
  const { request, asked } = api();
  const { result: hook } = await renderHook(() =>
    useCityExamples("http://api", vercelli, { request, storage }),
  );
  const [card] = hook.current.examples ?? [];
  expect(card.status).toBe("ready");
  expect(card.status === "ready" && "rotation_deg" in card.route).toBe(false);
  expect(asked.map((a) => a.shape)).not.toContain("heart");
});

test("a turn that does not read is as none kept", () => {
  const { detail } = asRecommended(vercelli, "heart", tilted);
  const { rotation_deg: _turn, ...plain } = detail;
  const [alternative] = detail.alternatives ?? [];
  const { rotation_deg: _other, ...plainAlternative } = alternative;
  expect(
    readKept({
      a: [
        {
          ...detail,
          rotation_deg: "sideways",
          alternatives: [{ ...alternative, rotation_deg: null }],
        },
      ],
    }),
  ).toEqual({ a: [{ ...plain, alternatives: [plainAlternative] }] });
  // One that reads is kept as it is.
  expect(readKept({ a: [detail] })).toEqual({ a: [detail] });
});
