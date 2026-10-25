/**
 * An MP4 file of one H.264 video track, made from the pieces the WebView's
 * encoder gives (TASK-295, ADR-0254): the decoder's configuration (the
 * `avcC` record) and one encoded picture after the other, each with its
 * time. No sound. The index (`moov`) comes before the pictures (`mdat`), so
 * a player starts before reading the whole file.
 *
 * Only what one video track needs: every picture in one chunk, decoded in
 * the order it is shown (no B-frames: the encoder makes Baseline H.264).
 */

/** One encoded picture, as the encoder gave it. */
export type VideoSample = {
  data: Uint8Array;
  /** When it shows, in microseconds from the start (WebCodecs' unit). */
  time: number;
  /** Whether it decodes alone: a player can start here. */
  key: boolean;
};

export type VideoTrack = {
  width: number;
  height: number;
  /** Pictures a second: the last picture lasts one of these. */
  fps: number;
  /** The AVCDecoderConfigurationRecord, the encoder's `description`. */
  avcC: Uint8Array;
  samples: readonly VideoSample[];
};

/** The clock of the file: ticks a second. */
const TIMESCALE = 90_000;

/** The largest a box can be with a 32-bit size. */
const MAX_BOX = 0xffff_ffff;

function u8(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff);
}

function u16(value: number): Uint8Array {
  return Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  );
}

function zeros(count: number): Uint8Array {
  return new Uint8Array(count);
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

function joined(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A box: its size, its four letters, what it holds. */
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const body = joined(parts);
  if (body.length + 8 > MAX_BOX) {
    throw new Error("the video is too large for one file");
  }
  return joined([u32(body.length + 8), ascii(type), body]);
}

/** A box with a version and flags before what it holds. */
function fullBox(
  type: string,
  version: number,
  flags: number,
  ...parts: Uint8Array[]
): Uint8Array {
  return box(type, u8(version), u8(flags >>> 16), u16(flags & 0xffff), ...parts);
}

/** The matrix that leaves the picture as it is. */
const IDENTITY = joined(
  [0x0001_0000, 0, 0, 0, 0x0001_0000, 0, 0, 0, 0x4000_0000].map(u32),
);

/** A size in 16.16 fixed point. */
function fixed(value: number): Uint8Array {
  return u32(Math.round(value * 0x1_0000));
}

/** How long each picture shows, in ticks: until the next one, the last one
 * a picture of `fps`. Never less than one tick. */
export function durationsOf(samples: readonly VideoSample[], fps: number): number[] {
  const ticks = samples.map((sample) => Math.round((sample.time * TIMESCALE) / 1e6));
  const last = Math.round(TIMESCALE / fps);
  return ticks.map((tick, i) =>
    i + 1 < ticks.length ? Math.max(1, ticks[i + 1] - tick) : last,
  );
}

/** Time to sample: runs of pictures that last the same. */
function stts(durations: readonly number[]): Uint8Array {
  const runs: [number, number][] = [];
  for (const duration of durations) {
    const run = runs[runs.length - 1];
    if (run !== undefined && run[1] === duration) {
      run[0] += 1;
    } else {
      runs.push([1, duration]);
    }
  }
  return fullBox(
    "stts",
    0,
    0,
    u32(runs.length),
    ...runs.flatMap(([count, duration]) => [u32(count), u32(duration)]),
  );
}

/** The sample entry: how to decode the pictures. */
function avc1(track: VideoTrack): Uint8Array {
  return box(
    "avc1",
    zeros(6),
    u16(1), // data_reference_index
    zeros(16), // pre_defined, reserved
    u16(track.width),
    u16(track.height),
    u32(0x0048_0000), // 72 dpi across
    u32(0x0048_0000), // and down
    zeros(4),
    u16(1), // frame_count
    zeros(32), // compressorname
    u16(0x0018), // depth: colour, no alpha
    u16(0xffff), // pre_defined: -1
    box("avcC", track.avcC),
  );
}

function sampleTable(track: VideoTrack, durations: readonly number[], offset: number) {
  const { samples } = track;
  const keys = samples.flatMap((sample, i) => (sample.key ? [i + 1] : []));
  return box(
    "stbl",
    fullBox("stsd", 0, 0, u32(1), avc1(track)),
    stts(durations),
    fullBox("stss", 0, 0, u32(keys.length), ...keys.map(u32)),
    // Every picture in chunk 1.
    fullBox("stsc", 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
    fullBox(
      "stsz",
      0,
      0,
      u32(0),
      u32(samples.length),
      ...samples.map((sample) => u32(sample.data.length)),
    ),
    fullBox("stco", 0, 0, u32(1), u32(offset)),
  );
}

/** The index of the file, with the pictures' chunk at `offset`. */
function moov(track: VideoTrack, durations: readonly number[], offset: number) {
  const duration = durations.reduce((sum, d) => sum + d, 0);
  return box(
    "moov",
    fullBox(
      "mvhd",
      0,
      0,
      zeros(8), // created, modified
      u32(TIMESCALE),
      u32(duration),
      u32(0x0001_0000), // rate 1.0
      u16(0x0100), // volume 1.0
      zeros(10),
      IDENTITY,
      zeros(24),
      u32(2), // next_track_ID
    ),
    box(
      "trak",
      fullBox(
        "tkhd",
        0,
        0x3, // enabled, in the movie
        zeros(8),
        u32(1), // track_ID
        zeros(4),
        u32(duration),
        zeros(8),
        u16(0), // layer
        u16(0), // alternate_group
        u16(0), // volume: a video has none
        zeros(2),
        IDENTITY,
        fixed(track.width),
        fixed(track.height),
      ),
      box(
        "mdia",
        fullBox(
          "mdhd",
          0,
          0,
          zeros(8),
          u32(TIMESCALE),
          u32(duration),
          u16(0x55c4), // language "und"
          u16(0),
        ),
        fullBox("hdlr", 0, 0, zeros(4), ascii("vide"), zeros(12), ascii("Video\0")),
        box(
          "minf",
          fullBox("vmhd", 0, 1, zeros(8)),
          box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))),
          sampleTable(track, durations, offset),
        ),
      ),
    ),
  );
}

/** The whole file. Throws on a track with no pictures. */
export function mp4Of(track: VideoTrack): Uint8Array {
  if (track.samples.length === 0) {
    throw new Error("a video needs at least one picture");
  }
  const durations = durationsOf(track.samples, track.fps);
  const ftyp = box(
    "ftyp",
    ascii("isom"),
    u32(0x200),
    ascii("isom"),
    ascii("iso2"),
    ascii("avc1"),
    ascii("mp41"),
  );
  // The index has the same size wherever the pictures go: made once to
  // learn it, then again with the right place.
  const size = moov(track, durations, 0).length;
  const offset = ftyp.length + size + 8;
  const mdat = box("mdat", ...track.samples.map((sample) => sample.data));
  return joined([ftyp, moov(track, durations, offset), mdat]);
}
