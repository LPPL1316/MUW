import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";
import type { ReactNode } from "react";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { ActivitiesContext, useActivitiesDoor } from "../activities/activitiesDoor";
import type { StravaActivity, StravaOutcome } from "../api/strava";
import { StravaContext, type StravaState } from "../strava/useStrava";
import type { PostRun } from "./postRun";
import { SharePost, SharePostButton } from "./SharePost";
import { MAX_STICKERS, POST_EMOJI } from "./stickers";

jest.mock("expo-file-system");
jest.mock("react-native-view-shot");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

const share = jest.mocked(Sharing.shareAsync);
const capture = jest.mocked(captureRef);

/** A straight line north, a point every 50 m. */
function north(metres: number): LatLon[] {
  return Array.from({ length: metres / 50 + 1 }, (_, i): LatLon => [
    46.07 + (i * 50) / 111_195,
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

type Fake = Partial<StravaState> & { activity?: StravaActivity };

function strava({ activity, ...state }: Fake = {}): StravaState {
  return {
    status: { available: true, connected: true, athlete: "Luca" },
    busy: null,
    problem: null,
    ensure: () => {},
    connect: jest.fn(),
    disconnect: () => {},
    activityOf: async () => ({
      kind: "ok",
      value: activity ?? { status: "not_sent", url: null },
      http: 200,
    }),
    send: jest.fn(async () => ({
      kind: "ok" as const,
      value: { status: "sent" as const, url: "https://www.strava.com/activities/9" },
      http: 200,
    })),
    ...state,
  };
}

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The post, as the API keeps it (TASK-258): what «Share» sent. */
const keepPost = jest.fn();

function WithDoor({ children }: { children: ReactNode }) {
  const nothing = useActivitiesDoor();
  return (
    <ActivitiesContext.Provider value={{ ...nothing, keepPost }}>
      {children}
    </ActivitiesContext.Provider>
  );
}

function shown(node: ReactNode, state: StravaState = strava()) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <StravaContext.Provider value={state}>
        <WithDoor>{node}</WithDoor>
      </StravaContext.Provider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  share.mockClear();
  capture.mockClear();
  keepPost.mockClear();
});

describe("the post", () => {
  it("shows the title, the drawing, and every result", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    expect(screen.getByText("Heart in Trento")).toBeOnTheScreen();
    expect(screen.getAllByTestId("post-drawing").length).toBeGreaterThan(0);
    for (const value of ["5.20 km", "28:10", "5:25 /km"]) {
      expect(screen.getByText(value)).toBeOnTheScreen();
    }
    await screen.findByText("Send to Strava");
  });

  it("drops a result turned off, and brings it back", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    const pace = screen.getByRole("checkbox", { name: "Pace" });
    expect(pace).toBeChecked();
    await fireEvent.press(pace);
    expect(screen.queryByText("5:25 /km")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Pace" })).not.toBeChecked();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Pace" }));
    expect(screen.getByText("5:25 /km")).toBeOnTheScreen();
    await screen.findByText("Send to Strava");
  });

  it("offers no score, and writes none on the picture", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: "Score" })).toBeNull();
    expect(screen.queryByText("Score")).toBeNull();
    await screen.findByText("Send to Strava");
  });

  it("takes emoji, five at most, and lets one go when it is tapped", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    for (const emoji of POST_EMOJI.slice(0, MAX_STICKERS + 1)) {
      await fireEvent.press(screen.getByRole("button", { name: `Add ${emoji}` }));
    }
    expect(screen.getAllByTestId("post-sticker")).toHaveLength(MAX_STICKERS);
    expect(
      screen.getByText("Up to 5 emoji: tap one on the post to take it off."),
    ).toBeOnTheScreen();

    const fire = screen.getByRole("button", { name: "🔥" });
    await fireEvent(fire, "responderGrant", {
      nativeEvent: { pageX: 100, pageY: 100 },
    });
    await fireEvent(fire, "responderRelease", {
      nativeEvent: { pageX: 102, pageY: 101 },
    });
    expect(screen.getAllByTestId("post-sticker")).toHaveLength(MAX_STICKERS - 1);
    expect(screen.queryByRole("button", { name: "🔥" })).toBeNull();
    await screen.findByText("Send to Strava");
  });

  it("moves an emoji the finger drags, without taking it off", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Add 🔥" }));
    const before = screen.getByTestId("post-sticker").props.style;
    const sticker = screen.getByTestId("post-sticker");
    await fireEvent(sticker, "responderGrant", {
      nativeEvent: { pageX: 100, pageY: 100 },
    });
    await fireEvent(sticker, "responderMove", {
      nativeEvent: { pageX: 60, pageY: 140 },
    });
    await fireEvent(sticker, "responderRelease", {
      nativeEvent: { pageX: 60, pageY: 140 },
    });
    const after = screen.getByTestId("post-sticker").props.style;
    expect(after[1].left).toBeCloseTo(before[1].left - 40, 0);
    expect(after[1].top).toBeCloseTo(before[1].top + 40, 0);
    await screen.findByText("Send to Strava");
  });

  it("lets VoiceOver take an emoji off", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Add 🎉" }));
    await fireEvent(screen.getByTestId("post-sticker"), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });
    expect(screen.queryByTestId("post-sticker")).toBeNull();
    await screen.findByText("Send to Strava");
  });
});

describe("«Instagram»", () => {
  it("makes the picture of the post and opens the share sheet", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.anything() }),
      {
        format: "png",
        result: "tmpfile",
      },
    );
    expect(share.mock.calls[0][0]).toBe("file:///cache/post.png");
  });

  it("says so when the picture could not be made", async () => {
    capture.mockRejectedValueOnce(new Error("no view"));
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
    expect(
      await screen.findByText("The picture could not be made. Try again."),
    ).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
  });
});

describe("Strava on the post", () => {
  it("sends the run with the emoji and the results shown as its text", async () => {
    const state = strava();
    await shown(<SharePost run={RUN} onClose={() => {}} />, state);
    await fireEvent.press(screen.getByRole("button", { name: "Add 🔥" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Time" }));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Send to Strava" }),
    );
    expect(state.send).toHaveBeenCalledWith("run-1", null, "🔥 5.20 km · 5:25 /km");
    expect(await screen.findByText("View on Strava")).toBeOnTheScreen();
  });

  it("opens a run already on Strava, and says how to add the picture", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const url = "https://www.strava.com/activities/7";
    await shown(
      <SharePost run={RUN} onClose={() => {}} />,
      strava({ activity: { status: "sent", url } }),
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "View on Strava" }),
    );
    expect(open).toHaveBeenCalledWith(url);
    expect(
      screen.getByText(
        "Strava takes no pictures from other apps: keep this one in Photos with «Save Image» and add it there.",
      ),
    ).toBeOnTheScreen();
    open.mockRestore();
  });

  it("puts the post's text on a run already on Strava", async () => {
    const url = "https://www.strava.com/activities/7";
    const state = strava({ activity: { status: "sent", url } });
    await shown(<SharePost run={RUN} onClose={() => {}} />, state);
    await fireEvent.press(screen.getByRole("button", { name: "Add 🏆" }));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Update on Strava" }),
    );
    expect(state.send).toHaveBeenCalledWith(
      "run-1",
      null,
      "🏆 5.20 km · 28:10 · 5:25 /km",
    );
    expect(
      await screen.findByText("The activity on Strava has this post's text now."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "View on Strava" })).toBeOnTheScreen();
  });

  it("says so when Strava does not let the text change", async () => {
    const url = "https://www.strava.com/activities/7";
    const state = strava({
      activity: { status: "sent", url },
      send: jest.fn(async (): Promise<StravaOutcome<StravaActivity>> => ({
        kind: "api_error",
        code: "invalid_request",
        message: "…",
        suggested_distance_m: null,
        retryAfterS: null,
        http: 422,
      })),
    });
    await shown(<SharePost run={RUN} onClose={() => {}} />, state);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Update on Strava" }),
    );
    expect(
      await screen.findByText(
        "Strava did not let MuW change this activity. Change its text on Strava.",
      ),
    ).toBeOnTheScreen();
    // Still on Strava, as it was: it can be tried again.
    expect(screen.getByRole("button", { name: "Update on Strava" })).toBeOnTheScreen();
    expect(
      screen.queryByText("The activity on Strava has this post's text now."),
    ).toBeNull();
  });

  it("offers no update when the post has nothing to say", async () => {
    await shown(
      <SharePost run={{ ...RUN, distanceM: 0, durationMs: 0 }} onClose={() => {}} />,
      strava({
        activity: { status: "sent", url: "https://www.strava.com/activities/7" },
      }),
    );
    for (const name of ["Distance", "Time"]) {
      await fireEvent.press(screen.getByRole("checkbox", { name }));
    }
    expect(
      await screen.findByRole("button", { name: "View on Strava" }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Update on Strava" })).toBeNull();
  });

  it("before «Save», says where the run goes to Strava from", async () => {
    await shown(<SharePost run={{ ...RUN, key: null }} onClose={() => {}} />);
    expect(
      screen.getByText(
        "To send this post to Strava, save the run, then share it from «My activities».",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Send to Strava")).toBeNull();
  });

  it("asks to connect first, and shows nothing of Strava when the API has none", async () => {
    const { unmount } = await shown(
      <SharePost run={RUN} onClose={() => {}} />,
      strava({ status: { available: true, connected: false, athlete: null } }),
    );
    expect(
      screen.getByRole("button", { name: "Connect with Strava" }),
    ).toBeOnTheScreen();
    await unmount();

    await shown(
      <SharePost run={RUN} onClose={() => {}} />,
      strava({ status: { available: false, connected: false, athlete: null } }),
    );
    expect(screen.queryByText(/Strava/)).toBeNull();
  });
});

test("«Share» opens the post of the run, and «Close» closes it", async () => {
  const makeRun = jest.fn(() => RUN);
  await shown(
    <SharePostButton makeRun={makeRun} />,
    strava({ status: { available: false, connected: false, athlete: null } }),
  );
  expect(screen.queryByText("Share your run")).toBeNull();
  expect(makeRun).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Share" }));
  expect(makeRun).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Share your run")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByText("Share your run")).toBeNull();
});

describe("the post kept with the run (TASK-258)", () => {
  const KEPT = {
    title: "Heart in Trento",
    results: ["distance", "pace"],
    emoji: [
      { emoji: "🔥", x: 0.8, y: 0.24 },
      { emoji: "🎉", x: 0.2, y: 0.5 },
    ],
    shared_at: "2026-10-06T10:15:00Z",
  };

  it("goes to the API once the share sheet has opened, as it is", async () => {
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Add 🔥" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Time" }));
    await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
    await waitFor(() => expect(keepPost).toHaveBeenCalledTimes(1));
    expect(keepPost).toHaveBeenCalledWith("run-1", {
      title: "Heart in Trento",
      results: ["distance", "pace"],
      emoji: [{ emoji: "🔥", x: 0.8, y: 0.24 }],
    });
  });

  it("goes to the API when the run is sent to Strava, and not when the picture fails", async () => {
    capture.mockRejectedValueOnce(new Error("no view"));
    await shown(<SharePost run={RUN} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
    await screen.findByText("The picture could not be made. Try again.");
    expect(keepPost).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Add ❤️" }));
    await fireEvent.press(
      await screen.findByRole("button", { name: "Send to Strava" }),
    );
    await screen.findByText("View on Strava");
    expect(keepPost).toHaveBeenCalledWith("run-1", {
      title: "Heart in Trento",
      results: ["distance", "time", "pace"],
      emoji: [{ emoji: "❤️", x: 0.8, y: 0.24 }],
    });
  });

  it("is not kept before «Save»: the run has no key yet", async () => {
    await shown(<SharePost run={{ ...RUN, key: null }} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole("button", { name: "Instagram" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(keepPost).not.toHaveBeenCalled();
  });

  it("opens as it was shared: the same emoji where they were, the same results", async () => {
    await shown(<SharePost run={{ ...RUN, post: KEPT }} onClose={() => {}} />);
    expect(screen.getAllByTestId("post-sticker")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "🔥" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "🎉" })).toBeOnTheScreen();
    expect(screen.getByRole("checkbox", { name: "Distance" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Time" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pace" })).toBeChecked();
    expect(screen.queryByText("28:10")).toBeNull();
    await screen.findByText("Send to Strava");
  });

  it("forgets a kept result the run no longer has", async () => {
    // Too short for a pace: the kept «pace» has nothing to show.
    const short = { ...RUN, distanceM: 60, durationMs: 20_000, post: KEPT };
    await shown(<SharePost run={short} onClose={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: "Pace" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Distance" })).toBeChecked();
    await screen.findByText("Send to Strava");
  });
});
