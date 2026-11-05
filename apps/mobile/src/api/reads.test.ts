import reads from "@shaperoute/shared-types/fixtures/reads.json";
import { RUN_ACTIVITIES } from "@shaperoute/shared-types";

import { OLD_APP_ACTIVITIES, READS, READS_HEADER, readsHeaders } from "./reads";

// The same JSON is read by the API's tests/test_reads.py (TASK-387).

test("the header and the activities of before are the API's", () => {
  expect(READS_HEADER).toBe(reads.header);
  expect(OLD_APP_ACTIVITIES).toEqual(reads.old_app_activities);
});

test("this app says every activity it can save, and only values the API knows", () => {
  expect(readsHeaders()).toEqual({ "X-MuW-Reads": reads.this_app });
  expect([...OLD_APP_ACTIVITIES, ...READS]).toEqual([...RUN_ACTIVITIES, "trackless"]);
  for (const kind of READS) {
    expect(reads.kinds).toContain(kind);
  }
});

test("a post without a track is said, now that its screens show one (TASK-385 B0)", () => {
  expect(READS).toContain("trackless");
  expect(READS).toContain("gym");
});
