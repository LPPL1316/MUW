import { saveLanguageChoice } from "../i18n/language";
import { msLeft, tickMs, timeLeftText } from "./timeLeft";

const ENDS = "2026-11-01T08:00:00Z";
const at = (iso: string) => Date.parse(iso);

afterEach(() => saveLanguageChoice("phone"));

test("days and hours while a day or more is left", () => {
  expect(timeLeftText(ENDS, at("2026-10-25T08:00:00Z"))).toBe("7 days 0 h left");
  expect(timeLeftText(ENDS, at("2026-10-31T04:30:00Z"))).toBe("1 day 3 h left");
});

test("hours and minutes under a day, minutes and seconds under an hour", () => {
  expect(timeLeftText(ENDS, at("2026-11-01T05:44:59Z"))).toBe("2 h 15 min left");
  expect(timeLeftText(ENDS, at("2026-11-01T07:47:55Z"))).toBe("12 min 5 s left");
  expect(timeLeftText(ENDS, at("2026-11-01T07:59:59.400Z"))).toBe("0 min 0 s left");
});

test("from the deadline on the time is up, and a moment that is not one too", () => {
  expect(timeLeftText(ENDS, at(ENDS))).toBe("Time is up");
  expect(timeLeftText(ENDS, at("2026-11-02T08:00:00Z"))).toBe("Time is up");
  expect(timeLeftText("not a date", 0)).toBe("Time is up");
  expect(msLeft("not a date", 0)).toBe(0);
});

test("the countdown ticks each minute above an hour and each second under", () => {
  expect(tickMs(ENDS, at("2026-10-25T08:00:00Z"))).toBe(60_000);
  expect(tickMs(ENDS, at("2026-11-01T07:30:00Z"))).toBe(1_000);
});

test("in Italian, with its plural", () => {
  saveLanguageChoice("it");
  expect(timeLeftText(ENDS, at("2026-10-31T04:30:00Z"))).toBe("Manca 1 giorno e 3 h");
  expect(timeLeftText(ENDS, at("2026-10-25T08:00:00Z"))).toBe("Mancano 7 giorni e 0 h");
  expect(timeLeftText(ENDS, at(ENDS))).toBe("Tempo scaduto");
});
