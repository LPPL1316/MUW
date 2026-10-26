/**
 * Reads one of the video's music tracks (TASK-301, ADR-0262): an M4A of one
 * AAC track, as `tools/video_music.py` writes it. What comes out goes into
 * the video's file as its second track (mp4.ts): the decoder's
 * configuration, the encoded packets, and the encoder's priming that the
 * edit list leaves out.
 */

/** One AAC track, as the video's file takes it. */
export type AudioTrack = {
  /** Samples a second: the clock of the track. */
  rate: number;
  channels: number;
  /** The inside of the `esds` box: the decoder's configuration. */
  esds: Uint8Array;
  /** The encoded packets, each of 1024 samples. */
  packets: readonly Uint8Array[];
  /** The samples the encoder put before the sound, to be left out. */
  priming: number;
  /** The samples of sound after the priming. */
  frames: number;
};

/** Samples in one AAC packet. */
export const AAC_PACKET = 1024;

type Found = { start: number; end: number };

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** The box of `type` among those from `start` to `end`: where its inside
 * starts and ends. Throws when there is none. */
function child(bytes: Uint8Array, start: number, end: number, type: string): Found {
  const data = view(bytes);
  let at = start;
  while (at + 8 <= end) {
    const size = data.getUint32(at);
    if (size < 8 || at + size > end) {
      throw new Error("a broken box");
    }
    if (String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === type) {
      return { start: at + 8, end: at + size };
    }
    at += size;
  }
  throw new Error(`no ${type}`);
}

function path(bytes: Uint8Array, ...types: string[]): Found {
  let found: Found = { start: 0, end: bytes.length };
  for (const type of types) {
    found = child(bytes, found.start, found.end, type);
  }
  return found;
}

const STBL = ["moov", "trak", "mdia", "minf", "stbl"];

/** The music track of an M4A file; throws on a file that is not one AAC
 * track with an edit list. */
export function audioTrackOf(bytes: Uint8Array): AudioTrack {
  const data = view(bytes);
  const movieScale = data.getUint32(path(bytes, "moov", "mvhd").start + 12);
  const mdhd = path(bytes, "moov", "trak", "mdia", "mdhd").start;
  const rate = data.getUint32(mdhd + 12);
  const elst = path(bytes, "moov", "trak", "edts", "elst").start;
  if (data.getUint32(elst + 4) !== 1) {
    throw new Error("one edit only");
  }
  const segment = data.getUint32(elst + 8);
  const priming = data.getInt32(elst + 12);
  const stsd = path(bytes, ...STBL, "stsd");
  const entry = stsd.start + 8;
  if (String.fromCharCode(...bytes.subarray(entry + 4, entry + 8)) !== "mp4a") {
    throw new Error("not AAC");
  }
  const channels = data.getUint16(entry + 24);
  const esds = child(bytes, entry + 36, entry + data.getUint32(entry), "esds");

  const stts = path(bytes, ...STBL, "stts").start;
  for (let run = 0; run < data.getUint32(stts + 4); run += 1) {
    if (data.getUint32(stts + 12 + 8 * run) !== AAC_PACKET) {
      throw new Error("packets of another length");
    }
  }
  const stsz = path(bytes, ...STBL, "stsz").start;
  const count = data.getUint32(stsz + 8);
  const sizes = Array.from({ length: count }, (_, i) =>
    data.getUint32(stsz + 12 + 4 * i),
  );
  const stco = path(bytes, ...STBL, "stco").start;
  const chunks = data.getUint32(stco + 4);
  const stsc = path(bytes, ...STBL, "stsc").start;
  const runs = data.getUint32(stsc + 4);
  const packets: Uint8Array[] = [];
  for (let run = 0; run < runs; run += 1) {
    const first = data.getUint32(stsc + 8 + 12 * run);
    const last = run + 1 < runs ? data.getUint32(stsc + 20 + 12 * run) : chunks + 1;
    const perChunk = data.getUint32(stsc + 12 + 12 * run);
    for (let chunk = first; chunk < last; chunk += 1) {
      let at = data.getUint32(stco + 8 + 4 * (chunk - 1));
      for (let k = 0; k < perChunk; k += 1) {
        const size = sizes[packets.length];
        if (size === undefined || at + size > bytes.length) {
          throw new Error("a packet out of the file");
        }
        packets.push(bytes.subarray(at, at + size));
        at += size;
      }
    }
  }
  if (packets.length !== count) {
    throw new Error("packets missing");
  }
  return {
    rate,
    channels,
    esds: bytes.slice(esds.start, esds.end),
    packets,
    priming,
    frames: Math.round((segment * rate) / movieScale),
  };
}
