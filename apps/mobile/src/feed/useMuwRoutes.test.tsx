import list from "@shaperoute/shared-types/fixtures/muw-routes.json";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { FollowsContext } from "../social/followsDoor";
import { forgetMuwRoutes, useMuwRoutes } from "./useMuwRoutes";

beforeEach(forgetMuwRoutes);

const SIGNED_OUT = { status: "signedOut", notice: null } as const;

function wrapperWith(apiUrl: string | null) {
  return function Door({ children }: { children: ReactNode }) {
    return (
      <FollowsContext.Provider
        value={{
          apiUrl,
          account: { state: SIGNED_OUT, sessionEnded: () => {} },
          openProfile: () => {},
        }}
      >
        {children}
      </FollowsContext.Provider>
    );
  };
}

const answering = (body: unknown, status = 200) =>
  jest.fn(() => Promise.resolve(Response.json(body, { status })));

test("read once when «Feed» is on the screen, even without an account", async () => {
  const fetchFn = answering(list);
  const { result } = await renderHook(
    () => useMuwRoutes(true, { fetchFn, key: null }),
    {
      wrapper: wrapperWith("http://api"),
    },
  );
  await waitFor(() => expect(result.current).toEqual(list.routes));
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("kept: a Feed built again does not ask again", async () => {
  const fetchFn = answering(list);
  const wrapper = wrapperWith("http://api");
  const first = await renderHook(() => useMuwRoutes(true, { fetchFn, key: null }), {
    wrapper,
  });
  await waitFor(() => expect(first.result.current).toHaveLength(1));
  const again = await renderHook(() => useMuwRoutes(true, { fetchFn, key: null }), {
    wrapper,
  });
  expect(again.result.current).toEqual(list.routes);
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("off the screen, or without an API, nothing is asked", async () => {
  const fetchFn = answering(list);
  const off = await renderHook(() => useMuwRoutes(false, { fetchFn, key: null }), {
    wrapper: wrapperWith("http://api"),
  });
  const none = await renderHook(() => useMuwRoutes(true, { fetchFn, key: null }), {
    wrapper: wrapperWith(null),
  });
  expect(off.result.current).toEqual([]);
  expect(none.result.current).toEqual([]);
  expect(fetchFn).not.toHaveBeenCalled();
});

test("the server of today, before TASK-365, gives a Feed as before", async () => {
  const fetchFn = answering({ detail: "Not Found" }, 404);
  const { result } = await renderHook(
    () => useMuwRoutes(true, { fetchFn, key: null }),
    {
      wrapper: wrapperWith("http://api"),
    },
  );
  await waitFor(() => expect(fetchFn).toHaveBeenCalled());
  expect(result.current).toEqual([]);
});
