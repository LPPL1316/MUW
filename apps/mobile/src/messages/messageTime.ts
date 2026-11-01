import { dayLabel, MONTHS } from "../activities/activityText";
import { t } from "../i18n";

/**
 * When a message was sent, in words (TASK-353), on the phone's clock: 24
 * hours, as the times of «My activities». "" for a moment that is not one.
 */

function moment(sentAt: string): Date | null {
  const when = new Date(sentAt);
  return Number.isNaN(when.getTime()) ? null : when;
}

/** The two moments fall on the same day of the phone's calendar. */
function sameDay(one: Date, other: Date): boolean {
  return (
    one.getFullYear() === other.getFullYear() &&
    one.getMonth() === other.getMonth() &&
    one.getDate() === other.getDate()
  );
}

/** The day before `now`: by the calendar, so a day of 23 hours counts too. */
function dayBefore(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
}

/** "08:12": under a message. */
export function timeLabel(sentAt: string): string {
  const when = moment(sentAt);
  if (when === null) {
    return "";
  }
  const hours = String(when.getHours()).padStart(2, "0");
  const minutes = String(when.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** "Today", "Yesterday" or "Fri 2 Oct 2026": over a day's messages. */
export function dayTitle(sentAt: string, now: Date): string {
  const when = moment(sentAt);
  if (when === null) {
    return "";
  }
  if (sameDay(when, now)) {
    return t("Today");
  }
  if (sameDay(when, dayBefore(now))) {
    return t("Yesterday");
  }
  return dayLabel(sentAt);
}

/** "08:12", "Yesterday", "2 Oct" or, of another year, the whole date: beside
 * a conversation in the list, where the room is little. */
export function listWhen(sentAt: string, now: Date): string {
  const when = moment(sentAt);
  if (when === null) {
    return "";
  }
  if (sameDay(when, now)) {
    return timeLabel(sentAt);
  }
  if (sameDay(when, dayBefore(now))) {
    return t("Yesterday");
  }
  if (when.getFullYear() !== now.getFullYear()) {
    return dayLabel(sentAt);
  }
  return t("{day} {month}", {
    day: String(when.getDate()),
    month: t(MONTHS[when.getMonth()]),
  });
}

/** A day's title goes over this message: the next one in `messages`, the
 * latest first, is of another day, or there is none. */
export function opensDay(messages: readonly { created_at: string }[], index: number) {
  const when = moment(messages[index].created_at);
  const before = index + 1 < messages.length ? messages[index + 1] : null;
  if (when === null || before === null) {
    return when !== null;
  }
  const earlier = moment(before.created_at);
  return earlier === null || !sameDay(when, earlier);
}
