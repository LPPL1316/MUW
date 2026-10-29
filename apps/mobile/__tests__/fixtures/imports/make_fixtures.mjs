/**
 * The files of other apps that the readers of TASK-312 are tested on, made
 * again with:
 *
 *     node apps/mobile/__tests__/fixtures/imports/make_fixtures.mjs
 *
 * Each is small and laid out as the app it stands for exports it: a run
 * from Strava (GPX), a ride from Garmin Connect (TCX), a run from a Garmin
 * watch (FIT, with a developer field, a big-endian definition and
 * compressed timestamps, as watches write them), a route from Komoot (GPX
 * without times) and a treadmill run (TCX without positions). The tracks
 * are made up, by formula: no person's activity is in the repository. The
 * output is the same at every run.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** A loop of `count` points around `centre`, `radius` metres wide. */
function loop([lat, lon], radius, count) {
  const metresPerDegree = 111_320;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    const r = radius * (1 + 0.15 * Math.sin(3 * angle));
    return [
      Number((lat + (r * Math.sin(angle)) / metresPerDegree).toFixed(7)),
      Number(
        (
          lon +
          (r * Math.cos(angle)) / (metresPerDegree * Math.cos((lat * Math.PI) / 180))
        ).toFixed(7),
      ),
    ];
  });
}

/** Seconds after the start of each point: every `step`, with one stop of
 * `stop` seconds after the point `stopAfter`. */
function times(count, step, stopAfter, stop) {
  return Array.from({ length: count }, (_, i) => i * step + (i > stopAfter ? stop : 0));
}

function iso(ms, fraction = false) {
  const text = new Date(ms).toISOString();
  return fraction ? text : text.replace(".000Z", "Z");
}

// A run from Strava: «Export GPX» of an activity, Trento, 12 April 2025.
function stravaGpx() {
  const start = Date.UTC(2025, 3, 12, 6, 31, 5);
  const points = loop([46.067, 11.1213], 220, 40);
  const seconds = times(points.length, 10, 19, 95);
  const trkpts = points
    .map(
      ([lat, lon], i) => `   <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">
    <ele>${(194 + 3 * Math.sin(i / 4)).toFixed(1)}</ele>
    <time>${iso(start + seconds[i] * 1000)}</time>
    <extensions>
     <gpxtpx:TrackPointExtension>
      <gpxtpx:hr>${118 + (i % 9)}</gpxtpx:hr>
     </gpxtpx:TrackPointExtension>
    </extensions>
   </trkpt>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www.garmin.com/xmlschemas/GpxExtensionsv3.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3">
 <metadata>
  <time>${iso(start)}</time>
 </metadata>
 <trk>
  <name>Morning Run</name>
  <type>running</type>
  <trkseg>
${trkpts}
  </trkseg>
 </trk>
</gpx>
`;
}

// A ride from Garmin Connect: «Export to TCX», Levico, 3 May 2025. The
// first trackpoint has no position yet, as Garmin's often do.
function garminTcx() {
  const start = Date.UTC(2025, 4, 3, 7, 2, 11);
  const points = loop([46.0108, 11.3035], 900, 36);
  const seconds = times(points.length, 20, 17, 0);
  const first = `          <Trackpoint>
            <Time>${iso(start - 3000, true)}</Time>
            <AltitudeMeters>440.0</AltitudeMeters>
            <DistanceMeters>0.0</DistanceMeters>
          </Trackpoint>`;
  const trackpoints = points
    .map(
      ([lat, lon], i) => `          <Trackpoint>
            <Time>${iso(start + seconds[i] * 1000, true)}</Time>
            <Position>
              <LatitudeDegrees>${lat}</LatitudeDegrees>
              <LongitudeDegrees>${lon}</LongitudeDegrees>
            </Position>
            <AltitudeMeters>${(440 + 6 * Math.sin(i / 5)).toFixed(1)}</AltitudeMeters>
            <DistanceMeters>${(i * 157.1).toFixed(1)}</DistanceMeters>
            <HeartRateBpm>
              <Value>${131 + (i % 7)}</Value>
            </HeartRateBpm>
            <Extensions>
              <ns3:TPX>
                <ns3:Speed>${(7.2 + (i % 3) / 10).toFixed(3)}</ns3:Speed>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns:ns5="http://www.garmin.com/xmlschemas/ActivityGoals/v1"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ns4="http://www.garmin.com/xmlschemas/ProfileExtension/v1">
  <Activities>
    <Activity Sport="Biking">
      <Id>${iso(start, true)}</Id>
      <Lap StartTime="${iso(start, true)}">
        <TotalTimeSeconds>${seconds[seconds.length - 1]}.0</TotalTimeSeconds>
        <DistanceMeters>5498.5</DistanceMeters>
        <MaximumSpeed>8.1</MaximumSpeed>
        <Calories>162</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${first}
${trackpoints}
        </Track>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>Edge 540</Name>
        <UnitId>3456789012</UnitId>
        <ProductID>4061</ProductID>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}

// A route from Komoot: «Download GPX» of a planned tour, no times.
function komootRoute() {
  const points = loop([46.067, 11.1213], 400, 12);
  const rtepts = points
    .map(
      ([lat, lon]) =>
        `    <rtept lat="${lat}" lon="${lon}">\n      <ele>195.0</ele>\n    </rtept>`,
    )
    .join("\n");
  return `<?xml version='1.0' encoding='UTF-8'?>
<gpx version="1.1" creator="https://www.komoot.de" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Giro di Trento</name>
    <author>
      <link href="https://www.komoot.de">
        <text>komoot</text>
        <type>text/html</type>
      </link>
    </author>
  </metadata>
  <rte>
    <name>Giro di Trento</name>
${rtepts}
  </rte>
</gpx>
`;
}

// A treadmill run from Garmin Connect: times, no positions.
function treadmillTcx() {
  const start = Date.UTC(2025, 0, 20, 18, 0, 0);
  const trackpoints = Array.from(
    { length: 6 },
    (_, i) => `          <Trackpoint>
            <Time>${iso(start + i * 60_000, true)}</Time>
            <DistanceMeters>${i * 170}.0</DistanceMeters>
          </Trackpoint>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>${iso(start, true)}</Id>
      <Lap StartTime="${iso(start, true)}">
        <Track>
${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}

// ---- FIT -------------------------------------------------------------

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00,
  0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

/** The FIT CRC-16 of `bytes` (FIT SDK, «File Header»). */
function fitCrc(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc;
}

const FIT_EPOCH_S = 631_065_600;
const SEMICIRCLES = 2 ** 31 / 180;

/** Bytes of a value of `size` bytes, little or big endian. */
function int(value, size, little = true, signed = false) {
  const buffer = new DataView(new ArrayBuffer(size));
  if (size === 1) {
    buffer.setUint8(0, value);
  } else if (size === 2) {
    buffer.setUint16(0, value, little);
  } else if (signed) {
    buffer.setInt32(0, value, little);
  } else {
    buffer.setUint32(0, value, little);
  }
  return [...new Uint8Array(buffer.buffer)];
}

function text(value, size) {
  const bytes = [...Buffer.from(value, "utf8")].slice(0, size - 1);
  return [...bytes, ...Array(size - bytes.length).fill(0)];
}

/** A definition message: [field number, size, base type] for each field,
 * and [field number, size, developer index] for each developer field. */
function definition(local, global, fields, { little = true, developer = [] } = {}) {
  const header = 0x40 | (developer.length > 0 ? 0x20 : 0) | local;
  return [
    header,
    0,
    little ? 0 : 1,
    ...int(global, 2, little),
    fields.length,
    ...fields.flat(),
    ...(developer.length > 0 ? [developer.length, ...developer.flat()] : []),
  ];
}

// A run from a Garmin watch, Rovereto, 7 June 2025: the activity file as
// the watch writes it, cut to its first six minutes of records and a stop.
function garminFit() {
  const start = Date.UTC(2025, 5, 7, 5, 48, 20) / 1000 - FIT_EPOCH_S;
  const points = loop([45.8906, 11.04], 160, 30);
  const data = [];
  // file_id: an activity (4) by Garmin (1).
  data.push(
    ...definition(0, 0, [
      [0, 1, 0x00],
      [1, 2, 0x84],
      [2, 2, 0x84],
      [3, 4, 0x8c],
      [4, 4, 0x86],
    ]),
    0x00,
    4,
    ...int(1, 2),
    ...int(3121, 2),
    ...int(3_412_345_678, 4),
    ...int(start, 4),
  );
  // developer_data_id and field_description: one developer field, a
  // power meter's «Form Power», as Stryd writes it.
  data.push(
    ...definition(3, 207, [
      [3, 1, 0x02],
      [1, 16, 0x0d],
    ]),
    0x03,
    0,
    ...Array.from({ length: 16 }, (_, i) => (i * 17) & 0xff),
    ...definition(3, 206, [
      [0, 1, 0x02],
      [1, 1, 0x02],
      [2, 1, 0x02],
      [3, 16, 0x07],
    ]),
    0x03,
    0,
    0,
    0x84,
    ...text("Form Power", 16),
  );
  // record, little endian: timestamp, position, heart rate, distance, and
  // the developer field.
  data.push(
    ...definition(
      1,
      20,
      [
        [253, 4, 0x86],
        [0, 4, 0x85],
        [1, 4, 0x85],
        [3, 1, 0x02],
        [5, 4, 0x86],
      ],
      { developer: [[0, 2, 0]] },
    ),
  );
  const record = (seconds, point, i) => [
    0x01,
    ...int(start + seconds, 4),
    ...(point === null
      ? [...int(0x7fffffff, 4, true, true), ...int(0x7fffffff, 4, true, true)]
      : [
          ...int(Math.round(point[0] * SEMICIRCLES), 4, true, true),
          ...int(Math.round(point[1] * SEMICIRCLES), 4, true, true),
        ]),
    120 + (i % 10),
    ...int(i * 1680, 4),
    ...int(80 + i, 2),
  ];
  // The first record, before the watch has a fix.
  data.push(...record(0, null, 0));
  // record again, big endian and without a timestamp: the watch writes
  // these with a compressed timestamp header, the low 5 bits of the time.
  data.push(
    ...definition(
      2,
      20,
      [
        [0, 4, 0x85],
        [1, 4, 0x85],
        [3, 1, 0x02],
      ],
      { little: false },
    ),
  );
  let seconds = 0;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (i === 0 || i === 20) {
      // A full timestamp: the first, and after the stop of 70 s, which the
      // 5 bits of a compressed header cannot hold.
      seconds += i === 0 ? 1 : 70;
      data.push(...record(seconds, point, i));
      continue;
    }
    seconds += 10;
    data.push(
      0x80 | (2 << 5) | ((start + seconds) & 0x1f),
      ...int(Math.round(point[0] * SEMICIRCLES), 4, false, true),
      ...int(Math.round(point[1] * SEMICIRCLES), 4, false, true),
      125 + (i % 5),
    );
  }
  // sport: running (1), generic (0), «Run».
  data.push(
    ...definition(4, 12, [
      [0, 1, 0x00],
      [1, 1, 0x00],
      [3, 8, 0x07],
    ]),
    0x04,
    1,
    0,
    ...text("Run", 8),
  );
  // session: its time, start, sport, sub sport, elapsed time, distance.
  data.push(
    ...definition(5, 18, [
      [253, 4, 0x86],
      [2, 4, 0x86],
      [5, 1, 0x00],
      [6, 1, 0x00],
      [7, 4, 0x86],
      [9, 4, 0x86],
    ]),
    0x05,
    ...int(start + seconds, 4),
    ...int(start, 4),
    1,
    0,
    ...int(seconds * 1000, 4),
    ...int(points.length * 1680, 4),
  );
  const header = [
    14,
    0x20,
    ...int(2132, 2),
    ...int(data.length, 4),
    ...text(".FIT", 5).slice(0, 4),
  ];
  const withCrc = [...header, ...int(fitCrc(header), 2)];
  const file = [...withCrc, ...data];
  return Uint8Array.from([...file, ...int(fitCrc(file), 2)]);
}

const FILES = {
  "strava-run.gpx": stravaGpx(),
  "garmin-ride.tcx": garminTcx(),
  "komoot-route.gpx": komootRoute(),
  "treadmill.tcx": treadmillTcx(),
  "garmin-run.fit": garminFit(),
};

for (const [name, content] of Object.entries(FILES)) {
  writeFileSync(join(HERE, name), content);
}
