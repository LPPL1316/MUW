import done from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import failed from "@shaperoute/shared-types/fixtures/themed-route-job-failed.json";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { ThemedIdea } from "./themedIdeas";
import type { ThemedResult } from "./themedRoutes";
import { useThemedRoute } from "./useThemedRoute";

const request = { text: "luoghi famosi a Milano", centre: null, city: null };
const running = { job_id: "f00d", status: "running", result: null, error: null };

test("follows the job until the route is done", async () => {
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce(Response.json(running, { status: 202 }))
    .mockResolvedValueOnce(Response.json(running))
    .mockResolvedValueOnce(Response.json(done));
  const { result } = await renderHook(() =>
    useThemedRoute("http://api", { fetchFn, pollMs: 1 }),
  );
  await act(async () => result.current.ask(request));
  expect(result.current.state.status).not.toBe("idle");
  await waitFor(() => expect(result.current.state.status).toBe("done"));
  expect(fetchFn).toHaveBeenCalledTimes(3);
  expect(fetchFn.mock.calls[2][0]).toBe("http://api/themed-route-jobs/f00d");
});

test("a failed job says why, in the API's words", async () => {
  const fetchFn = jest.fn().mockResolvedValue(Response.json(failed, { status: 202 }));
  const { result } = await renderHook(() =>
    useThemedRoute("http://api", { fetchFn, pollMs: 1 }),
  );
  await act(async () => result.current.ask(request));
  await waitFor(() => expect(result.current.state.status).toBe("failed"));
  const state = result.current.state;
  expect(state.status === "failed" && state.message).toMatch(/Not enough verified/);
});

test("no API, or an API that does not answer, is said too", async () => {
  const { result } = await renderHook(() => useThemedRoute(null));
  await act(async () => result.current.ask(request));
  expect(result.current.state.status).toBe("failed");
  await act(async () => result.current.close());
  expect(result.current.state.status).toBe("idle");
});

test("an ask that fails between two good ones does not end the route (TASK-254)", async () => {
  const offline = new TypeError("Network request failed");
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce(Response.json(running, { status: 202 }))
    .mockRejectedValueOnce(offline)
    .mockResolvedValueOnce(Response.json(running))
    .mockRejectedValueOnce(offline)
    .mockRejectedValueOnce(offline)
    .mockResolvedValueOnce(Response.json(done));
  const { result } = await renderHook(() =>
    useThemedRoute("http://api", { fetchFn, pollMs: 1 }),
  );
  await act(async () => result.current.ask(request));
  await waitFor(() => expect(result.current.state.status).toBe("done"));
  expect(fetchFn).toHaveBeenCalledTimes(6);

  // Three in a row: the API is gone.
  const gone = jest
    .fn()
    .mockResolvedValueOnce(Response.json(running, { status: 202 }))
    .mockRejectedValue(offline);
  const { result: lost } = await renderHook(() =>
    useThemedRoute("http://api", { fetchFn: gone, pollMs: 1 }),
  );
  await act(async () => lost.current.ask(request));
  await waitFor(() => expect(lost.current.state.status).toBe("failed"));
  expect(gone).toHaveBeenCalledTimes(4);
  const state = lost.current.state;
  expect(state.status === "failed" && state.message).toMatch(/did not answer/);
});

test("one of our ideas is shown at once, asking nothing, and closes as any", async () => {
  const fetchFn = jest.fn();
  const { result } = await renderHook(() =>
    useThemedRoute("http://api", { fetchFn, pollMs: 0 }),
  );
  const idea: ThemedIdea = {
    id: "milan-famous-places-star",
    city: "Milan",
    category: "Famous Places",
    text: "Famous Places star 10 km",
    preview: [
      [45.46, 9.19],
      [45.47, 9.2],
    ],
    result: done.result as ThemedResult,
  };
  await act(async () => result.current.show(idea));
  expect(result.current.state).toEqual({
    status: "done",
    request: {
      text: "Famous Places star 10 km",
      centre: done.result.centre,
      city: "Milan",
    },
    result: done.result,
    idea,
  });
  expect(fetchFn).not.toHaveBeenCalled();
  await act(async () => result.current.close());
  expect(result.current.state).toEqual({ status: "idle" });
});
