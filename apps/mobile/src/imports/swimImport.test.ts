/**
 * A swim from a watch (TASK-323 D, the user's choice): a file whose sport is
 * swimming is read as a swim. In open water the watch writes the positions;
 * a pool's swim has none, and there is no track to draw.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { sportOfWord } from "./fileTrack";
import { readFit } from "./fit";

const FOLDER = join(__dirname, "../../__tests__/fixtures/imports");

/** The run of the Garmin watch (make_fixtures.mjs), its session's sport
 * made a swim in open water: swimming (5), open_water (18). The session is
 * the last message, 19 bytes, before the 2 of the CRC; its sport is the
 * ninth of them. */
function garminSwim(): Uint8Array {
  const bytes = new Uint8Array(readFileSync(join(FOLDER, "garmin-run.fit")));
  const sport = bytes.length - 2 - 19 + 9;
  expect(bytes[sport]).toBe(1);
  bytes[sport] = 5;
  bytes[sport + 1] = 18;
  return bytes;
}

test("GPX's and TCX's swimming is a swim", () => {
  expect(sportOfWord("swimming")).toBe("swimming");
  expect(sportOfWord("Swim")).toBe("swimming");
  expect(sportOfWord("open_water_swimming")).toBe("swimming");
  // As before: what MuW has not got stays for the form to choose.
  expect(sportOfWord("hiking")).toBeNull();
});

test("a FIT file of a swim in open water is a swim, with its positions", () => {
  const track = readFit(garminSwim());
  expect(track.sport).toBe("swimming");
  expect(track.points.filter((point) => point.point !== null)).toHaveLength(30);
});
