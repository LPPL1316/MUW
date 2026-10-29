import type { LatLon } from "@shaperoute/shared-types";
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";

import { awayText, kmOrMiles } from "../explore/ExploreScreen";
import { favoriteTitle } from "../favorites/favoriteRoute";
import { postFacts } from "../feed/FeedPost";
import type { SamplePost } from "../feed/sampleFeed";
import { SAVED_SAID, SavedLogo } from "../intro/SavedLogo";
import { startStatus } from "../location/startStatus";
import { startNavigation } from "../navigation/navigator";
import { compassPoint } from "../navigation/runStats";
import { emptyTrack } from "../navigation/trackRecorder";
import { ChooseScreen } from "../screens/ChooseScreen";
import { NavigationBanner } from "../screens/NavigateScreen";
import { RouteBar, useRunNumbers } from "../screens/RunPanel";
import { saveUnitsChoice } from "../units/units";
import { t } from "./index";
import { saveLanguageChoice } from "./language";

// The texts left in English after the parts A to G (TASK-210, part H): the
// start in «Draw», a note and a distance of «Explore», the chips and the
// distance left of the run, the sport of a post, an image kept among the
// favorites, what a screen reader hears after «Save».

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
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const TRENTO: LatLon = [46.0671, 11.1214];

beforeEach(async () => {
  await act(async () => saveLanguageChoice("it"));
});

afterEach(async () => {
  await act(async () => {
    saveLanguageChoice("phone");
    saveUnitsChoice("phone");
  });
});

test("the line under the start says where the route starts, in Italian", () => {
  const gps = { status: "ok", point: TRENTO } as const;
  expect(startStatus("gps", gps, { point: TRENTO, source: "gps" })).toBe(
    "Parti dalla tua posizione.",
  );
  expect(
    startStatus("place", gps, {
      point: TRENTO,
      source: "search",
      label: "Levico Terme",
    }),
  ).toBe("Parti da Levico Terme.");
  expect(startStatus("place", gps, { point: TRENTO, source: "map" })).toBe(
    "Parti da un punto sulla mappa.",
  );
  expect(startStatus("place", gps, null)).toBe(
    "Cerca una città o una via da cui partire.",
  );
  expect(startStatus("gps", { status: "denied" }, null)).toMatch(
    /^La posizione è disattivata per MuW\. Consentila nelle Impostazioni/,
  );
  expect(startStatus("gps", { status: "unavailable" }, null)).toMatch(
    /^La tua posizione adesso non è disponibile\./,
  );
  expect(startStatus("gps", { status: "loading" }, null)).toBe(
    "Cerco la tua posizione…",
  );
});

test("the start card of «Draw» names its two ways in Italian", async () => {
  await render(
    <ChooseScreen
      status={startStatus("gps", { status: "loading" }, null)}
      denied={false}
      mode="gps"
      onMode={jest.fn()}
      searching={false}
      onPlace={jest.fn()}
      near={null}
      mapError={null}
      footer={<Text>Footer</Text>}
      onRun={jest.fn()}
    >
      <Text>Shapes</Text>
    </ChooseScreen>,
  );
  expect(screen.getByText("PARTENZA")).toBeOnTheScreen();
  expect(screen.getByText("La mia posizione")).toBeOnTheScreen();
  expect(screen.getByText("Un altro posto")).toBeOnTheScreen();
  expect(screen.getByText("Cerco la tua posizione…")).toBeOnTheScreen();
  // Without a label of its sport, the run button is still in Italian.
  expect(
    screen.getByRole("button", { name: "Corri senza percorso" }),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/My position|Another place|^START$/)).toBeNull();
});

test("«Explore» writes how far a route is in Italian, with the comma", async () => {
  expect(awayText(640)).toBe("a 640 m");
  expect(awayText(1440)).toBe("a 1,4 km");
  await act(async () => saveUnitsChoice("mi"));
  expect(awayText(1440)).toBe("a 0,9 mi");
  expect(kmOrMiles(5000, "mi")).toBe("3,1 mi");
  expect(
    t(
      "No recommended routes near this start yet. Draw one: the best ones will show up here.",
    ),
  ).toMatch(/^Non ci sono ancora percorsi consigliati/);
  expect(
    t("Finding the places and drawing the shape through them… This can take a minute."),
  ).toBe("Cerco i luoghi e disegno la forma che li attraversa… Può volerci un minuto.");
});

test("the run says how much is drawn, where it heads and what is left, in Italian", async () => {
  const north = (m: number): LatLon => [TRENTO[0] + m / 111_195, TRENTO[1]];
  const { navigation } = startNavigation([north(0), north(500), north(1000)], []);
  await render(
    <NavigationBanner
      state={{ status: "following", navigation, position: null, track: emptyTrack() }}
    />,
  );
  expect(screen.getByText("0% disegnato")).toBeOnTheScreen();
  // The eight points as Italian writes them: «O» for west.
  expect(
    [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => t(compassPoint(deg))),
  ).toEqual(["N", "NE", "E", "SE", "S", "SO", "O", "NO"]);

  const Bar = () => (
    <RouteBar
      route={{ remainingM: 3200, done: 0.4 }}
      numbers={useRunNumbers(emptyTrack(), false, { remainingM: 3200, done: 0.4 })}
    />
  );
  await render(<Bar />);
  expect(screen.getByText("mancano 3,2 km")).toBeOnTheScreen();
});

test("a post on the water or on a bike names its sport in Italian", () => {
  const post: SamplePost = {
    id: "example:dog_head:paddling:44.0035,12.6634",
    user: "ale.paddle",
    title: "Dog paddle off Riccione",
    city: "Riccione",
    shape: "dog_head",
    route_m: 2000,
    minutes: 30,
    score: 89,
    line: [TRENTO, TRENTO],
    activity: "paddling",
  };
  expect(postFacts(post)).toBe(
    "Pagaia · Testa di cane · 2,0 km · 30 min · 7:30 /500 m",
  );
  expect(postFacts({ ...post, activity: "cycling" })).toMatch(/^Bici · /);
  expect(postFacts({ ...post, activity: undefined })).toMatch(/^Testa di cane · /);
});

test("the outline of an image kept among the favorites is called «Immagine»", () => {
  expect(favoriteTitle({ shape: null, word: null, title: "Image" })).toBe("Immagine");
  // A themed route keeps the API's title, as it is.
  expect(favoriteTitle({ shape: null, word: null, title: "Fountains" })).toBe(
    "Fountains",
  );
});

test("after «Save» a screen reader hears it in Italian", async () => {
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
  await render(<SavedLogo onDone={jest.fn()} />);
  expect(screen.getByLabelText("Salvata nelle mie attività")).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith("Salvata nelle mie attività");
  expect(SAVED_SAID).toBe("Saved to My activities");
});
