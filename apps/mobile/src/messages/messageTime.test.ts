import { dayTitle, listWhen, opensDay, timeLabel } from "./messageTime";

// When a message was sent, in words (TASK-353), on the phone's clock: the
// moments are made from local dates, so the tests hold in every time zone.

const at = (year: number, month: number, day: number, hour = 12, minute = 0): string =>
  new Date(year, month - 1, day, hour, minute).toISOString();

const NOW = new Date(2026, 9, 30, 15, 30);

test("the time under a message has two digits each", () => {
  expect(timeLabel(at(2026, 10, 30, 8, 5))).toBe("08:05");
  expect(timeLabel(at(2026, 10, 30, 23, 59))).toBe("23:59");
});

test("a day's title is today, yesterday or the whole date", () => {
  expect(dayTitle(at(2026, 10, 30, 0, 1), NOW)).toBe("Today");
  expect(dayTitle(at(2026, 10, 29, 23, 59), NOW)).toBe("Yesterday");
  expect(dayTitle(at(2026, 10, 28), NOW)).toBe("Wed 28 Oct 2026");
});

test("yesterday goes by the calendar, across a day of 25 hours", () => {
  // 25 October 2026 has an hour more in Italy.
  const monday = new Date(2026, 9, 26, 0, 30);
  expect(dayTitle(at(2026, 10, 25, 0, 30), monday)).toBe("Yesterday");
  expect(dayTitle(at(2026, 10, 24, 23, 30), monday)).toBe("Sat 24 Oct 2026");
});

test("yesterday goes across the months and the years", () => {
  expect(dayTitle(at(2026, 9, 30), new Date(2026, 9, 1, 8))).toBe("Yesterday");
  expect(dayTitle(at(2026, 12, 31), new Date(2027, 0, 1, 8))).toBe("Yesterday");
});

test("the list says the time, yesterday, the day or the whole date", () => {
  expect(listWhen(at(2026, 10, 30, 9, 7), NOW)).toBe("09:07");
  expect(listWhen(at(2026, 10, 29), NOW)).toBe("Yesterday");
  expect(listWhen(at(2026, 10, 2), NOW)).toBe("2 Oct");
  expect(listWhen(at(2025, 12, 25), NOW)).toBe("Thu 25 Dec 2025");
});

test("a moment that is not one says nothing", () => {
  expect(timeLabel("soon")).toBe("");
  expect(dayTitle("soon", NOW)).toBe("");
  expect(listWhen("soon", NOW)).toBe("");
});

test("a title opens the oldest message of each day, the latest first", () => {
  const messages = [
    { created_at: at(2026, 10, 30, 9) },
    { created_at: at(2026, 10, 30, 8) },
    { created_at: at(2026, 10, 29, 23) },
    { created_at: at(2026, 10, 29, 7) },
  ];
  expect(messages.map((_, index) => opensDay(messages, index))).toEqual([
    false,
    true,
    false,
    true,
  ]);
  expect(opensDay([{ created_at: "soon" }], 0)).toBe(false);
});
