import { act, renderHook } from "@testing-library/react-native";

import type { PositionState } from "../location/useCurrentPosition";
import { PhoneEngine } from "./phoneEngine";
import { files } from "./memoryFiles";
import { networksInOrder, usePhoneZones } from "./usePhoneZones";
import {
  AROUND_MARGIN_M,
  type downloadZone,
  type ZoneDownload,
  zoneUri,
} from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ createDownloadResumable: jest.fn() }));

// The round of zones ahead (part B2), tested in aheadZones.test.ts.
const noAhead = jest.fn(async () => "done" as const);

// The shapes on the water ahead (TASK-246), tested in aheadExamples.test.ts.
const noShapes = jest.fn(async () => "done" as const);

beforeEach(() => {
  files.clear();
  noAhead.mockClear();
  noShapes.mockClear();
});

const HERE: PositionState = { status: "ok", point: [46.0679, 11.1211] };
const TRENTO = "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz";
const TRENTO_WIDE = "foot_45.90000_10.90000_46.25000_11.35000.zone.json.gz";
const TRENTO_BIKE = "bike_45.94940_10.95710_46.18350_11.29440.zone.json.gz";
const SAVED: ZoneDownload = {
  kind: "saved",
  zone: {
    name: "foot_1.00000_2.00000_3.00000_4.00000.zone.json.gz",
    etag: null,
    bytes: 1,
    usedAt: 0,
  },
};

test("the network of the chosen sport comes first", () => {
  expect(networksInOrder("foot")).toEqual(["foot", "bike"]);
  expect(networksInOrder("bike")).toEqual(["bike", "foot"]);
});

test("once the position is known, both zones are asked, once, then Python starts", async () => {
  const engine = new PhoneEngine();
  const warmUp = jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  const download = jest.fn(async (): Promise<ZoneDownload> => SAVED);
  const { rerender } = await renderHook(
    ({ position }: { position: PositionState }) =>
      usePhoneZones(position, "https://api", {
        engine,
        download,
        ahead: noAhead,
        shapes: noShapes,
      }),
    { initialProps: { position: { status: "loading" } as PositionState } },
  );
  expect(download).not.toHaveBeenCalled();
  await act(async () => {
    await rerender({ position: HERE });
  });
  expect(download.mock.calls.map((call) => call.slice(0, 3))).toEqual([
    ["https://api", "foot", HERE.point],
    ["https://api", "bike", HERE.point],
  ]);
  expect(warmUp).toHaveBeenCalledTimes(1);
  // Then the zones ahead, on the network of the sport, as the zones around.
  expect(noAhead.mock.calls).toEqual([
    ["https://api", HERE.point, "foot", { download }],
  ]);
  await act(async () => {
    await rerender({ position: { status: "ok", point: [45, 11] } });
  });
  expect(download).toHaveBeenCalledTimes(2);
  expect(noAhead).toHaveBeenCalledTimes(1);
  // And the shapes on the water near the phone (TASK-246), once.
  expect(noShapes.mock.calls).toEqual([["https://api", HERE.point]]);
});

test("no zone around the phone, and none saved: Python waits for a route", async () => {
  const engine = new PhoneEngine();
  const warmUp = jest.spyOn(engine, "warmUp");
  const download = jest.fn(async (): Promise<ZoneDownload> => ({ kind: "none" }));
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine,
        download,
        ahead: noAhead,
        shapes: noShapes,
      }),
    );
  });
  expect(download).toHaveBeenCalledTimes(2);
  expect(warmUp).not.toHaveBeenCalled();
  // A server without zones here, or one that does not answer: no city ahead.
  expect(noAhead).not.toHaveBeenCalled();
  // The shapes on the water are routes, not zones: asked all the same.
  expect(noShapes).toHaveBeenCalledTimes(1);
});

test("without an API address nothing is downloaded", async () => {
  const download = jest.fn(async (): Promise<ZoneDownload> => SAVED);
  await renderHook(() =>
    usePhoneZones(HERE, null, { download, ahead: noAhead, shapes: noShapes }),
  );
  expect(download).not.toHaveBeenCalled();
  expect(noAhead).not.toHaveBeenCalled();
  expect(noShapes).not.toHaveBeenCalled();
});

test("the first maps of the phone are told while they download, then not", async () => {
  const engine = new PhoneEngine();
  jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  let finish: () => void = () => undefined;
  const download = jest.fn(
    (...[, network, , options]: Parameters<typeof downloadZone>) =>
      new Promise<ZoneDownload>((resolve) => {
        // An error the server sends is not a map.
        options?.onSize?.(network === "foot" ? 120 : 12_000_000);
        options?.onSize?.(network === "foot" ? 7_000_000 : 0);
        finish = () => resolve(SAVED);
      }),
  );
  const { result } = await renderHook(() =>
    usePhoneZones(HERE, "https://api", {
      engine,
      download,
      ahead: noAhead,
      shapes: noShapes,
    }),
  );
  expect(result.current).toBe(7_000_000);
  await act(async () => finish());
  // Both networks, as one size.
  expect(result.current).toBe(19_000_000);
  await act(async () => finish());
  expect(result.current).toBeNull();
});

test("with maps on the phone already, nothing is told", async () => {
  const zone = { name: TRENTO, etag: null, bytes: 7_000_000, usedAt: 0 };
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: [zone] }));
  files.set(zoneUri(zone), "zone");
  const engine = new PhoneEngine();
  jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  const download = jest.fn(
    async (..._args: Parameters<typeof downloadZone>): Promise<ZoneDownload> => SAVED,
  );
  const { result } = await renderHook(() =>
    usePhoneZones(HERE, "https://api", {
      engine,
      download,
      ahead: noAhead,
      shapes: noShapes,
    }),
  );
  await act(async () => undefined);
  expect(download.mock.calls.map((call) => call[3])).toEqual([
    { marginM: AROUND_MARGIN_M },
    { marginM: AROUND_MARGIN_M },
  ]);
  expect(result.current).toBeNull();
});

test("the zone of the sport is read ahead once the zones are there (part E)", async () => {
  const small = { name: TRENTO, etag: '"s"', bytes: 2_500_000, usedAt: 0 };
  const wide = { name: TRENTO_WIDE, etag: '"w"', bytes: 7_000_000, usedAt: 0 };
  const bike = { name: TRENTO_BIKE, etag: '"b"', bytes: 11_500_000, usedAt: 0 };
  files.set(
    "file:///documents/engine/zones.json",
    JSON.stringify({ zones: [wide, bike, small] }),
  );
  for (const zone of [small, wide, bike]) {
    files.set(zoneUri(zone), "zone");
  }
  const engine = new PhoneEngine();
  jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  const prepare = jest.spyOn(engine, "prepare").mockImplementation(() => undefined);
  const download = jest.fn(async (): Promise<ZoneDownload> => ({
    kind: "unchanged",
    zone: wide,
  }));
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine,
        download,
        ahead: noAhead,
        shapes: noShapes,
      }),
    );
  });
  // On foot, the sport of «Settings» by default: the smaller zone first.
  expect(prepare.mock.calls).toEqual([
    [
      [small, wide].map((zone) => ({
        name: zone.name,
        uri: zoneUri(zone),
        version: zone.etag,
      })),
      "running",
      HERE.point,
    ],
  ]);
});

test("a zone saved before around the phone starts Python before the downloads end (TASK-287)", async () => {
  const zone = { name: TRENTO, etag: null, bytes: 7_000_000, usedAt: 0 };
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: [zone] }));
  files.set(zoneUri(zone), "zone");
  const engine = new PhoneEngine();
  const warmUp = jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  // The zone brought up to date takes its time.
  const download = jest.fn(() => new Promise<ZoneDownload>(() => {}));
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine,
        download,
        ahead: noAhead,
        shapes: noShapes,
      }),
    );
  });
  expect(download).toHaveBeenCalledTimes(1);
  expect(warmUp).toHaveBeenCalledTimes(1);
});

test("the first zone downloaded starts Python, not the last (TASK-287)", async () => {
  const engine = new PhoneEngine();
  const warmUp = jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  let second: (answer: ZoneDownload) => void = () => undefined;
  const download = jest
    .fn<Promise<ZoneDownload>, Parameters<typeof downloadZone>>()
    .mockResolvedValueOnce(SAVED)
    .mockImplementationOnce(() => new Promise((resolve) => (second = resolve)));
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine,
        download,
        ahead: noAhead,
        shapes: noShapes,
      }),
    );
  });
  expect(download).toHaveBeenCalledTimes(2);
  expect(warmUp).toHaveBeenCalledTimes(1);
  await act(async () => second(SAVED));
  expect(warmUp).toHaveBeenCalledTimes(1);
});

test("offline, the zone saved before starts Python, and no city ahead is asked", async () => {
  const zone = { name: TRENTO, etag: null, bytes: 7_000_000, usedAt: 0 };
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: [zone] }));
  files.set(zoneUri(zone), "zone");
  const engine = new PhoneEngine();
  const warmUp = jest.spyOn(engine, "warmUp").mockImplementation(() => undefined);
  const download = jest.fn(async (): Promise<ZoneDownload> => ({
    kind: "failed",
    why: "offline",
  }));
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine,
        download,
        ahead: noAhead,
        shapes: noShapes,
      }),
    );
  });
  expect(warmUp).toHaveBeenCalledTimes(1);
  expect(noAhead).not.toHaveBeenCalled();
  // Nor the shapes on the water: the server does not answer.
  expect(noShapes).not.toHaveBeenCalled();
});

test("the places the user keeps are asked after the zones around, before those ahead (TASK-334)", async () => {
  const order: string[] = [];
  const download = jest.fn(async (): Promise<ZoneDownload> => {
    order.push("around");
    return SAVED;
  });
  const places = jest.fn(async () => {
    order.push("places");
  });
  const ahead = jest.fn(async () => {
    order.push("ahead");
    return "done" as const;
  });
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine: new PhoneEngine(),
        download,
        ahead,
        shapes: noShapes,
        places,
      }),
    );
  });
  expect(places.mock.calls).toEqual([["https://api", { download }]]);
  expect(order).toEqual(["around", "around", "places", "ahead"]);
});

test("offline, the places are not asked", async () => {
  const places = jest.fn(async () => undefined);
  await act(async () => {
    await renderHook(() =>
      usePhoneZones(HERE, "https://api", {
        engine: new PhoneEngine(),
        download: jest.fn(async (): Promise<ZoneDownload> => ({
          kind: "failed",
          why: "offline",
        })),
        ahead: noAhead,
        shapes: noShapes,
        places,
      }),
    );
  });
  expect(places).not.toHaveBeenCalled();
});
