/// <reference types="node" />

import { readFileSync } from "fs";
import { join } from "path";

const FOLDER = join(__dirname, "../../assets/music");
const ENERGY = join(FOLDER, "energy.m4a");

const mockDownload = jest.fn(async () => {});
const mockAsset = {
  downloadAsync: mockDownload,
  localUri: `file://${ENERGY}` as string | null,
};
jest.mock("expo-asset", () => ({
  Asset: { fromModule: jest.fn(() => mockAsset) },
}));
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async bytes() {
      const fs = jest.requireActual<typeof import("fs")>("fs");
      return new Uint8Array(fs.readFileSync(this.uri.replace("file://", "")));
    }
  },
}));

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
};
const mockCreate = jest.fn((_source: unknown) => mockPlayer);
jest.mock("expo-audio", () => ({ createAudioPlayer: mockCreate }));

type VideoMusic = typeof import("./videoMusic");

/** The module as the app first loads it: no player yet. */
function fresh(): VideoMusic {
  let module: VideoMusic | undefined;
  jest.isolateModules(() => {
    module = jest.requireActual<VideoMusic>("./videoMusic");
  });
  return module!;
}

/** The promises a tap starts, settled. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  mockAsset.localUri = `file://${ENERGY}`;
});

describe("the tracks", () => {
  const { MUSIC, musicName } = fresh();

  it("are the ten the script made, in its order", () => {
    const kept = JSON.parse(readFileSync(join(FOLDER, "music.json"), "utf8")) as object;
    expect([...MUSIC]).toEqual(Object.keys(kept));
  });

  it("have the names the runner sees", () => {
    expect(MUSIC.map(musicName)).toEqual([
      "Energy",
      "Chill",
      "Epic",
      "Sprint",
      "Rock",
      "Funk",
      "Sunny",
      "Trap",
      "Retro",
      "Fiesta",
    ]);
  });
});

describe("musicTrack", () => {
  it("reads the track from the app's own file, on the phone", async () => {
    const { musicTrack } = fresh();
    const track = await musicTrack("energy");
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(track.frames).toBe(12 * 44_100);
    expect(track.packets.length).toBeGreaterThan(500);
  });

  it("fails when the file is not on the phone", async () => {
    const { musicTrack } = fresh();
    mockAsset.localUri = null;
    await expect(musicTrack("rock")).rejects.toThrow();
  });
});

describe("hearMusic", () => {
  it("plays a track from its start, another in its place, and stops", async () => {
    const { hearMusic } = fresh();
    hearMusic("energy");
    await settled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    hearMusic("funk");
    await settled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);

    hearMusic(null);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it("lets the player go when the post closes, and makes a new one after", async () => {
    const { hearMusic, endMusic } = fresh();
    hearMusic("chill");
    endMusic();
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    hearMusic("chill");
    await settled();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("stays quiet on a phone that cannot play, without failing", () => {
    const { hearMusic } = fresh();
    mockCreate.mockImplementationOnce(() => {
      throw new Error("no audio");
    });
    expect(() => hearMusic("epic")).not.toThrow();
    expect(() => hearMusic("epic")).not.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("does nothing for «None» before any track", () => {
    const { hearMusic } = fresh();
    hearMusic(null);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
