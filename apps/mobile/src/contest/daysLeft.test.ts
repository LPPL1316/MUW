import { contestTime, daysLeftText } from "./daysLeft";

/**
 * The days left are counted on the phone's calendar: the moments here are
 * built on the phone's clock, so the tests hold in any time zone.
 */

/** 15 November 2026, 23:59:59 on the phone's clock: the last moment. */
const END = new Date(2026, 10, 15, 23, 59, 59);
const ENDS_AT = END.toISOString();

/** `day` November 2026 at `hour` on the phone's clock. */
function on(day: number, hour = 12): number {
  return new Date(2026, 10, day, hour).getTime();
}

test("the days left are the days of the calendar to the last one", () => {
  expect(contestTime(ENDS_AT, on(2))).toEqual({ kind: "days", days: 13 });
  expect(daysLeftText(ENDS_AT, on(2))).toBe("13 days left");
  // Early or late in a day, the same count.
  expect(daysLeftText(ENDS_AT, on(12, 0))).toBe("3 days left");
  expect(daysLeftText(ENDS_AT, on(12, 23))).toBe("3 days left");
  expect(daysLeftText(ENDS_AT, on(14))).toBe("1 day left");
});

test("on the last day, «Ends today», until its last moment", () => {
  expect(contestTime(ENDS_AT, on(15, 0))).toEqual({ kind: "today" });
  expect(daysLeftText(ENDS_AT, on(15, 0))).toBe("Ends today");
  expect(daysLeftText(ENDS_AT, END.getTime() - 1)).toBe("Ends today");
});

test("from the end on, until the winner is proclaimed, «Ended»", () => {
  expect(contestTime(ENDS_AT, END.getTime())).toEqual({ kind: "ended" });
  expect(daysLeftText(ENDS_AT, END.getTime())).toBe("Ended · the winner is coming");
  expect(daysLeftText(ENDS_AT, on(17))).toBe("Ended · the winner is coming");
});

test("a contest that ends at another hour than midnight counts its days the same", () => {
  const noon = new Date(2026, 10, 15, 12).toISOString();
  expect(daysLeftText(noon, on(14, 18))).toBe("1 day left");
  expect(daysLeftText(noon, on(15, 9))).toBe("Ends today");
  expect(daysLeftText(noon, on(15, 13))).toBe("Ended · the winner is coming");
});

test("an end that is no moment has ended: no days are made up", () => {
  expect(contestTime("soon", on(2))).toEqual({ kind: "ended" });
});
