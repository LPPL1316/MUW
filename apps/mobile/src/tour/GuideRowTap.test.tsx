import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated } from "react-native";

import { motion } from "../theme/tokens";
import { GuideRow, WatchTourButton } from "./GuideRow";

// The premium look, part C2 (TASK-339, ADR-0293): the rows of «Profile» answer
// the finger through `Tap`, in `motion.pressMs`, and still do what they did.

test("the guide row shrinks under the finger and opens the guide", async () => {
  const timing = jest.spyOn(Animated, "timing");
  const onOpen = jest.fn();
  await render(<GuideRow onOpen={onOpen} />);
  const row = screen.getByRole("button");
  await fireEvent(row, "pressIn");
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ toValue: 1, duration: motion.pressMs }),
  );
  await fireEvent(row, "pressOut");
  expect(timing).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ toValue: 0, duration: motion.releaseMs }),
  );
  await fireEvent.press(row);
  expect(onOpen).toHaveBeenCalledTimes(1);
  timing.mockRestore();
});

test("«Watch the tour» answers the same way", async () => {
  const timing = jest.spyOn(Animated, "timing");
  const onWatch = jest.fn();
  await render(<WatchTourButton onWatch={onWatch} />);
  await fireEvent(screen.getByRole("button"), "pressIn");
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ toValue: 1, duration: motion.pressMs }),
  );
  await fireEvent.press(screen.getByRole("button"));
  expect(onWatch).toHaveBeenCalledTimes(1);
  timing.mockRestore();
});
