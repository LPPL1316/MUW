/**
 * The drawing inside a photo (TASK-348, ADR-0301): it carries the Feed's
 * line, the whole track of the run, start and end too (ADR-0330).
 */
import type { LatLon } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { fitLines } from "../../activities/fitLines";
import { ComposedPhoto, composedLine } from "./ComposedPhoto";
import { layoutFrame, POST_LAYOUTS } from "./layoutFrame";

// A straight kilometre north from Trento, a fix every 50 m.
const DEGREE = 111_195;
const TRACK: LatLon[] = Array.from({ length: 21 }, (_, i): LatLon => [
  46.06 + (i * 50) / DEGREE,
  11.12,
]);
const SOURCE = { uri: "data:image/jpeg;base64,AAAA" };

test("the line of a photo is the whole track, as the Feed's", () => {
  expect(composedLine(TRACK)).toEqual(TRACK);
});

test.each(POST_LAYOUTS)("%s draws the whole track", async (layout) => {
  await render(
    <ComposedPhoto source={SOURCE} layout={layout} track={TRACK} width={300} />,
  );
  const { drawing, pad } = layoutFrame(layout, 300);
  const [whole] = fitLines([TRACK], drawing.width, drawing.height, pad);
  expect(screen.getAllByTestId("composed-line")).toHaveLength(whole?.length ?? -1);
  expect(screen.getByTestId("composed-photo")).toBeTruthy();
});

test("a run of one fix gives a photo without a line", async () => {
  await render(
    <ComposedPhoto
      source={SOURCE}
      layout="drawing_corner"
      track={TRACK.slice(0, 1)}
      width={300}
    />,
  );
  expect(screen.queryAllByTestId("composed-line")).toHaveLength(0);
});
