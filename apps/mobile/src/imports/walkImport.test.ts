/**
 * A walk from another app (TASK-371): a file whose sport is walking is read
 * as a walk. A hike is not one yet (TASK-377).
 */
import { readFileSync } from "fs";
import { join } from "path";

import { sportOfWord } from "./fileTrack";
import { readFit } from "./fit";

const FOLDER = join(__dirname, "../../__tests__/fixtures/imports");

/** The run of the Garmin watch (make_fixtures.mjs), its session's sport
 * made a walk: walking (11), generic (0). The session is the last message,
 * 19 bytes, before the 2 of the CRC; its sport is the ninth of them. */
function garminWalk(): Uint8Array {
  const bytes = new Uint8Array(readFileSync(join(FOLDER, "garmin-run.fit")));
  const sport = bytes.length - 2 - 19 + 9;
  expect(bytes[sport]).toBe(1);
  bytes[sport] = 11;
  bytes[sport + 1] = 0;
  return bytes;
}

test("GPX's walking and Strava's 10 are a walk", () => {
  expect(sportOfWord("walking")).toBe("walking");
  expect(sportOfWord("Walk")).toBe("walking");
  expect(sportOfWord("10")).toBe("walking");
  expect(sportOfWord("hiking")).toBeNull();
  // The others as before.
  expect(sportOfWord("running")).toBe("running");
  expect(sportOfWord("9")).toBe("running");
  expect(sportOfWord("1")).toBe("cycling");
});

test("a FIT file of a walk is a walk, with its positions", () => {
  const track = readFit(garminWalk());
  expect(track.sport).toBe("walking");
  expect(track.points.filter((point) => point.point !== null)).toHaveLength(30);
});
