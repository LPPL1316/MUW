import type { LatLon } from "@shaperoute/shared-types";

import type { ActivityDetail } from "../api/activities";
import type { Track } from "../navigation/trackRecorder";
import {
  POST_RESULTS,
  postCaption,
  postLine,
  postOfActivity,
  postOfTrack,
  type PostRun,
  postRequestOf,
  resultsOf,
  resultValue,
} from "./postRun";

jest.mock("expo-file-system");

/** A straight line north from Trento, a point every `step` metres. */
function north(metres: number, step = 50): LatLon[] {
  const degree = 111_195; // metres in a degree of latitude
  return Array.from({ length: Math.round(metres / step) + 1 }, (_, i): LatLon => [
    46.07 + (i * step) / degree,
    11.12,
  ]);
}

const RUN: PostRun = {
  key: "run-1",
  title: "Heart in Trento",
  track: north(5200),
  distanceM: 5200,
  durationMs: (28 * 60 + 10) * 1000,
};

describe("the results of a post", () => {
  it("are distance, time and pace, as runners read them, and never the score", () => {
    expect(resultsOf(RUN)).toEqual(["distance", "time", "pace"]);
    expect(POST_RESULTS).not.toContain("score");
    expect(resultValue(RUN, "distance")).toBe("5.20 km");
    expect(resultValue(RUN, "time")).toBe("28:10");
    expect(resultValue(RUN, "pace")).toBe("5:25 /km");
  });

  it("leave out a pace too short to read", () => {
    expect(resultsOf({ ...RUN, distanceM: 60 })).toEqual(["distance", "time"]);
  });
});

describe("the text that goes to Strava", () => {
  it("has the emoji, then the results shown, in the post's order", () => {
    expect(postCaption(RUN, ["pace", "distance", "time"], ["🔥", "❤️"])).toBe(
      "🔥❤️ 5.20 km · 28:10 · 5:25 /km",
    );
    expect(postCaption(RUN, ["time"], [])).toBe("28:10");
    expect(postCaption(RUN, [], ["🎉"])).toBe("🎉");
  });

  it("is nothing when the post says nothing", () => {
    expect(postCaption(RUN, [], [])).toBeNull();
    expect(postCaption({ ...RUN, distanceM: 60 }, ["pace"], [])).toBeNull();
  });
});

describe("the line of the post", () => {
  it("is the whole track, start and end too (ADR-0330)", () => {
    const track = north(1000);
    expect(postLine(track)).toEqual(track);
    expect(postLine(north(390))).toEqual(north(390));
  });

  it("is nothing with fewer than two fixes", () => {
    expect(postLine(north(390).slice(0, 1))).toEqual([]);
    expect(postLine([])).toEqual([]);
  });
});

describe("a post made of", () => {
  it("a run of «My activities» has its key, title and numbers", () => {
    const activity = {
      id: "abc",
      started_at: "2026-10-04T08:00:00Z",
      place: "Trento",
      shape: "heart",
      word: null,
      style: null,
      title: null,
      distance_m: 5200,
      duration_s: 1690,
      score: 87,
      fidelity: null,
      similarity: 0.9,
      points: north(5000),
      track: north(5200),
    } as ActivityDetail;
    const post = postOfActivity(activity);
    expect(post).toMatchObject({
      key: "abc",
      distanceM: 5200,
      durationMs: 1_690_000,
    });
    expect(post).not.toHaveProperty("score");
    expect(post.title).toBe("Trento · Heart");
    expect(postOfActivity({ ...activity, title: "Morning" }).title).toBe("Morning");
  });

  it("a run that just ended has no key nor title, and its pauses left out", () => {
    const points = north(400, 100);
    const track: Track = {
      fixes: points.map((point, i) => ({ point, timeMs: i * 30_000, accuracyM: 5 })),
      distanceM: 400,
      pauses: [{ fromMs: 30_000, toMs: 60_000 }],
    };
    const post = postOfTrack(track);
    expect(post).toEqual({
      key: null,
      title: null,
      track: points,
      distanceM: 400,
      durationMs: 90_000,
    });
  });
});

describe("the post kept by the API (TASK-258)", () => {
  const ACTIVITY = {
    id: "abc",
    started_at: "2026-10-04T08:00:00Z",
    place: "Trento",
    shape: "heart",
    word: null,
    style: null,
    title: null,
    distance_m: 5200,
    duration_s: 1690,
    score: 87,
    fidelity: null,
    similarity: 0.9,
    points: north(5000),
    track: north(5200),
  } as ActivityDetail;
  const kept = {
    title: "Trento · Star",
    results: ["distance", "pace"],
    emoji: [{ emoji: "🔥", x: 0.8, y: 0.24 }],
    shared_at: "2026-10-06T10:15:00Z",
  };

  it("opens with a run of «My activities», or not at all", () => {
    expect(postOfActivity(ACTIVITY).post).toBeNull();
    expect(postOfActivity({ ...ACTIVITY, post: null }).post).toBeNull();
    expect(postOfActivity({ ...ACTIVITY, post: kept }).post).toEqual(kept);
  });

  it("is what is on the picture now, the results in the post's order", () => {
    const emoji = [{ emoji: "❤️", x: 0.2, y: 0.5 }];
    expect(postRequestOf(RUN, ["pace", "distance"], emoji)).toEqual({
      title: "Heart in Trento",
      results: ["distance", "pace"],
      emoji,
    });
    expect(postRequestOf({ ...RUN, title: null }, [], [])).toEqual({
      title: null,
      results: [],
      emoji: [],
    });
  });
});
