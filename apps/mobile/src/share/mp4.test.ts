import { createHash } from "crypto";

import type { AudioTrack } from "./m4a";
import {
  durationsOf,
  mp4Of,
  musicDuration,
  type VideoSample,
  type VideoTrack,
} from "./mp4";

type Box = { type: string; start: number; size: number; children: Box[] };

/** Boxes that hold boxes, and how many bytes come before the first. */
const CONTAINERS: Record<string, number> = {
  moov: 0,
  trak: 0,
  mdia: 0,
  minf: 0,
  dinf: 0,
  stbl: 0,
  stsd: 8,
  dref: 8,
  avc1: 78,
  edts: 0,
  mp4a: 28,
};

function u32(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(at);
}

function u16(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint16(at);
}

function typeAt(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(...bytes.subarray(at + 4, at + 8));
}

/** The boxes from `start` to `end`, each with its own inside. */
function boxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const found: Box[] = [];
  let at = start;
  while (at < end) {
    const size = u32(bytes, at);
    const type = typeAt(bytes, at);
    expect(size).toBeGreaterThanOrEqual(8);
    expect(at + size).toBeLessThanOrEqual(end);
    const skip = CONTAINERS[type];
    const children = skip === undefined ? [] : boxes(bytes, at + 8 + skip, at + size);
    found.push({ type, start: at, size, children });
    at += size;
  }
  expect(at).toBe(end);
  return found;
}

/** The box at `path` (types from the top), or a failed test. */
function find(tree: Box[], ...path: string[]): Box {
  const [type, ...rest] = path;
  const hit = tree.find((b) => b.type === type);
  if (hit === undefined) {
    throw new Error(`no ${type}`);
  }
  return rest.length === 0 ? hit : find(hit.children, ...rest);
}

const STBL = ["moov", "trak", "mdia", "minf", "stbl"];
const AVCC = Uint8Array.of(
  1,
  0x42,
  0xe0,
  0x28,
  0xff,
  0xe1,
  0,
  2,
  0x67,
  0x42,
  1,
  0,
  2,
  0x68,
  0xce,
);

function sample(index: number, length: number, key = false): VideoSample {
  return {
    data: new Uint8Array(length).fill(index + 1),
    time: (index * 1e6) / 30,
    key,
  };
}

function track(samples: VideoSample[]): VideoTrack {
  return { width: 1080, height: 1920, fps: 30, avcC: AVCC, samples };
}

describe("mp4Of", () => {
  const samples = [
    sample(0, 500, true),
    sample(1, 40),
    sample(2, 30),
    sample(3, 700, true),
  ];
  const file = mp4Of(track(samples));
  const tree = boxes(file, 0, file.length);

  it("puts the index before the pictures", () => {
    expect(tree.map((b) => b.type)).toEqual(["ftyp", "moov", "mdat"]);
    expect(typeAt(file, 0)).toBe("ftyp");
    expect(String.fromCharCode(...file.subarray(8, 12))).toBe("isom");
  });

  it("points the chunk at the first picture, the pictures one after the other", () => {
    const stco = find(tree, ...STBL, "stco");
    expect(u32(file, stco.start + 12)).toBe(1);
    const offset = u32(file, stco.start + 16);
    const mdat = find(tree, "mdat");
    expect(offset).toBe(mdat.start + 8);
    let at = offset;
    samples.forEach((s, i) => {
      expect(Array.from(file.subarray(at, at + s.data.length))).toEqual(
        Array.from(s.data),
      );
      expect(file[at]).toBe(i + 1);
      at += s.data.length;
    });
    expect(at).toBe(file.length);
  });

  it("gives each picture its size, and every picture to the one chunk", () => {
    const stsz = find(tree, ...STBL, "stsz");
    expect(u32(file, stsz.start + 12)).toBe(0);
    expect(u32(file, stsz.start + 16)).toBe(4);
    expect([0, 1, 2, 3].map((i) => u32(file, stsz.start + 20 + 4 * i))).toEqual([
      500, 40, 30, 700,
    ]);
    const stsc = find(tree, ...STBL, "stsc");
    expect([1, 2, 3, 4].map((i) => u32(file, stsc.start + 8 + 4 * i))).toEqual([
      1, 1, 4, 1,
    ]);
  });

  it("marks the pictures a player can start from, counting from 1", () => {
    const stss = find(tree, ...STBL, "stss");
    expect(u32(file, stss.start + 12)).toBe(2);
    expect([u32(file, stss.start + 16), u32(file, stss.start + 20)]).toEqual([1, 4]);
  });

  it("lasts as long as its pictures, at 90 000 ticks a second", () => {
    const mvhd = find(tree, "moov", "mvhd");
    expect(u32(file, mvhd.start + 20)).toBe(90_000);
    expect(u32(file, mvhd.start + 24)).toBe(4 * 3000);
    const mdhd = find(tree, "moov", "trak", "mdia", "mdhd");
    expect(u32(file, mdhd.start + 20)).toBe(90_000);
    expect(u32(file, mdhd.start + 24)).toBe(4 * 3000);
    const stts = find(tree, ...STBL, "stts");
    // One run: four pictures of 3000 ticks.
    expect([12, 16, 20].map((at) => u32(file, stts.start + at))).toEqual([1, 4, 3000]);
  });

  it("says the picture's size and how to decode it", () => {
    const tkhd = find(tree, "moov", "trak", "tkhd");
    expect(u32(file, tkhd.start + 84)).toBe(1080 * 0x10000);
    expect(u32(file, tkhd.start + 88)).toBe(1920 * 0x10000);
    const avc1 = find(tree, ...STBL, "stsd", "avc1");
    expect([u16(file, avc1.start + 32), u16(file, avc1.start + 34)]).toEqual([
      1080, 1920,
    ]);
    const avcC = find(tree, ...STBL, "stsd", "avc1", "avcC");
    expect(Array.from(file.subarray(avcC.start + 8, avcC.start + avcC.size))).toEqual(
      Array.from(AVCC),
    );
    const hdlr = find(tree, "moov", "trak", "mdia", "hdlr");
    expect(
      String.fromCharCode(...file.subarray(hdlr.start + 16, hdlr.start + 20)),
    ).toBe("vide");
  });

  it("refuses a video with no pictures", () => {
    expect(() => mp4Of(track([]))).toThrow();
  });
});

describe("durationsOf", () => {
  it("lasts until the next picture, the last one a picture of fps", () => {
    const times = [0, 33_333, 100_000, 133_333];
    const samples = times.map((time) => ({
      data: new Uint8Array(1),
      time,
      key: false,
    }));
    expect(durationsOf(samples, 30)).toEqual([3000, 6000, 3000, 3000]);
  });

  it("never gives a picture no time", () => {
    const samples = [0, 0].map((time) => ({
      data: new Uint8Array(1),
      time,
      key: false,
    }));
    expect(durationsOf(samples, 30)).toEqual([1, 3000]);
  });
});

/** 12 s at 30 pictures a second, as the video always is. */
function twelveSeconds(): VideoTrack {
  const samples = Array.from({ length: 360 }, (_, i) => ({
    data: new Uint8Array(100 + (i % 7) * 13).fill(i % 251),
    time: Math.round((i * 1e6) / 30),
    key: i % 60 === 0,
  }));
  return track(samples);
}

describe("mp4Of without music", () => {
  it("makes the same file as before the music, byte for byte (TASK-295)", () => {
    // The hash of this video from mp4.ts as it was in main (bd4ccafc).
    const file = mp4Of(twelveSeconds());
    expect(file.length).toBe(52_065);
    expect(createHash("sha256").update(file).digest("hex")).toBe(
      "bc4f58dc306ab851ee749513182788e24f3819aef0f76a14cea9943a3ec16c1d",
    );
    expect(mp4Of(twelveSeconds(), undefined)).toEqual(file);
  });
});

const ESDS = Uint8Array.of(
  0,
  0,
  0,
  0,
  3,
  0x19,
  0,
  0,
  0,
  4,
  0x11,
  0x40,
  0x15,
  5,
  2,
  0x12,
  0x10,
);

/** 12 s of music at 44 100 a second after 2112 samples of priming: 519
 * packets of 1024 samples. */
function music(frames = 529_200): AudioTrack {
  return {
    rate: 44_100,
    channels: 2,
    esds: ESDS,
    packets: Array.from({ length: 519 }, (_, i) =>
      new Uint8Array(200 + (i % 5)).fill(i % 256),
    ),
    priming: 2112,
    frames,
  };
}

describe("mp4Of with music", () => {
  const video = twelveSeconds();
  const audio = music();
  const file = mp4Of(video, audio);
  const tree = boxes(file, 0, file.length);
  const moov = find(tree, "moov");
  const traks = moov.children.filter((b) => b.type === "trak");
  const sound = traks[1];
  const soundTable = () => find([sound], "trak", "mdia", "minf", "stbl");

  it("has a video track and a music track, the index first", () => {
    expect(tree.map((b) => b.type)).toEqual(["ftyp", "moov", "mdat"]);
    expect(traks).toHaveLength(2);
    const hdlrs = traks.map((t) => find([t], "trak", "mdia", "hdlr"));
    expect(
      hdlrs.map((h) =>
        String.fromCharCode(...file.subarray(h.start + 16, h.start + 20)),
      ),
    ).toEqual(["vide", "soun"]);
    const mvhd = find(tree, "moov", "mvhd");
    expect(u32(file, mvhd.start + 104)).toBe(3); // next_track_ID
  });

  it("keeps the video's track as it is without music", () => {
    const alone = mp4Of(video);
    const aloneTrak = find(boxes(alone, 0, alone.length), "moov", "trak");
    const offsetShift = moov.size - find(boxes(alone, 0, alone.length), "moov").size;
    const withMusic = Uint8Array.from(
      file.subarray(traks[0].start, traks[0].start + traks[0].size),
    );
    const stco = find(traks[0].children, "mdia", "minf", "stbl", "stco");
    const at = stco.start + 16 - traks[0].start;
    // The same bytes, but for where the pictures begin: the index is longer.
    expect(new DataView(withMusic.buffer).getUint32(at)).toBe(
      u32(alone, find(aloneTrak.children, "mdia", "minf", "stbl", "stco").start + 16) +
        offsetShift,
    );
    new DataView(withMusic.buffer).setUint32(
      at,
      u32(alone, find(aloneTrak.children, "mdia", "minf", "stbl", "stco").start + 16),
    );
    expect(Array.from(withMusic)).toEqual(
      Array.from(alone.subarray(aloneTrak.start, aloneTrak.start + aloneTrak.size)),
    );
  });

  it("lasts 12 s, the music as long as the pictures", () => {
    const mvhd = find(tree, "moov", "mvhd");
    expect(u32(file, mvhd.start + 24)).toBe(1_080_000);
    const videoHeader = find([traks[0]], "trak", "tkhd");
    const soundHeader = find([sound], "trak", "tkhd");
    expect(u32(file, videoHeader.start + 28)).toBe(1_080_000);
    expect(u32(file, soundHeader.start + 20)).toBe(2); // track_ID
    expect(u32(file, soundHeader.start + 28)).toBe(1_080_000);
    expect(u16(file, soundHeader.start + 44)).toBe(0x0100); // volume 1.0
  });

  it("starts the music with the first picture, after the encoder's priming", () => {
    const elst = find([sound], "trak", "edts", "elst");
    expect([8, 12, 16, 20].map((at) => u32(file, elst.start + at))).toEqual([
      0, 1, 1_080_000, 2112,
    ]);
    expect([u16(file, elst.start + 24), u16(file, elst.start + 26)]).toEqual([1, 0]);
    // The video has no edit: its first picture is at 0 too.
    expect(traks[0].children.map((b) => b.type)).not.toContain("edts");
  });

  it("says each packet decodes after the one before, as AVAssetWriter does", () => {
    const table = soundTable().children;
    expect(table.map((b) => b.type)).toEqual([
      "stsd",
      "sgpd",
      "sbgp",
      "stts",
      "stsc",
      "stsz",
      "stco",
    ]);
    const sgpd = find(table, "sgpd");
    expect(Array.from(file.subarray(sgpd.start, sgpd.start + sgpd.size))).toEqual([
      0,
      0,
      0,
      26,
      ...Array.from("sgpd", (c) => c.charCodeAt(0)),
      1,
      0,
      0,
      0,
      ...Array.from("roll", (c) => c.charCodeAt(0)),
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      1,
      0xff,
      0xff,
    ]);
    const sbgp = find(table, "sbgp");
    expect([16, 20, 24].map((at) => u32(file, sbgp.start + at))).toEqual([1, 519, 1]);
  });

  it("counts the music in its own samples, 1024 a packet", () => {
    const mdhd = find([sound], "trak", "mdia", "mdhd");
    expect(u32(file, mdhd.start + 20)).toBe(44_100);
    expect(u32(file, mdhd.start + 24)).toBe(519 * 1024);
    const stts = find(soundTable().children, "stts");
    expect([12, 16, 20].map((at) => u32(file, stts.start + at))).toEqual([
      1, 519, 1024,
    ]);
    const smhd = find([sound], "trak", "mdia", "minf", "smhd");
    expect(smhd.size).toBe(16);
  });

  it("says how to decode the music: AAC, two channels, its esds", () => {
    const mp4a = find(soundTable().children, "stsd", "mp4a");
    expect(u16(file, mp4a.start + 24)).toBe(2);
    expect(u16(file, mp4a.start + 26)).toBe(16);
    expect(u32(file, mp4a.start + 32)).toBe(44_100 * 0x10000);
    const esds = find(soundTable().children, "stsd", "mp4a", "esds");
    expect(Array.from(file.subarray(esds.start + 8, esds.start + esds.size))).toEqual(
      Array.from(ESDS),
    );
  });

  it("puts the packets in one chunk after the pictures, to the end of the file", () => {
    const stsz = find(soundTable().children, "stsz");
    expect(u32(file, stsz.start + 16)).toBe(519);
    expect(u32(file, stsz.start + 20)).toBe(200);
    expect(u32(file, stsz.start + 24)).toBe(201);
    const stsc = find(soundTable().children, "stsc");
    expect([1, 2, 3, 4].map((i) => u32(file, stsc.start + 8 + 4 * i))).toEqual([
      1, 1, 519, 1,
    ]);
    const stco = find(soundTable().children, "stco");
    const offset = u32(file, stco.start + 16);
    const pictures = video.samples.reduce((sum, s) => sum + s.data.length, 0);
    const mdat = find(tree, "mdat");
    expect(offset).toBe(mdat.start + 8 + pictures);
    let at = offset;
    for (const packet of audio.packets) {
      expect(file[at]).toBe(packet[0]);
      at += packet.length;
    }
    expect(at).toBe(file.length);
  });
});

describe("musicDuration", () => {
  it("is the video's when the music is as long or longer", () => {
    expect(musicDuration(music(), 1_080_000)).toBe(1_080_000);
    expect(musicDuration(music(600_000), 1_080_000)).toBe(1_080_000);
  });

  it("is the music's when the music is shorter", () => {
    expect(musicDuration(music(44_100), 1_080_000)).toBe(90_000);
  });
});
