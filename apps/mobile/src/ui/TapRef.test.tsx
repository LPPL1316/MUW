import { render } from "@testing-library/react-native";
import { createRef } from "react";
import { Text, type View } from "react-native";

import { Tap } from "./Tap";

// A `Tap` takes a ref (TASK-339 C2): `DrawingsGrid` measures its cell to know
// what is in sight. Under the animated look the ref reaches the Pressable's
// host view, which can measure itself. In its own file, as `TapStill`: the
// animation mocks of `Tap.test.tsx` are not in the way.

test("a ref reaches the Pressable, for a caller that measures it", async () => {
  const ref = createRef<View>();
  await render(
    <Tap ref={ref} onPress={jest.fn()} accessibilityRole="button">
      <Text>Measure me</Text>
    </Tap>,
  );
  expect(ref.current).not.toBeNull();
  expect(typeof ref.current?.measure).toBe("function");
});

test("a callback ref is called with the node, once", async () => {
  const seen: unknown[] = [];
  await render(
    <Tap ref={(node) => void seen.push(node)} onPress={jest.fn()}>
      <Text>Measure me</Text>
    </Tap>,
  );
  expect(seen).toHaveLength(1);
  expect(seen[0]).not.toBeNull();
});
