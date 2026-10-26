import { act, renderHook } from "@testing-library/react-native";

import {
  clearRequestedChallenge,
  openChallenge,
  requestedChallenge,
  useRequestedChallenge,
} from "./challengeDoor";
import { onOpenPlay } from "./unlocks";

const ID = "6d0e5c4a-2b1f-4a3e-9c8d-7e6f5a4b3c2d";

afterEach(clearRequestedChallenge);

test("a challenge asked for opens «Play» and waits there for the page", async () => {
  const play = jest.fn();
  const stop = onOpenPlay(play);
  const { result } = await renderHook(() => useRequestedChallenge());
  expect(result.current).toBeNull();
  await act(async () => openChallenge(ID));
  expect(play).toHaveBeenCalledTimes(1);
  expect(result.current).toEqual({ id: ID });
  expect(requestedChallenge()).toEqual({ id: ID });
  await act(async () => clearRequestedChallenge());
  expect(result.current).toBeNull();
  stop();
});

test("the same challenge asked for twice is two requests", () => {
  openChallenge(ID);
  const first = requestedChallenge();
  openChallenge(ID);
  expect(requestedChallenge()).toEqual(first);
  expect(requestedChallenge()).not.toBe(first);
});

test("a page built after the request still finds it", () => {
  openChallenge(ID);
  expect(requestedChallenge()?.id).toBe(ID);
});
