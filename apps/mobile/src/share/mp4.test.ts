import { durationsOf, mp4Of, type VideoSample, type VideoTrack } from "./mp4";

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
