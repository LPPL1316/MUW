/**
 * The pages of the tab bar side by side, one swipe apart, round and round
 * (TASK-379, ADR-0323): after the profile comes «Feed» again. The pages lie
 * on a long strip of places one screen wide; the page on screen has a place,
 * and its two neighbours the places at its sides. A page is moved to a
 * place only while it is out of sight, so going round never makes the strip
 * jump back.
 */

/** How many places the strip has. A swipe goes one place: from the middle,
 * a thousand swipes the same way before an end. Not more: the layout counts
 * in 32-bit floats, and a place this far is still laid out to the pixel. */
export const STRIP_PLACES = 2000;

/** Where the strip starts: in its middle. */
export const STRIP_START = STRIP_PLACES / 2;

/** A scroll never rests exactly on a place: this much is the place. */
const SLACK = 1;

/** The page `steps` away from `page`, round the `count` pages. */
export function pageRound(page: number, steps: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  return (((page + steps) % count) + count) % count;
}

/** The place a scroll offset is nearest to, within the strip. */
export function placeAt(x: number, width: number): number {
  if (width <= 0) {
    return STRIP_START;
  }
  return Math.min(STRIP_PLACES - 1, Math.max(0, Math.round(x / width)));
}

/** The places a scroll offset shows at least a part of. */
export function placesInView(x: number, width: number): number[] {
  if (width <= 0) {
    return [];
  }
  const first = Math.max(0, Math.floor((x + SLACK) / width));
  const last = Math.min(STRIP_PLACES - 1, Math.ceil((x - SLACK) / width));
  const places: number[] = [];
  for (let place = first; place <= last; place += 1) {
    places.push(place);
  }
  return places;
}

/** Whether a scroll offset is on a place, as a finger lifted there leaves it. */
export function restsOnPlace(x: number, width: number): boolean {
  return width > 0 && Math.abs(x - placeAt(x, width) * width) <= SLACK;
}

/** The page on screen and its place on the strip. */
export type Strip = { page: number; place: number };

/** The strip once the scroll is nearest to `place`: one place on is the next
 * page, one place back the one before, round the `count` pages. */
export function stripAt(strip: Strip, place: number, count: number): Strip {
  if (place === strip.place) {
    return strip;
  }
  return { page: pageRound(strip.page, place - strip.place, count), place };
}

/** Which page lies on each place in sight or one swipe away: the page on
 * screen and its two neighbours. With fewer than three pages, no page lies
 * on two places. */
export function pagesAround(strip: Strip, count: number): Map<number, number> {
  const around = new Map<number, number>();
  if (count <= 0) {
    return around;
  }
  around.set(strip.page, strip.place);
  if (count > 1 && strip.place + 1 < STRIP_PLACES) {
    around.set(pageRound(strip.page, 1, count), strip.place + 1);
  }
  const before = pageRound(strip.page, -1, count);
  if (count > 2 && strip.place > 0 && !around.has(before)) {
    around.set(before, strip.place - 1);
  }
  return around;
}
