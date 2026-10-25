import type { RouteRequest } from "@shaperoute/shared-types";
import edited from "@shaperoute/shared-types/fixtures/image-outline-edited.json";
import imageOutline from "@shaperoute/shared-types/fixtures/image-outline.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import request from "@shaperoute/shared-types/fixtures/route-request.json";
import result from "@shaperoute/shared-types/fixtures/route-result.json";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { routeQueue } from "../api/routeQueue";
import { type AnyRouteRequest, sameRequest, useRouteRequest } from "./useRouteRequest";

const REQUEST = request as RouteRequest;
const fetchSpy = jest.spyOn(globalThis, "fetch");

afterEach(() => {
  fetchSpy.mockReset();
  routeQueue.forget();
});

afterAll(() => {
  fetchSpy.mockRestore();
});

test("waits with the API's phase, then keeps the route with its request", async () => {
  jest.useFakeTimers();
  const computing = { ...jobDone, status: "computing", result: null };
  fetchSpy
    .mockResolvedValueOnce(Response.json(computing, { status: 202 }))
    .mockResolvedValueOnce(Response.json(jobDone));
  const { result: hook } = await renderHook(() => useRouteRequest("http://pc:8000"));
  await act(() => hook.current.draw(REQUEST));
  expect(hook.current.state).toMatchObject({ status: "waiting", phase: "computing" });

  await act(() => jest.advanceTimersByTimeAsync(2000));
  expect(hook.current.state).toEqual({ status: "done", request: REQUEST, result });
  jest.useRealTimers();
});

test("the same phase told again is the same state: nothing to draw again (TASK-287)", async () => {
  jest.useFakeTimers();
  const computing = { ...jobDone, status: "computing", result: null };
  fetchSpy
    .mockResolvedValueOnce(Response.json(computing, { status: 202 }))
    .mockResolvedValueOnce(Response.json(computing))
    .mockResolvedValueOnce(Response.json(jobDone));
  const { result: hook } = await renderHook(() => useRouteRequest("http://pc:8000"));
  await act(() => hook.current.draw(REQUEST));
  const waiting = hook.current.state;
  expect(waiting).toMatchObject({ status: "waiting", phase: "computing" });
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(hook.current.state).toBe(waiting);
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(hook.current.state).toEqual({ status: "done", request: REQUEST, result });
  jest.useRealTimers();
});

test("while the user's route is asked, the examples in the background wait (TASK-287)", async () => {
  let answer: (response: Response) => void = () => undefined;
  fetchSpy.mockImplementationOnce(
    () => new Promise<Response>((resolve) => (answer = resolve)),
  );
  const { result: hook } = await renderHook(() => useRouteRequest("http://pc:8000"));
  await act(() => hook.current.draw(REQUEST));
  const example = jest.fn(() => Promise.resolve({ kind: "lost" } as const));
  const asked = routeQueue.background("visible", example);
  await act(async () => undefined);
  expect(example).not.toHaveBeenCalled();
  await act(async () => answer(Response.json(jobDone)));
  await waitFor(() => expect(hook.current.state.status).toBe("done"));
  await expect(asked).resolves.toEqual({ kind: "lost" });
  expect(example).toHaveBeenCalledTimes(1);
});

test("without an API address it fails without asking anyone", async () => {
  const { result: hook } = await renderHook(() => useRouteRequest(null));
  await act(() => hook.current.draw(REQUEST));
  await waitFor(() =>
    expect(hook.current.state).toEqual({
      status: "failed",
      request: REQUEST,
      problem: { kind: "no_api_url" },
    }),
  );
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("cancel goes back to idle", async () => {
  fetchSpy.mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
      }),
  );
  const { result: hook } = await renderHook(() => useRouteRequest("http://pc:8000"));
  await act(() => hook.current.draw(REQUEST));
  expect(hook.current.state.status).toBe("waiting");
  await act(() => hook.current.cancel());
  await waitFor(() => expect(hook.current.state).toEqual({ status: "idle" }));
});

test("sameRequest compares values, not objects", () => {
  expect(sameRequest(REQUEST, { ...REQUEST, start: [...REQUEST.start] })).toBe(true);
  expect(sameRequest(REQUEST, { ...REQUEST, distance_m: 3000 })).toBe(false);
  expect(sameRequest(REQUEST, { ...REQUEST, start: [46.0671, 11.1215] })).toBe(false);
  const { start, distance_m, activity } = REQUEST;
  const word: RouteRequest = { start, distance_m, activity, word: "CIAO" };
  expect(sameRequest(word, { ...word })).toBe(true);
  expect(sameRequest(word, { ...word, word: "KIWI" })).toBe(false);
  expect(sameRequest(word, REQUEST)).toBe(false);
  // Round letters when not said (TASK-080).
  expect(sameRequest(word, { ...word, style: "round" })).toBe(true);
  expect(sameRequest(word, { ...word, style: "block" })).toBe(false);
  // The pen up is another route; down when not said (TASK-198).
  expect(sameRequest(word, { ...word, pen_up: true })).toBe(false);
  expect(sameRequest(word, { ...word, pen_up: false })).toBe(true);
  expect(sameRequest({ ...word, pen_up: true }, { ...word, pen_up: true })).toBe(true);
});

test("an image is the same while its outline is the one traced for it", () => {
  const { start, distance_m, activity } = REQUEST;
  const outline = imageOutline.points as [number, number][];
  const image: AnyRouteRequest = { start, distance_m, activity, outline };
  expect(sameRequest(image, { ...image })).toBe(true);
  expect(sameRequest(image, { ...image, outline: [...outline] })).toBe(false);
  expect(sameRequest(image, REQUEST)).toBe(false);
  expect(sameRequest(REQUEST, image)).toBe(false);
});

test("«Try again» sends the last request again, as it was (TASK-256)", async () => {
  fetchSpy
    .mockRejectedValueOnce(new TypeError("Network request failed"))
    .mockResolvedValueOnce(Response.json(jobDone));
  const { result: hook } = await renderHook(() => useRouteRequest("http://pc:8000"));
  // Nothing to send again before the first request.
  await act(() => hook.current.retry());
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(hook.current.state).toEqual({ status: "idle" });

  await act(() => hook.current.draw(REQUEST));
  await waitFor(() =>
    expect(hook.current.state).toMatchObject({ status: "failed", request: REQUEST }),
  );
  await act(() => hook.current.retry());
  await waitFor(() =>
    expect(hook.current.state).toEqual({ status: "done", request: REQUEST, result }),
  );
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  const [first, second] = fetchSpy.mock.calls.map(([, init]) => init?.body);
  expect(second).toEqual(first);
});

test("an image with other details is another request (TASK-079)", () => {
  const { start, distance_m, activity } = REQUEST;
  const outline = edited.points as [number, number][];
  const strokes = edited.strokes as [number, number][][];
  const image: AnyRouteRequest = { start, distance_m, activity, outline, strokes };
  expect(sameRequest(image, { ...image })).toBe(true);
  expect(sameRequest(image, { ...image, strokes: [...strokes] })).toBe(false);
  expect(sameRequest(image, { ...image, strokes: undefined })).toBe(false);
});
