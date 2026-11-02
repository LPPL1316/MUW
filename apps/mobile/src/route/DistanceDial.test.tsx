import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { DistanceDial } from "./DistanceDial";
import { HOLD_DELAY_MS, repeatDelayMs } from "./halfStep";

jest.mock("../haptics/haptics", () => ({ stepFeel: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stepFeel } = require("../haptics/haptics") as { stepFeel: jest.Mock };

beforeEach(() => jest.clearAllMocks());

/** The dial with its text kept, as «Draw» keeps it; `onText` sees each one. */
function Kept({ from, onText }: { from: string; onText: (text: string) => void }) {
  const [text, setText] = useState(from);
  return (
    <DistanceDial
      text={text}
      onText={(next) => {
        onText(next);
        setText(next);
      }}
    />
  );
}

test("a tap on + or − is half a km, and is felt", async () => {
  const onText = jest.fn();
  await render(<Kept from="7" onText={onText} />);
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(onText).toHaveBeenLastCalledWith("7.5");
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  expect(onText).toHaveBeenLastCalledWith("6.5");
  expect(stepFeel).toHaveBeenCalledTimes(3);
});

test("at the limit nothing moves, and nothing is felt", async () => {
  const onText = jest.fn();
  await render(<DistanceDial text="1" onText={onText} />);
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  expect(onText).not.toHaveBeenCalled();
  expect(stepFeel).not.toHaveBeenCalled();
});

test("held down, + runs on until let go, with no extra step at the release", async () => {
  jest.useFakeTimers();
  const onText = jest.fn();
  await render(<Kept from="5" onText={onText} />);
  const plus = screen.getByRole("button", { name: "Longer" });
  await fireEvent(plus, "pressIn");
  await act(async () => {
    jest.advanceTimersByTime(HOLD_DELAY_MS + repeatDelayMs(0) + repeatDelayMs(1));
  });
  await fireEvent(plus, "pressOut");
  await fireEvent.press(plus);
  // Three steps from 5, each from the one before.
  expect(onText.mock.calls.map(([text]) => text)).toEqual(["5.5", "6", "6.5"]);
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(onText).toHaveBeenCalledTimes(3);
  jest.useRealTimers();
});

test("the number is typed with a tap", async () => {
  const onText = jest.fn();
  await render(<DistanceDial text="7" onText={onText} />);
  await fireEvent.changeText(screen.getByDisplayValue("7"), "12,5");
  expect(onText).toHaveBeenCalledWith("12,5");
});

test("for a screen reader the number is adjustable", async () => {
  const onText = jest.fn();
  await render(<DistanceDial text="7" onText={onText} />);
  const dial = screen.getByRole("adjustable");
  await fireEvent(dial, "accessibilityAction", {
    nativeEvent: { actionName: "increment" },
  });
  expect(onText).toHaveBeenLastCalledWith("7.5");
});

test("the time under the number, when there is one", async () => {
  const { rerender } = await render(
    <DistanceDial text="7" onText={() => {}} timeText="≈ 42 min at 6:00/km" />,
  );
  expect(screen.getByTestId("run-time")).toHaveTextContent("≈ 42 min at 6:00/km");
  await rerender(<DistanceDial text="7" onText={() => {}} timeText={null} />);
  expect(screen.queryByTestId("run-time")).toBeNull();
});
