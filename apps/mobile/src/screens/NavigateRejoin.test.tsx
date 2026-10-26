import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { type Navigation, onFix, startNavigation } from "../navigation/navigator";
import { emptyTrack } from "../navigation/trackRecorder";
import { saveUnitsChoice } from "../units/units";
import { NavigationBanner, NavigationCard } from "./NavigateScreen";

// Off the route (TASK-303): the banner says how far the route is and which
// way, as the dotted line on the map goes to it; back on it, the turns again.

jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

// A street due east: 0.001° of longitude here is about 77 m.
const LAT = 46.0;
function at(x: number, y: number): LatLon {
  return [LAT + y / 111_195, 11.0 + x / 77_243];
}
const STREET: LatLon[] = [0, 250, 500, 750, 1000].map((x) => at(x, 0));

/** On the street to 300 m, then 118 m north of it, beside 420 m. */
function offTheRoute(): Navigation {
  let { navigation } = startNavigation(STREET, []);
  const fixes = [
    ...Array.from({ length: 51 }, (_, i) => at(6 * i, 0)),
    ...Array.from({ length: 20 }, (_, i) => at(300, 6 * (i + 1))),
    ...Array.from({ length: 20 }, (_, i) => at(300 + 6 * (i + 1), 118)),
  ];
  fixes.forEach((fix, i) => {
    navigation = onFix(navigation, fix, { accuracyM: 8, timeMs: i * 2000 }).navigation;
  });
  expect(navigation.offRoute).toBe(true);
  return navigation;
}

function following(navigation: Navigation) {
  return {
    status: "following",
    navigation,
    position: null,
    track: emptyTrack(),
  } as const;
}

afterEach(async () => {
  await act(async () => {
    saveLanguageChoice("phone");
    saveUnitsChoice("phone");
  });
});

test("off the route, the banner shows how far the route is and which way", async () => {
  await act(async () => saveUnitsChoice("km"));
  const navigation = offTheRoute();
  await render(<NavigationBanner state={following(navigation)} />);
  expect(screen.getByText("Off the route")).toBeOnTheScreen();
  expect(screen.getByText("120 m S")).toBeOnTheScreen();
  expect(
    screen.getByLabelText("The route is 120 m away, to the south."),
  ).toBeOnTheScreen();
  expect(
    screen.getByText("Follow the dotted line back to the route."),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Head back to the yellow line.")).toBeNull();
});

test("on «Data» too, in place of the turn", async () => {
  await act(async () => saveUnitsChoice("km"));
  await render(<NavigationCard navigation={offTheRoute()} onStop={jest.fn()} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("120 m S")).toBeOnTheScreen();
});

test("with miles, in feet", async () => {
  await act(async () => saveUnitsChoice("mi"));
  await render(<NavigationBanner state={following(offTheRoute())} />);
  expect(screen.getByText("400 ft S")).toBeOnTheScreen();
});

test("in Italian", async () => {
  await act(async () => {
    saveLanguageChoice("it");
    saveUnitsChoice("km");
  });
  await render(<NavigationBanner state={following(offTheRoute())} />);
  expect(screen.getByText("Fuori percorso")).toBeOnTheScreen();
  expect(
    screen.getByLabelText("Il percorso riprende a 120 m verso sud."),
  ).toBeOnTheScreen();
  expect(
    screen.getByText("Segui la linea a puntini per tornare sul percorso."),
  ).toBeOnTheScreen();
});

test("without the way back, the words of before", async () => {
  const navigation = { ...offTheRoute(), rejoin: null };
  await render(<NavigationBanner state={following(navigation)} />);
  expect(screen.getByText("Head back to the yellow line.")).toBeOnTheScreen();
  expect(screen.queryByText("Follow the dotted line back to the route.")).toBeNull();
});

test("back on the route, the banner has no way back", async () => {
  let navigation = offTheRoute();
  for (const [i, x] of [432, 438].entries()) {
    navigation = onFix(navigation, at(x, 0), {
      accuracyM: 8,
      timeMs: 200_000 + i * 2000,
    }).navigation;
  }
  expect(navigation.offRoute).toBe(false);
  await render(<NavigationBanner state={following(navigation)} />);
  expect(screen.queryByText("Off the route")).toBeNull();
  expect(screen.queryByText(/^\d+ m S$/)).toBeNull();
  expect(screen.getByText("Follow the route to the end.")).toBeOnTheScreen();
});
