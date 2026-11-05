/**
 * The post of a run along a turned route (TASK-232, ADR-0195): the drawing
 * on it is turned back, so it reads upright as on the map.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { PostImage } from "./PostImage";
import type { PostRun } from "./postRun";

const RAD = Math.PI / 180;
// A straight run of a kilometre from Trento, 30° west of north: the «up» of
// a shape turned 30° counterclockwise.
const METRES = 1000;
const DEGREE = 111_195;
const K = Math.cos(46.06 * RAD);
const UP: LatLon[] = Array.from({ length: 21 }, (_, i): LatLon => {
  const along = (i / 20) * METRES;
  return [
    46.06 + (along * Math.cos(30 * RAD)) / DEGREE,
    11.12 - (along * Math.sin(30 * RAD)) / DEGREE / K,
  ];
});

function run(rotationDeg?: number): PostRun {
  return {
    key: null,
    title: "Up",
    track: UP,
    distanceM: METRES,
    durationMs: 300_000,
    ...(rotationDeg === undefined ? {} : { rotationDeg }),
  };
}

/** How the post's stretches are turned on the screen, in degrees. */
function angles(): number[] {
  return screen.getAllByTestId("post-drawing").map((stroke) => {
    const style = StyleSheet.flatten(stroke.props.style);
    const [{ rotate }] = style.transform as { rotate: string }[];
    return parseFloat(rotate);
  });
}

const nothing = () => {};

test("a run along a route turned 30° is drawn turned back: it runs up", async () => {
  await render(
    <PostImage
      run={run(30)}
      shown={[]}
      stickers={[]}
      width={360}
      onMoveSticker={nothing}
      onRemoveSticker={nothing}
    />,
  );
  const drawn = angles();
  expect(drawn.length).toBeGreaterThan(0);
  for (const angle of drawn) {
    expect(angle).toBeCloseTo(-90, 1);
  }
});

test("a run that does not say how its route is turned is drawn north up", async () => {
  await render(
    <PostImage
      run={run()}
      shown={[]}
      stickers={[]}
      width={360}
      onMoveSticker={nothing}
      onRemoveSticker={nothing}
    />,
  );
  for (const angle of angles()) {
    expect(angle).toBeCloseTo(-120, 1);
  }
});
