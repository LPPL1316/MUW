import { pageCall } from "./page";
import {
  MAX_DEATHS,
  PhoneEngine,
  type PlanAnswer,
  WAY_BACK_TIMEOUT_MS,
} from "./phoneEngine";

/** The way back to a route on the phone (TASK-314, ADR-0274): asked of the
 * page as a route is, with its own call and its own time. */

const ZONE = {
  name: "foot_1.00000_2.00000_3.00000_4.00000.zone.json.gz",
  uri: "file:///z",
  version: "v1",
};

function withPage() {
  const engine = new PhoneEngine();
  const sent: string[] = [];
  const attach = () =>
    engine.attach({
      send: (js) => sent.push(js),
      pyodide: "file:///p.zip",
      engine: "file:///e.zip",
    });
  const say = (message: object) => engine.receive(JSON.stringify(message));
  return { engine, sent, attach, say };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("a way back asks the page's wayBack and gets its JSON", async () => {
  const { engine, sent, attach, say } = withPage();
  const answer = engine.wayBack('{"here":[46,11]}', [ZONE]);
  attach();
  say({ type: "ready", ms: 4200 });
  expect(sent[1]).toBe(
    pageCall("wayBack", { id: 1, body: '{"here":[46,11]}', zones: [ZONE] }),
  );
  expect(sent[1]).toContain("window.sgrava.wayBack(");
  say({ type: "result", id: 1, json: '{"points":[]}', ms: 300, memoryMb: 210 });
  await expect(answer).resolves.toEqual<PlanAnswer>({
    kind: "done",
    json: '{"points":[]}',
    ms: 300,
    memoryMb: 210,
  });
  // The times of the last route stay those of a route.
  expect(engine.last).toEqual({ bootMs: 4200 });
});

test("a way back waits behind a route, in order", async () => {
  const { engine, sent, attach, say } = withPage();
  const route = engine.plan("a", [ZONE]);
  const way = engine.wayBack("b", [ZONE]);
  attach();
  say({ type: "ready", ms: 1 });
  expect(sent[1]).toContain("window.sgrava.plan(");
  say({ type: "result", id: 1, json: "{}", ms: 1, memoryMb: 1 });
  await expect(route).resolves.toMatchObject({ kind: "done" });
  expect(sent[2]).toContain("window.sgrava.wayBack(");
  say({ type: "result", id: 2, json: "{}", ms: 1, memoryMb: 1 });
  await expect(way).resolves.toMatchObject({ kind: "done" });
});

test("a way back too slow fails after its own time, not a route's", async () => {
  const { engine, attach, say } = withPage();
  const answer = engine.wayBack("b", [ZONE]);
  attach();
  say({ type: "ready", ms: 1 });
  jest.advanceTimersByTime(WAY_BACK_TIMEOUT_MS);
  await expect(answer).resolves.toMatchObject({ kind: "failed" });
});

test("a way back no longer wanted is cancelled", async () => {
  const { engine } = withPage();
  const controller = new AbortController();
  const answer = engine.wayBack("b", [ZONE], WAY_BACK_TIMEOUT_MS, controller.signal);
  controller.abort();
  await expect(answer).resolves.toEqual({ kind: "cancelled" });
});

test("the page dying during ways back counts, as during routes", async () => {
  const { engine, attach, say } = withPage();
  for (let death = 0; death < MAX_DEATHS; death += 1) {
    const answer = engine.wayBack("b", [ZONE]);
    attach();
    say({ type: "ready", ms: 1 });
    engine.died();
    await expect(answer).resolves.toMatchObject({ kind: "failed" });
  }
  expect(engine.available).toBe(false);
  await expect(engine.wayBack("b", [ZONE])).resolves.toEqual({
    kind: "failed",
    why: "the engine does not start",
  });
});
