import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { color, space } from "../theme/tokens";
import {
  CREDIT_LINE,
  creditLine,
  DRAWING_PAD,
  lineEnds,
  MAP_CREDIT,
  RouteMap,
} from "./RouteMap";
import type { LatLon } from "@shaperoute/shared-types";

const LINE: LatLon[] = [
  [43.77, 11.25],
  [43.77, 11.26],
  [43.78, 11.26],
];

function luminance(hex: string): number {
  const channel = (at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("the two ends of the line are its first and its last point", () => {
  // West to east along the top, then down: a box 100 × 100, no margin kept.
  const ends = lineEnds([
    { left: 10, top: 20, length: 40, angle: 0 },
    { left: 30, top: 40, length: 40, angle: 90 },
  ]);
  expect(ends?.first.x).toBeCloseTo(10);
  expect(ends?.first.y).toBeCloseTo(20);
  expect(ends?.last.x).toBeCloseTo(50);
  expect(ends?.last.y).toBeCloseTo(60);
  expect(lineEnds([])).toBeNull();
});

test("a dot and a flag only when asked, in the colour of the text", async () => {
  await render(<RouteMap id="a" line={LINE} width={358} />);
  expect(screen.queryByTestId("feed-line-dot")).toBeNull();
  expect(screen.queryByTestId("feed-line-flag")).toBeNull();

  await render(<RouteMap id="a" line={LINE} width={358} marks />);
  expect(screen.getByTestId("feed-line-dot")).toHaveStyle({
    backgroundColor: color.text,
    borderColor: color.scrim,
  });
  expect(screen.getByTestId("feed-line-flag")).toBeOnTheScreen();
});

test("the marks sit on the line it was given, and no words name them", async () => {
  await render(<RouteMap id="a" line={LINE} width={358} marks />);
  // The two ends fit inside the margin the line keeps.
  const dot = StyleSheet.flatten(screen.getByTestId("feed-line-dot").props.style);
  expect(dot.left).toBeGreaterThanOrEqual(DRAWING_PAD - 5);
  expect(dot.left).toBeLessThanOrEqual(358 - DRAWING_PAD);
  expect(screen.queryByText(/start|finish|partenza|arrivo/i)).toBeNull();
});

test("the credit is one line, in the margin the line never enters", () => {
  expect(creditLine()).not.toContain("\n");
  expect(creditLine()).toBe(MAP_CREDIT.replace("\n", " · "));
  expect(space.xs + CREDIT_LINE).toBeLessThanOrEqual(DRAWING_PAD);
});

test("the credit passes AA on the map's own colour", () => {
  expect(contrast(color.textFaint, color.map.background)).toBeGreaterThanOrEqual(4.5);
});
