import { EDIT_REASONS, IMAGE_REASONS } from "@shaperoute/shared-types";

import {
  EDIT_REASON_TEXT,
  editProblemText,
  imageProblemText,
  problemText,
  REASON_TEXT,
} from "./problems";
import type { RouteProblem } from "./useRouteRequest";

const REASON = "a 5 km heart cannot be drawn here: the best route scores 0.52";

test.each<[RouteProblem, string, string | undefined]>([
  [{ kind: "no_sharing" }, "This phone cannot open the share sheet.", undefined],
  [
    { kind: "share_failed" },
    "The GPX could not be saved on the phone. Try again.",
    undefined,
  ],
])("%j", (problem, text, detail) => {
  expect(problemText(problem)).toEqual(detail ? { text, detail } : { text });
});

// --- what the runner reads, and what only the developer reads (TASK-256) ---

const OUR_SIDE = "Something went wrong on our side. Try again in a moment.";

test.each<[RouteProblem, string, string | undefined]>([
  [
    { kind: "api_error", code: "map_data_unavailable", message: "Overpass timed out" },
    "Map data for this area could not be downloaded. Try again later.",
    "Overpass timed out",
  ],
  [
    { kind: "api_error", code: "engine_error", message: "see the API log" },
    "The route could not be drawn. Try again, or try another start.",
    "see the API log",
  ],
  [
    { kind: "api_error", code: "invalid_request", message: "distance_m: missing" },
    OUR_SIDE,
    "invalid_request: distance_m: missing",
  ],
  [
    { kind: "api_error", code: "http_error", message: "Not Found" },
    OUR_SIDE,
    "http_error: Not Found",
  ],
  [{ kind: "bad_answer", status: 502 }, OUR_SIDE, "unexpected answer, HTTP 502"],
  [
    { kind: "unreachable", url: "http://192.168.1.23:8000" },
    "No connection. Check the network and try again.",
    "Cannot reach the API at http://192.168.1.23:8000.",
  ],
  [
    { kind: "timeout" },
    "Drawing this route is taking too long. Try again later, or a shorter distance.",
    undefined,
  ],
  [{ kind: "lost" }, "This request was lost. Try again.", undefined],
])("%j may well go through a second time: «Try again»", (problem, text, detail) => {
  expect(problemText(problem)).toEqual(
    detail ? { text, detail, retry: true } : { text, retry: true },
  );
});

test("an app without the address of its service is an app to update", () => {
  expect(problemText({ kind: "no_api_url" })).toEqual({
    text: "The app cannot reach the service. Update the app.",
    detail: "The app has no API address: open it from the QR code of npm run mobile.",
  });
});

test("a word the AI cannot read right now offers the shapes that need no AI", () => {
  const { text, retry } = problemText({
    kind: "api_error",
    code: "ai_unavailable",
    message: "Ollama is not running",
  });
  expect(text).toMatch(
    /^This word cannot be read right now\. Try one of these: circle, heart/,
  );
  expect(retry).toBeUndefined();
});

/** Every problem the screen can be given, with the API's words at their
 * most technical. */
const EVERY_PROBLEM: RouteProblem[] = [
  ...(
    [
      "shape_not_drawable",
      "map_data_unavailable",
      "engine_error",
      "image_not_usable",
      "outline_edit_rejected",
      "ai_unavailable",
      "unauthorized",
      "too_many_requests",
      "invalid_request",
      "http_error",
    ] as const
  ).map((code) => ({
    kind: "api_error" as const,
    code,
    message:
      "HTTP 500 from http://10.0.0.2:8000: look at the API log (Ollama, npm, .env)",
  })),
  { kind: "bad_answer", status: 502 },
  { kind: "unreachable", url: "http://10.0.0.2:8000" },
  { kind: "timeout" },
  { kind: "lost" },
  { kind: "no_sharing" },
  { kind: "share_failed" },
  { kind: "no_api_url" },
];

/** Words for the developer, never for whoever runs (TASK-256). */
const DEVELOPER_WORDS = /http|\.env|npm|Ollama|--lan|API log|bug/i;

test("no text for the runner has a developer's words in it", () => {
  for (const problem of EVERY_PROBLEM) {
    for (const kind of ["shape", "word", "image"] as const) {
      expect(problemText(problem, kind).text).not.toMatch(DEVELOPER_WORDS);
    }
  }
  for (const text of [
    ...Object.values(REASON_TEXT),
    ...Object.values(EDIT_REASON_TEXT),
  ]) {
    expect(text).not.toMatch(DEVELOPER_WORDS);
  }
});

test("the detail is for a development build: nothing on a phone", () => {
  const dev = __DEV__;
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
  try {
    for (const problem of EVERY_PROBLEM) {
      expect(problemText(problem).detail).toBeUndefined();
    }
  } finally {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;
  }
  // Under jest, as in a development build.
  expect(problemText({ kind: "unreachable", url: "http://pc:8000" }).detail).toBe(
    "Cannot reach the API at http://pc:8000.",
  );
});

const FAR =
  "a 7 km heart cannot be drawn here: the best shape is -2.7 km from the target";

test("a shape that misses the distance offers the distance it fits", () => {
  expect(
    problemText({
      kind: "api_error",
      code: "shape_not_drawable",
      message: FAR,
      suggested_distance_m: 4000,
    }),
  ).toEqual({
    text: "This shape does not fit the roads here at this distance. It fits at about 4 km.",
    detail: FAR,
    tryDistanceM: 4000,
  });
});

test.each([null, undefined, 30_000])(
  "without a distance the app can ask for (%p), the shapes are offered",
  (suggested) => {
    expect(
      problemText({
        kind: "api_error",
        code: "shape_not_drawable",
        message: REASON,
        suggested_distance_m: suggested,
      }),
    ).toEqual({
      text: "This shape does not fit the roads here. Try another shape, or another start:",
      detail: REASON,
      pickShape: true,
    });
  },
);

test("by bike the distance offered is within 10–30 km (TASK-190)", () => {
  const notDrawable = {
    kind: "api_error",
    code: "shape_not_drawable",
    message: FAR,
  } as const satisfies RouteProblem;
  // Over a run's 21 km, within the bike's 30.
  expect(
    problemText({ ...notDrawable, suggested_distance_m: 25_000 }, "shape", "cycling"),
  ).toEqual({
    text: "This shape does not fit the roads here at this distance. It fits at about 25 km.",
    detail: FAR,
    tryDistanceM: 25_000,
  });
  // The same suggestion for a run is not offered, as before.
  expect(problemText({ ...notDrawable, suggested_distance_m: 25_000 })).toMatchObject({
    pickShape: true,
  });
  // Outside the bike's limits it is not offered either.
  for (const outside of [4000, 31_000]) {
    expect(
      problemText(
        { ...notDrawable, suggested_distance_m: outside },
        "shape",
        "cycling",
      ),
    ).not.toHaveProperty("tryDistanceM");
  }
});

describe("on the water (TASK-191)", () => {
  // The API's messages, from the engine (route_engine/water_fit.py).
  const NO_WATER = "there is no lake or sea to paddle on within 2 km of here";
  const TOO_BIG =
    "the heart does not fit at 5 km on the water within 1 km of the shore here: it fits at 3.1 km";
  const TOO_SMALL =
    "the heart does not fit on the water within 1 km of the shore here, even at 0.6 km";

  test("a drawing refused by an API before TASK-369 B says the water takes a shape, with no «Try again»", () => {
    const OLD = "on the water only a shape of the catalogue is drawn, not an image";
    expect(
      problemText(
        { kind: "api_error", code: "invalid_request", message: OLD },
        "shape",
        "paddling",
      ),
    ).toEqual({ text: "On the water, a shape of the catalogue.", detail: OLD });
    // On the roads the same words are still ours to fix.
    expect(
      problemText(
        { kind: "api_error", code: "invalid_request", message: OLD },
        "shape",
        "running",
      ).retry,
    ).toBe(true);
  });

  test("no water near the start says so, with no distance nor shapes", () => {
    expect(
      problemText(
        { kind: "api_error", code: "shape_not_drawable", message: NO_WATER },
        "shape",
        "paddling",
      ),
    ).toEqual({
      text: "There is no lake or sea near this start. Start from the shore, within 2 km of the water.",
      detail: NO_WATER,
    });
  });

  test("a shape too big offers the half km it fits at, said for the water", () => {
    expect(
      problemText(
        {
          kind: "api_error",
          code: "shape_not_drawable",
          message: TOO_BIG,
          suggested_distance_m: 2500,
        },
        "shape",
        "paddling",
      ),
    ).toEqual({
      text: "This shape does not fit on the water here at this distance. It fits at about 2.5 km.",
      detail: TOO_BIG,
      tryDistanceM: 2500,
    });
  });

  test("a shape that fits nowhere within 1–5 km offers the shapes", () => {
    for (const fits of [null, 500, 6000]) {
      expect(
        problemText(
          {
            kind: "api_error",
            code: "shape_not_drawable",
            message: TOO_SMALL,
            suggested_distance_m: fits,
          },
          "shape",
          "paddling",
        ),
      ).toEqual({
        text: "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:",
        detail: TOO_SMALL,
        pickShape: true,
      });
    }
  });

  test("the roads' words stay for a run and a bike route", () => {
    for (const activity of ["running", "cycling"] as const) {
      expect(
        problemText(
          { kind: "api_error", code: "shape_not_drawable", message: NO_WATER },
          "shape",
          activity,
        ).text,
      ).toBe(
        "This shape does not fit the roads here. Try another shape, or another start:",
      );
    }
  });
});

test("a word that fits at another distance offers it, as a word", () => {
  expect(
    problemText(
      {
        kind: "api_error",
        code: "shape_not_drawable",
        message: FAR,
        suggested_distance_m: 15_000,
      },
      "word",
    ),
  ).toEqual({
    text: "This word does not fit the roads here at this distance. It fits at about 15 km.",
    detail: FAR,
    tryDistanceM: 15_000,
  });
});

test("a word that does not fit is not offered the shapes", () => {
  expect(
    problemText(
      { kind: "api_error", code: "shape_not_drawable", message: REASON },
      "word",
    ),
  ).toEqual({
    text: "This word does not fit the roads here. Try a shorter word, or another start.",
    detail: REASON,
  });
});

test("every reason the engine gives has its own plain words", () => {
  for (const reason of IMAGE_REASONS) {
    const { text, detail } = problemText({
      kind: "api_error",
      code: "image_not_usable",
      message: "engine words",
      reason,
    });
    expect(text).toBe(REASON_TEXT[reason]);
    expect(detail).toBe("engine words");
  }
  expect(new Set(Object.values(REASON_TEXT)).size).toBe(IMAGE_REASONS.length);
  expect(REASON_TEXT.background).toMatch(/plain background/);
});

test("an image refused by an API without reasons still says something", () => {
  const problem = {
    kind: "api_error",
    code: "image_not_usable",
    message: "m",
  } as const;
  expect(problemText(problem).text).toMatch(/one clear outline/);
});

test("an outline that does not fit offers the distance, but no shapes", () => {
  const notDrawable = {
    kind: "api_error",
    code: "shape_not_drawable",
    message: REASON,
  } as const;
  const text = problemText(notDrawable, "image");
  expect(text.text).toMatch(/This outline does not fit/);
  expect(text.pickShape).toBeUndefined();
  expect(
    problemText({ ...notDrawable, suggested_distance_m: 9000 }, "image"),
  ).toMatchObject({ text: expect.stringMatching(/^This image/), tryDistanceM: 9000 });
});

test("picking problems are said before any API is asked", () => {
  expect(imageProblemText({ kind: "denied" }).text).toMatch(/camera is off/);
  expect(imageProblemText({ kind: "too_large", bytes: 12_300_000 }).text).toBe(
    "This picture is too large: 12.3 MB, at most 10 MB. Choose a smaller one.",
  );
  expect(imageProblemText({ kind: "pick_failed" }).text).toMatch(/could not be opened/);
  expect(imageProblemText({ kind: "unreachable", url: "http://pc:8000" }).text).toMatch(
    /^No connection/,
  );
});

test("every reason a drawn line is refused has its own plain words", () => {
  for (const reason of EDIT_REASONS) {
    const { text, detail } = editProblemText({
      kind: "api_error",
      code: "outline_edit_rejected",
      message: "engine words",
      reason,
    });
    expect(text).toBe(EDIT_REASON_TEXT[reason]);
    expect(detail).toBe("engine words");
  }
  expect(new Set(Object.values(EDIT_REASON_TEXT)).size).toBe(EDIT_REASONS.length);
  expect(EDIT_REASON_TEXT.short).toMatch(/too short/);
});

test("a line refused without a known reason still says something", () => {
  const problem = {
    kind: "api_error",
    code: "outline_edit_rejected",
    message: "m",
  } as const;
  expect(editProblemText(problem).text).toMatch(/Draw it again/);
  // An image reason never lands on an edit's words, nor the other way.
  expect(
    problemText({ ...problem, code: "image_not_usable", reason: "short" }).text,
  ).toMatch(/one clear outline/);
});

test("an outline the engine cannot draw says it does not fit, with no «Try again» (TASK-382)", () => {
  const CROSSES =
    "outline: the outline crosses itself: the sides starting at points 1 and 38 meet";
  const refused: RouteProblem = {
    kind: "api_error",
    code: "invalid_request",
    message: CROSSES,
  };
  expect(problemText(refused, "image", "running")).toEqual({
    text: "This outline does not fit the roads here. Try another distance, another start, or a simpler picture.",
    detail: CROSSES,
  });
  expect(problemText(refused, "image", "paddling")).toEqual({
    text: "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:",
    detail: CROSSES,
    pickShape: true,
  });
  // Any other refusal is still ours to fix.
  expect(
    problemText(
      { kind: "api_error", code: "invalid_request", message: "distance_m: missing" },
      "image",
      "paddling",
    ).retry,
  ).toBe(true);
});
