/**
 * The drawing inside a photo (TASK-348, ADR-0301): a picture made at
 * «Publish» cannot be cut afterwards, so it carries the Feed's line, without
 * the first and last 200 m of the run (POST_CUT_M).
 */
import type { LatLon } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { fitLines } from "../../activities/fitLines";
import { withoutEnds } from "../../share/postRun";
import { ComposedPhoto, composedLine } from "./ComposedPhoto";
import { layoutFrame, POST_LAYOUTS } from "./layoutFrame";

// A straight kilometre north from Trento, a fix every 50 m.
const DEGREE = 111_195;
const TRACK: LatLon[] = Array.from(
  { length: 21 },
  (_, i): LatLon => [46.06 + (i * 50) / DEGREE, 11.12],
);
const URI = "data:image/jpeg;base64,AAAA";

test("the line of a photo is the track without its ends, as the Feed's", () => {
  const line = composedLine(TRACK);
  expect(line).toEqual(withoutEnds(TRACK));
  // Neither the start nor the end of the run is in it.
  expect(line[0]?.[0]).toBeGreaterThan((TRACK[0]?.[0] ?? 0) + 199 / DEGREE);
  expect(line.at(-1)?.[0]).toBeLessThan((TRACK.at(-1)?.[0] ?? 0) - 199 / DEGREE);
});

test.each(POST_LAYOUTS)("%s draws the cut line, never the whole track", async (layout) => {
  await render(<ComposedPhoto uri={URI} layout={layout} track={TRACK} width={300} />);
  const { drawing, pad } = layoutFrame(layout, 300);
  const [cut] = fitLines([withoutEnds(TRACK)], drawing.width, drawing.height, pad);
  const [whole] = fitLines([TRACK], drawing.width, drawing.height, pad);
  expect(cut?.length).toBeLessThan(whole?.length ?? 0);
  expect(screen.getAllByTestId("composed-line")).toHaveLength(cut?.length ?? -1);
  expect(screen.getByTestId("composed-photo")).toBeTruthy();
});

test("a run shorter than its two ends gives a photo without a line", async () => {
  await render(
    <ComposedPhoto uri={URI} layout="drawing_corner" track={TRACK.slice(0, 5)} width={300} />,
  );
  expect(screen.queryAllByTestId("composed-line")).toHaveLength(0);
});
