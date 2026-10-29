import type { Activity } from "@shaperoute/shared-types";

import { type FilePoint, type FileTrack, positionOf } from "./fileTrack";

/**
 * A FIT file (TASK-312), the binary format of Garmin, Coros, Wahoo, Suunto
 * and Polar watches: read from the FIT protocol (the Garmin FIT SDK's
 * «Flexible and Interoperable Data Transfer»), without its SDK. Of all it
 * holds only the `record` messages (their `timestamp`, `position_lat` and
 * `position_long`) and the sport of the `session` or `sport` message are
 * read; the rest is skipped by the sizes its definitions give. A file cut
 * short (a watch that stopped mid-write) gives what came before the cut.
 */

/** 1989-12-31T00:00:00Z, the FIT clock's zero, in Unix milliseconds. */
const FIT_EPOCH_MS = 631_065_600_000;

/** A FIT position is in semicircles: 2^31 of them make 180 degrees. */
const DEGREES_PER_SEMICIRCLE = 180 / 2 ** 31;

/** The global message numbers read (FIT SDK Profile, «mesg_num»). */
const SPORT = 12;
const SESSION = 18;
const RECORD = 20;

/** The field numbers read: the timestamp of any message, the record's
 * position, the sport of «sport» (0) and of «session» (5). */
const TIMESTAMP = 253;
const POSITION_LAT = 0;
const POSITION_LONG = 1;
const SPORT_OF_SPORT = 0;
const SPORT_OF_SESSION = 5;

/** The «invalid» values of the base types read. */
const INVALID_SINT32 = 0x7fffffff;
const INVALID_UINT32 = 0xffffffff;
const INVALID_ENUM = 0xff;

/** A time under this is seconds since the device was switched on, not a
 * date (FIT SDK, «date_time»). */
const MIN_DATE = 0x10000000;

/** The FIT «sport» values that are one of MuW's sports. */
const SPORTS: ReadonlyMap<number, Activity> = new Map([
  [1, "running"],
  [2, "cycling"],
  [19, "paddling"],
  [21, "cycling"], // e_biking
  [37, "paddling"], // stand_up_paddleboarding
  [41, "paddling"], // kayaking
]);

type Field = { num: number; size: number; at: number };

type Definition = {
  global: number;
  little: boolean;
  fields: Field[];
  /** Bytes of a data message of this kind, developer fields included. */
  size: number;
};

/** Whether `bytes` begin as a FIT file: «.FIT» after the header's size,
 * protocol, profile and data size. */
export function isFit(bytes: Uint8Array): boolean {
  return isFitAt(bytes, 0);
}

function isFitAt(bytes: Uint8Array, at: number): boolean {
  return (
    at + 12 <= bytes.length &&
    bytes[at] >= 12 &&
    bytes[at + 8] === 0x2e && // .
    bytes[at + 9] === 0x46 && // F
    bytes[at + 10] === 0x49 && // I
    bytes[at + 11] === 0x54 // T
  );
}

/** What the reading has gathered so far. */
type Reading = {
  view: DataView;
  bytes: Uint8Array;
  points: FilePoint[];
  /** The last full timestamp, for the headers that carry only its low
   * bits. */
  lastTime: number | null;
  sessionSport: number | null;
  sportSport: number | null;
};

export function readFit(bytes: Uint8Array): FileTrack {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reading: Reading = {
    view,
    bytes,
    points: [],
    lastTime: null,
    sessionSport: null,
    sportSport: null,
  };
  // Several FIT files may follow one another in one file («chained»).
  let at = 0;
  while (isFitAt(bytes, at)) {
    const headerSize = bytes[at];
    const dataSize = view.getUint32(at + 4, true);
    const start = at + headerSize;
    const end = Math.min(bytes.length, start + dataSize);
    readMessages(reading, start, end);
    // The two bytes of the CRC after the data.
    at = end + 2;
  }
  const sport = reading.sessionSport ?? reading.sportSport;
  return {
    points: reading.points,
    sport: sport === null ? null : (SPORTS.get(sport) ?? null),
  };
}

/** The messages between `start` and `end`, until the end or a cut. */
function readMessages(reading: Reading, start: number, end: number) {
  const { bytes, view } = reading;
  const definitions: (Definition | undefined)[] = [];
  reading.lastTime = null;
  let next = start;
  while (next < end) {
    const header = bytes[next];
    next += 1;
    if ((header & 0x80) !== 0) {
      // A data message with a compressed timestamp: 5 bits of seconds over
      // the last full time.
      const definition = definitions[(header >> 5) & 0x03];
      if (definition === undefined || next + definition.size > end) {
        return;
      }
      let time: number | null = null;
      const last: number | null = reading.lastTime;
      if (last !== null) {
        const offset: number = header & 0x1f;
        const low: number = last % 32;
        time = last - low + offset + (offset < low ? 32 : 0);
        reading.lastTime = time;
      }
      readMessage(reading, definition, next, time);
      next += definition.size;
    } else if ((header & 0x40) !== 0) {
      // A definition: how the data messages of this local kind are laid out.
      if (next + 5 > end) {
        return;
      }
      const little = bytes[next + 1] === 0;
      const global = view.getUint16(next + 2, little);
      const count = bytes[next + 4];
      next += 5;
      if (next + count * 3 > end) {
        return;
      }
      const fields: Field[] = [];
      let size = 0;
      for (let i = 0; i < count; i += 1) {
        const fieldSize = bytes[next + 1];
        fields.push({ num: bytes[next], size: fieldSize, at: size });
        size += fieldSize;
        next += 3;
      }
      if ((header & 0x20) !== 0) {
        // Developer fields: only their sizes matter here.
        const devCount = next < end ? bytes[next] : 0;
        next += 1;
        for (let i = 0; i < devCount && next + 3 <= end; i += 1) {
          size += bytes[next + 1];
          next += 3;
        }
      }
      definitions[header & 0x0f] = { global, little, fields, size };
    } else {
      const definition = definitions[header & 0x0f];
      if (definition === undefined || next + definition.size > end) {
        return;
      }
      readMessage(reading, definition, next, null);
      next += definition.size;
    }
  }
}

/** One data message at `from`; `compressed`, the time of its header. */
function readMessage(
  reading: Reading,
  definition: Definition,
  from: number,
  compressed: number | null,
) {
  const { bytes, view } = reading;
  const fieldOf = (num: number, size: number): Field | null =>
    definition.fields.find((field) => field.num === num && field.size === size) ?? null;
  const uint32 = (num: number): number | null => {
    const field = fieldOf(num, 4);
    const value =
      field === null ? null : view.getUint32(from + field.at, definition.little);
    return value === INVALID_UINT32 ? null : value;
  };
  const sint32 = (num: number): number | null => {
    const field = fieldOf(num, 4);
    const value =
      field === null ? null : view.getInt32(from + field.at, definition.little);
    return value === INVALID_SINT32 ? null : value;
  };
  const enumOf = (num: number): number | null => {
    const field = fieldOf(num, 1);
    const value = field === null ? null : bytes[from + field.at];
    return value === INVALID_ENUM ? null : value;
  };
  // Any message may carry the full time.
  const stamped = uint32(TIMESTAMP);
  if (stamped !== null) {
    reading.lastTime = stamped;
  }
  switch (definition.global) {
    case RECORD: {
      const seconds = stamped ?? compressed;
      const lat = sint32(POSITION_LAT);
      const lon = sint32(POSITION_LONG);
      reading.points.push({
        point:
          lat === null || lon === null
            ? null
            : positionOf(lat * DEGREES_PER_SEMICIRCLE, lon * DEGREES_PER_SEMICIRCLE),
        timeMs:
          seconds === null || seconds < MIN_DATE ? null : FIT_EPOCH_MS + seconds * 1000,
      });
      return;
    }
    case SESSION:
      reading.sessionSport ??= enumOf(SPORT_OF_SESSION);
      return;
    case SPORT:
      reading.sportSport ??= enumOf(SPORT_OF_SPORT);
      return;
    default:
      return;
  }
}
