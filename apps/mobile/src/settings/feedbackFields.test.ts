import { MAX_FEEDBACK_LENGTH } from "@shaperoute/shared-types";

import {
  appVersion,
  checkFeedback,
  feedbackProblem,
  phoneSystem,
} from "./feedbackFields";

type Config = Parameters<typeof appVersion>[0];

function config(changes: object): Config {
  return { name: "MuW", slug: "muw", ...changes } as Config;
}

test("the message is sent without spaces at either end", () => {
  expect(checkFeedback("  More hearts\nplease  ")).toEqual({
    ok: true,
    text: "More hearts\nplease",
  });
  expect(checkFeedback(" \n ")).toEqual({
    ok: false,
    problem: "Write something first.",
  });
  // A paste past the limit is cut to what the API takes.
  const long = checkFeedback("x".repeat(MAX_FEEDBACK_LENGTH + 5));
  expect(long.ok && long.text.length).toBe(MAX_FEEDBACK_LENGTH);
});

test("the app's version, with its build on each system", () => {
  const both = config({
    version: "1.0.0",
    ios: { buildNumber: "7" },
    android: { versionCode: 3 },
  });
  expect(appVersion(both, "ios")).toBe("1.0.0 (7)");
  expect(appVersion(both, "android")).toBe("1.0.0 (3)");
  expect(appVersion(config({ version: "1.0.0" }), "ios")).toBe("1.0.0");
  expect(appVersion(config({}), "ios")).toBeNull();
  expect(appVersion(null, "ios")).toBeNull();
});

test("the phone's system, as the API names it", () => {
  expect(phoneSystem("ios")).toBe("ios");
  expect(phoneSystem("android")).toBe("android");
  expect(phoneSystem("web")).toBeNull();
});

test("too many in a day is said as tomorrow, the rest as any account request", () => {
  expect(
    feedbackProblem({
      kind: "api_error",
      code: "too_many_requests",
      message: "x",
      suggested_distance_m: null,
      retryAfterS: 3600,
    }),
  ).toBe("You sent a lot of feedback today. Try again tomorrow.");
  expect(
    feedbackProblem({
      kind: "api_error",
      code: "http_error",
      message: "Not Found",
      suggested_distance_m: null,
      retryAfterS: null,
    }),
  ).toBe("This is not available any more.");
  expect(
    feedbackProblem({ kind: "unreachable", url: "https://api.example.com" }),
  ).toMatch(/^No connection\./);
});
