import { NO_BODY } from "./bodyProfile";
import {
  appHeart,
  calculatedAgain,
  calculatedLimits,
  HEART_FILE,
  heartOf,
  type HeartSettings,
  loadHeart,
  maxHeartRate,
  NO_HEART,
  saveHeart,
  subscribeHeart,
  tanakaMax,
  withLimit,
  type Zone,
  zonesOf,
} from "./heartZones";

// The phone's documents folder, in memory, as in bodyProfile.test.ts.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  const state = { failing: false };
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      if (state.failing) {
        throw new Error("No space left on device");
      }
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } }, files, state };
});

const disk = jest.requireMock<{
  files: Map<string, string>;
  state: { failing: boolean };
}>("expo-file-system");
const HEART_URI = `file:///documents/${HEART_FILE}`;
const YEAR = 2026;

afterEach(() => {
  disk.files.clear();
  disk.state.failing = false;
});

/** The six limits of `zones`, bottom of zone 1 to the max. */
function limits(zones: readonly Zone[]): number[] {
  return [...zones.map((zone) => zone.fromBpm), zones[4].toBpm];
}

function hand(...values: (number | null)[]): HeartSettings {
  return { ...NO_HEART, limits: values };
}

test("Tanaka: 208 − 0.7 × age, to the beat", () => {
  expect(tanakaMax(40)).toBe(180);
  expect(tanakaMax(30)).toBe(187);
  expect(tanakaMax(25)).toBe(191); // 190.5
});

test("the max comes from the age, or from the one typed by hand", () => {
  const body = { ...NO_BODY, birthYear: 1986 };
  expect(maxHeartRate(NO_HEART, body, YEAR)).toEqual({ bpm: 180, from: "age" });
  expect(maxHeartRate({ ...NO_HEART, maxBpm: 195 }, body, YEAR)).toEqual({
    bpm: 195,
    from: "hand",
  });
  expect(maxHeartRate({ ...NO_HEART, maxBpm: 195 }, NO_BODY, YEAR)).toEqual({
    bpm: 195,
    from: "hand",
  });
  expect(maxHeartRate(NO_HEART, NO_BODY, YEAR)).toBeNull();
});

test("without a resting heart rate, 50 to 100% of the max", () => {
  expect(calculatedLimits(180, null)).toEqual([90, 108, 126, 144, 162, 180]);
  expect(zonesOf(180, NO_HEART)).toEqual([
    { number: 1, fromBpm: 90, toBpm: 108 },
    { number: 2, fromBpm: 108, toBpm: 126 },
    { number: 3, fromBpm: 126, toBpm: 144 },
    { number: 4, fromBpm: 144, toBpm: 162 },
    { number: 5, fromBpm: 162, toBpm: 180 },
  ]);
});

test("with a resting heart rate, Karvonen: rest + % × (max − rest)", () => {
  // 60 + 50% of 120, + 60%, ...
  expect(calculatedLimits(180, 60)).toEqual([120, 132, 144, 156, 168, 180]);
  expect(limits(zonesOf(187, { ...NO_HEART, restBpm: 52 }))).toEqual([
    120, // 52 + 67.5
    133, // 52 + 81
    147, // 52 + 94.5
    160, // 52 + 108
    174, // 52 + 121.5
    187,
  ]);
});

test("a limit moved by hand moves the bottom of the next zone too", () => {
  const zones = zonesOf(180, NO_HEART);
  const moved = withLimit(NO_HEART, zones, 2, 130);
  expect(moved.limits).toEqual([null, null, 130, null, null]);
  const after = zonesOf(180, moved);
  expect(after[1]).toEqual({ number: 2, fromBpm: 108, toBpm: 130 });
  expect(after[2]).toEqual({ number: 3, fromBpm: 130, toBpm: 144 });
});

test("a limit is kept between the limits around it, a beat apart", () => {
  const zones = zonesOf(180, NO_HEART);
  expect(withLimit(NO_HEART, zones, 2, 170).limits[2]).toBe(143);
  expect(withLimit(NO_HEART, zones, 2, 50).limits[2]).toBe(109);
  expect(withLimit(NO_HEART, zones, 4, 200).limits[4]).toBe(179);
  expect(withLimit(NO_HEART, zones, 0, 10).limits[0]).toBe(30);
  expect(withLimit(NO_HEART, zones, 0, 99.6).limits[0]).toBe(100);
});

test("a limit set by hand stays when the rest or the max changes", () => {
  const moved = hand(null, null, 130, null, null);
  // With a resting heart rate the top of zone 1 would be 132: it stays under
  // the limit set by hand.
  expect(limits(zonesOf(180, { ...moved, restBpm: 60 }))).toEqual([
    120, 129, 130, 156, 168, 180,
  ]);
  expect(limits(zonesOf(200, moved))).toEqual([100, 120, 130, 160, 180, 200]);
});

test("a max under the limits set by hand pushes them down, in order", () => {
  expect(limits(zonesOf(160, hand(null, null, null, null, 170)))).toEqual([
    80, 96, 112, 128, 159, 160,
  ]);
  expect(limits(zonesOf(120, hand(110, 150, 160, 170, 175)))).toEqual([
    110, 116, 117, 118, 119, 120,
  ]);
});

test("the zones are always contiguous and in order", () => {
  const cases: [number, HeartSettings][] = [
    [100, { ...NO_HEART, restBpm: 120 }],
    [230, hand(200, null, 40, null, 229)],
    [150, { restBpm: 90, maxBpm: null, limits: [null, 149, null, 31, null] }],
  ];
  for (const [max, heart] of cases) {
    const zones = zonesOf(max, heart);
    expect(zones[4].toBpm).toBe(max);
    zones.forEach((zone, i) => {
      expect(zone.fromBpm).toBeLessThan(zone.toBpm);
      if (i > 0) {
        expect(zone.fromBpm).toBe(zones[i - 1].toBpm);
      }
    });
  }
});

test("Back to calculated zones forgets the limits set by hand, not the rest", () => {
  const heart = { maxBpm: 190, restBpm: 55, limits: [100, null, 140, null, null] };
  expect(calculatedAgain(heart)).toEqual({ ...NO_HEART, maxBpm: 190, restBpm: 55 });
});

test("a field out of its limits is left calculated", () => {
  expect(heartOf({ maxBpm: 240, restBpm: 20, limits: [10, "x", 250] })).toEqual(
    NO_HEART,
  );
  expect(heartOf({ maxBpm: 100, restBpm: 120, limits: [30, 230] })).toEqual({
    maxBpm: 100,
    restBpm: 120,
    limits: [30, 230, null, null, null],
  });
  expect(heartOf("no")).toEqual(NO_HEART);
});

test("what is saved is read back at the next opening", () => {
  const heart = { maxBpm: 192, restBpm: 48, limits: [null, 120, null, null, 175] };
  saveHeart(heart);
  expect(loadHeart()).toEqual(heart);
  expect(appHeart()).toEqual(heart);
});

test("nothing set by hand removes the file", () => {
  saveHeart({ ...NO_HEART, restBpm: 60 });
  expect(disk.files.has(HEART_URI)).toBe(true);
  saveHeart(NO_HEART);
  expect(disk.files.has(HEART_URI)).toBe(false);
});

test("a file that does not read is nothing set by hand", () => {
  disk.files.set(HEART_URI, "{not json");
  expect(loadHeart()).toEqual(NO_HEART);
});

test("the app follows saved settings at once, even if the phone refuses them", () => {
  const seen: unknown[] = [];
  const stop = subscribeHeart((heart) => seen.push(heart));
  disk.state.failing = true;
  saveHeart({ ...NO_HEART, maxBpm: 200 });
  stop();
  expect(seen).toEqual([{ ...NO_HEART, maxBpm: 200 }]);
  expect(appHeart().maxBpm).toBe(200);
});
