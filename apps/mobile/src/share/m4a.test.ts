import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

import { AAC_PACKET, audioTrackOf } from "./m4a";
import { mp4Of, musicDuration } from "./mp4";

const FOLDER = join(__dirname, "../../assets/music");

type Kept = { file: string; bytes: number; pcm_sha256: string; m4a_sha256: string };

/** What tools/video_music.py wrote about each track. */
const KEPT = JSON.parse(readFileSync(join(FOLDER, "music.json"), "utf8")) as Record<
  string,
  Kept
>;

function bytesOf(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FOLDER, KEPT[name].file)));
}

describe("the ten tracks in the app", () => {
  it("are the ten the script made, in the order the app shows them", () => {
    expect(Object.keys(KEPT)).toEqual([
      "energy",
      "chill",
      "epic",
      "sprint",
      "rock",
      "funk",
      "sunny",
      "trap",
      "retro",
      "fiesta",
    ]);
  });

  it.each(Object.keys(KEPT))("%s is the file of the script, under 300 KB", (name) => {
    const bytes = bytesOf(name);
    expect(bytes.length).toBe(KEPT[name].bytes);
    expect(bytes.length).toBeLessThan(300_000);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      KEPT[name].m4a_sha256,
    );
  });

  it.each(Object.keys(KEPT))("%s is 12 s of stereo AAC after its priming", (name) => {
    const track = audioTrackOf(bytesOf(name));
    expect(track.rate).toBe(44_100);
    expect(track.channels).toBe(2);
    expect(track.priming).toBe(2112);
    expect(track.frames).toBe(12 * 44_100);
    // Enough packets for the priming and the 12 s.
    expect(track.packets.length).toBe(Math.ceil((2112 + 12 * 44_100) / AAC_PACKET));
    // An ES descriptor (tag 3) after version and flags.
    expect(Array.from(track.esds.subarray(0, 5))).toEqual([0, 0, 0, 0, 3]);
  });
});

describe("audioTrackOf", () => {
  const bytes = bytesOf("energy");
  const track = audioTrackOf(bytes);

  it("takes every packet from the file's one chunk, in order", () => {
    const total = track.packets.reduce((sum, p) => sum + p.length, 0);
    const first = track.packets[0];
    const last = track.packets[track.packets.length - 1];
    expect(first.byteOffset - bytes.byteOffset + total).toBe(bytes.length);
    expect(last.byteOffset + last.length - bytes.byteOffset).toBe(bytes.length);
  });

  it("makes a video's music exactly as long as the video's 12 s", () => {
    expect(musicDuration(track, 12 * 90_000)).toBe(12 * 90_000);
  });

  it("goes into a video's file whole", () => {
    const avcC = Uint8Array.of(1, 0x42, 0xe0, 0x28, 0xff);
    const samples = [{ data: new Uint8Array(10), time: 0, key: true }];
    const file = mp4Of({ width: 1080, height: 1920, fps: 30, avcC, samples }, track);
    const total = track.packets.reduce((sum, p) => sum + p.length, 0);
    expect(Array.from(file.subarray(file.length - total))).toEqual(
      Array.from(bytes.subarray(bytes.length - total)),
    );
  });

  it("refuses a file that is not an M4A of AAC", () => {
    expect(() => audioTrackOf(new Uint8Array(16))).toThrow();
    const broken = bytes.slice();
    const at = Buffer.from(broken).indexOf("mp4a");
    broken.set([0x61, 0x76, 0x63, 0x31], at); // "avc1"
    expect(() => audioTrackOf(broken)).toThrow("not AAC");
  });

  it("refuses a file without its edit list", () => {
    const broken = bytes.slice();
    const at = Buffer.from(broken).indexOf("edts");
    broken.set([0x66, 0x72, 0x65, 0x65], at); // "free"
    expect(() => audioTrackOf(broken)).toThrow("no edts");
  });
});
