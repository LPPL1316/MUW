/// <reference types="node" />

import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ActivitiesContext, useActivitiesDoor } from "../activities/activitiesDoor";
import type { PostRun } from "./postRun";
import { SharePost } from "./SharePost";
import { VIDEO_FILE, VIDEO_SILENCE_MS } from "./videoFile";
import type { VideoPageMessage } from "./videoPage";

jest.mock("expo-file-system");
jest.mock("react-native-view-shot");
jest.mock("react-native-webview");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

const { written } =
  jest.requireMock<typeof import("../../__mocks__/expo-file-system")>(
    "expo-file-system",
  );
const { injectJavaScript: inject } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const share = jest.mocked(Sharing.shareAsync);
const available = jest.mocked(Sharing.isAvailableAsync);

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

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const keepPost = jest.fn();

function WithDoor({ children }: { children: ReactNode }) {
  const nothing = useActivitiesDoor();
  return (
    <ActivitiesContext.Provider value={{ ...nothing, keepPost }}>
      {children}
    </ActivitiesContext.Provider>
  );
}

async function shown() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <WithDoor>
        <SharePost run={RUN} onClose={() => {}} />
      </WithDoor>
    </SafeAreaProvider>,
  );
}

function base64(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64");
}

/** What the hidden page would say. */
async function page(message: VideoPageMessage) {
  await fireEvent(screen.getByTestId("run-video"), "message", {
    nativeEvent: { data: JSON.stringify(message) },
  });
}

async function exportVideo() {
  await fireEvent.press(screen.getByRole("button", { name: "Export video" }));
}

beforeEach(() => {
  share.mockClear();
  available.mockClear();
  inject.mockClear();
  keepPost.mockClear();
  written.clear();
});

describe("Export video", () => {
  it("makes the video in the hidden page, writes an MP4 and shares it", async () => {
    await shown();
    expect(screen.queryByTestId("run-video")).toBeNull();
    await exportVideo();
    expect(screen.getByTestId("run-video")).toBeOnTheScreen();

    await page({ type: "ready", codec: "avc1.42e028" });
    expect(inject).toHaveBeenCalledTimes(1);
    const call = inject.mock.calls[0][0];
    expect(call.startsWith("window.muwVideo.make({")).toBe(true);
    expect(call).toContain('"width":1080');
    expect(call).toContain("Heart in Trento");

    await page({ type: "config", avcC: base64([1, 0x42, 0xe0, 0x28]) });
    await page({
      type: "chunks",
      list: [
        { key: true, time: 0, data: base64([0, 0, 0, 2, 0x65, 0x88]) },
        { key: false, time: 33_333, data: base64([0, 0, 0, 1, 0x41]) },
      ],
    });
    await page({ type: "progress", frames: 180 });
    expect(screen.getByText("Making the video… 50%")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Instagram" })).toBeDisabled();

    await page({ type: "done", frames: 360 });
    expect(share).toHaveBeenCalledWith(
      `file:///cache/${VIDEO_FILE}`,
      expect.objectContaining({ mimeType: "video/mp4", UTI: "public.mpeg-4" }),
    );
    const file = written.get(`file:///cache/${VIDEO_FILE}`) as unknown as Uint8Array;
    expect(String.fromCharCode(...file.subarray(4, 8))).toBe("ftyp");
    // The two pictures, one after the other, at the end of the file.
    expect(Array.from(file.subarray(file.length - 11))).toEqual([
      0, 0, 0, 2, 0x65, 0x88, 0, 0, 0, 1, 0x41,
    ]);
    expect(keepPost).toHaveBeenCalledWith("run-1", expect.anything());
    expect(screen.queryByTestId("run-video")).toBeNull();
    expect(screen.getByRole("button", { name: "Export video" })).toBeEnabled();
  });

  it("says so when the phone cannot make videos, and shares nothing", async () => {
    await shown();
    await exportVideo();
    await page({ type: "ready", codec: null });
    expect(inject).not.toHaveBeenCalled();
    expect(screen.getByText("This phone cannot make the video.")).toBeOnTheScreen();
    expect(screen.queryByTestId("run-video")).toBeNull();
    expect(share).not.toHaveBeenCalled();
    expect(keepPost).not.toHaveBeenCalled();
  });

  it("says so when the page fails", async () => {
    await shown();
    await exportVideo();
    await page({ type: "ready", codec: "avc1.42e028" });
    await page({ type: "failed", error: "EncodingError" });
    expect(
      screen.getByText("The video could not be made. Try again."),
    ).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
  });

  it("fails a video whose pictures never came", async () => {
    await shown();
    await exportVideo();
    await page({ type: "ready", codec: "avc1.42e028" });
    await page({ type: "done", frames: 360 });
    expect(
      screen.getByText("The video could not be made. Try again."),
    ).toBeOnTheScreen();
    expect(share).not.toHaveBeenCalled();
  });

  it("gives up when the page says nothing for too long", async () => {
    jest.useFakeTimers();
    try {
      await shown();
      await exportVideo();
      await page({ type: "ready", codec: "avc1.42e028" });
      await act(async () => {
        jest.advanceTimersByTime(VIDEO_SILENCE_MS - 1000);
      });
      expect(screen.getByTestId("run-video")).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.queryByTestId("run-video")).toBeNull();
      expect(
        screen.getByText("The video could not be made. Try again."),
      ).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it("makes nothing on a phone with no share sheet", async () => {
    available.mockResolvedValueOnce(false);
    await shown();
    await exportVideo();
    expect(screen.queryByTestId("run-video")).toBeNull();
    expect(
      screen.getByText("This phone cannot open the share sheet."),
    ).toBeOnTheScreen();
  });
});
