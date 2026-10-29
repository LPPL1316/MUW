import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import type { Place } from "../places/photon";
import { ASK_AGAIN_MS, type KeptPlace, MAX_PLACES, readPlaces } from "./keptPlaces";
import { files } from "./memoryFiles";
import { OfflineMapsSetting } from "./OfflineMapsSetting";
import { savedZones, touchZone, type ZoneEntry, zoneUri } from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({}));

const TRENTO = "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz";
const TRENTO_BIKE = "bike_45.98280_10.99990_46.15140_11.24290.zone.json.gz";
const LEVICO_ZONE = "foot_45.95830_11.22070_46.06620_11.37660.zone.json.gz";
const LEVICO: Place = {
  label: "Levico Terme, Trentino, Italy",
  point: [46.0122, 11.2986],
};
const RIVA: Place = {
  label: "Riva del Garda, Trentino, Italy",
  point: [45.8858, 10.8411],
};
const BOLZANO: Place = {
  label: "Bolzano, South Tyrol, Italy",
  point: [46.4983, 11.3548],
};

/** Places kept, as keepPlaces leaves them. */
function savePlaces(places: KeptPlace[]): void {
  files.set("file:///documents/engine/places.json", JSON.stringify({ places }));
}

function kept(place: Place, more: Partial<KeptPlace> = {}): KeptPlace {
  return {
    label: place.label,
    point: place.point,
    network: "foot",
    zone: null,
    status: "preparing",
    waitUntil: 0,
    ...more,
  };
}

/** Zones saved on the phone, as the downloads leave them. */
function saveZones(zones: ZoneEntry[]): void {
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones }));
  for (const zone of zones) {
    files.set(zoneUri(zone), "zone");
  }
}

beforeEach(() => {
  files.clear();
});

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("the space the zones take, with «Delete», and how they download", async () => {
  saveZones([
    { name: TRENTO, etag: null, bytes: 700_000_000, usedAt: 1 },
    { name: TRENTO_BIKE, etag: null, bytes: 530_000_000, usedAt: 2 },
  ]);
  await render(<OfflineMapsSetting />);
  expect(screen.getByText("Offline maps: 1.2 GB")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
  expect(screen.getByText("Maps download on Wi-Fi and mobile data.")).toBeOnTheScreen();
});

test("«Delete» removes every zone, and the row says so", async () => {
  saveZones([{ name: TRENTO, etag: null, bytes: 19_000_000, usedAt: 1 }]);
  await render(<OfflineMapsSetting />);
  expect(screen.getByText("Offline maps: 19 MB")).toBeOnTheScreen();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
  });
  expect(savedZones()).toEqual([]);
  expect(screen.getByText("Offline maps: 0 MB")).toBeOnTheScreen();
  // Nothing left to delete.
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
});

test("the size follows the zones while the page is open", async () => {
  await render(<OfflineMapsSetting />);
  expect(screen.getByText("Offline maps: 0 MB")).toBeOnTheScreen();
  await act(async () => {
    saveZones([{ name: TRENTO, etag: null, bytes: 7_000_000, usedAt: 1 }]);
    // Any change of the index tells the page.
    touchZone(TRENTO, 2);
  });
  expect(screen.getByText("Offline maps: 7 MB")).toBeOnTheScreen();
});

test("the row is in the app's language", async () => {
  await act(async () => saveLanguageChoice("it"));
  saveZones([{ name: TRENTO, etag: null, bytes: 1_230_000_000, usedAt: 1 }]);
  await render(<OfflineMapsSetting />);
  expect(screen.getByText("Mappe offline: 1,2 GB")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Elimina" })).toBeOnTheScreen();
  expect(
    screen.getByText("Le mappe si scaricano con il Wi-Fi e con i dati mobili."),
  ).toBeOnTheScreen();
});

test("the places kept, each with its size or how it is going (TASK-334)", async () => {
  saveZones([
    { name: LEVICO_ZONE, etag: null, bytes: 6_000_000, usedAt: 1, kept: true },
  ]);
  savePlaces([
    kept(LEVICO, { zone: LEVICO_ZONE, status: "ready" }),
    kept(BOLZANO),
    kept(RIVA, { status: "later", waitUntil: 5 }),
  ]);
  await render(<OfflineMapsSetting baseUrl={null} />);
  expect(screen.getByText("Levico Terme · 6 MB")).toBeOnTheScreen();
  expect(screen.getByText("Bolzano · Preparing the map…")).toBeOnTheScreen();
  expect(screen.getByText("Riva del Garda · Trying again later")).toBeOnTheScreen();
  expect(
    screen.getByText(
      "Places you add stay on the phone, so shapes there are drawn faster, even without signal.",
    ),
  ).toBeOnTheScreen();
  // «✕» removes the place, and its zone.
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Remove Levico Terme" }));
  });
  expect(screen.queryByText("Levico Terme · 6 MB")).toBeNull();
  expect(savedZones()).toEqual([]);
  expect(readPlaces().map((place) => place.label)).toEqual([BOLZANO.label, RIVA.label]);
});

test("«Add a place» finds a town, and the server is asked for it", async () => {
  const keep = jest.fn(async () => undefined);
  const find = jest.fn(async () => [LEVICO]);
  await render(<OfflineMapsSetting baseUrl="https://api" keep={keep} find={find} />);
  expect(keep).toHaveBeenCalledWith("https://api");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Add a place" }));
  });
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText("City or street"), "Levico");
  });
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Search" }));
  });
  await act(async () => {
    fireEvent.press(screen.getByText(LEVICO.label));
  });
  expect(readPlaces()).toEqual([kept(LEVICO)]);
  expect(screen.getByText("Levico Terme · Preparing the map…")).toBeOnTheScreen();
  expect(screen.queryByPlaceholderText("City or street")).toBeNull();
  expect(keep.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("while a place is prepared the server is asked again", async () => {
  jest.useFakeTimers();
  try {
    savePlaces([kept(BOLZANO)]);
    const keep = jest.fn(async () => undefined);
    await render(<OfflineMapsSetting baseUrl="https://api" keep={keep} />);
    expect(keep).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(ASK_AGAIN_MS);
    });
    expect(keep).toHaveBeenCalledTimes(2);
    // Nothing being prepared any more: no more asking.
    await act(async () => {
      savePlaces([kept(BOLZANO, { status: "later", waitUntil: 9 })]);
      touchZone(TRENTO, 1); // any change of the zones tells the page
    });
    const asked = keep.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(3 * ASK_AGAIN_MS);
    });
    expect(keep).toHaveBeenCalledTimes(asked);
  } finally {
    jest.useRealTimers();
  }
});

test("ten places at most, and «Delete» deletes them too", async () => {
  savePlaces(
    Array.from({ length: MAX_PLACES }, (_, n) =>
      kept({ label: `Town ${n}`, point: [45 + n / 100, 11] }),
    ),
  );
  await render(<OfflineMapsSetting baseUrl={null} />);
  expect(screen.queryByRole("button", { name: "Add a place" })).toBeNull();
  expect(screen.getByText("Up to 10 places.")).toBeOnTheScreen();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Delete" }));
  });
  expect(readPlaces()).toEqual([]);
  expect(screen.getByRole("button", { name: "Add a place" })).toBeOnTheScreen();
});

test("the places in the app's language", async () => {
  await act(async () => saveLanguageChoice("it"));
  savePlaces([kept(BOLZANO)]);
  await render(<OfflineMapsSetting baseUrl={null} />);
  expect(screen.getByText("Bolzano · Preparo la mappa…")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Aggiungi un posto" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Togli Bolzano" })).toBeOnTheScreen();
});
