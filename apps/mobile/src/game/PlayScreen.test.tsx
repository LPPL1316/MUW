import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import me from "@shaperoute/shared-types/fixtures/game-me.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { GameCatalog, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { answers, apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { saveLanguageChoice } from "../i18n/language";
import { FollowsContext } from "../social/followsDoor";
import { saveUnitsChoice } from "../units/units";
import { forgetGameCatalog, setGameCatalog } from "./gameCatalog";
import { PlayScreen } from "./PlayScreen";
import { forgetGameMe } from "./useGameMe";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The phone's documents folder, in memory: the catalog, the language, the units.
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

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const CATALOG = catalog as GameCatalog;

/** The fake fetch, as the page takes it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

beforeEach(() => {
  forgetGameMe();
  setGameCatalog(CATALOG);
});

afterEach(() => {
  forgetGameCatalog();
  saveLanguageChoice("phone");
  saveUnitsChoice("phone");
});

function shown(
  fetchFn: jest.Mock,
  state: AccountState = SIGNED_IN,
  onSignIn = jest.fn(),
) {
  return render(
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: jest.fn() },
        openProfile: () => {},
      }}
    >
      <PlayScreen active onSignIn={onSignIn} fetchFn={fetchFn} apiKey={null} />
    </FollowsContext.Provider>,
  );
}

test("the collection shows the unlocked shapes in colour and the others with their way", async () => {
  await shown(fake({ status: 200, body: me }));
  await waitFor(() => expect(screen.getByTestId("play-totals")).toBeTruthy());
  expect(screen.getByTestId("play-totals")).toHaveTextContent("14.2 km counted so far");
  // The triangle, unlocked on the 23rd.
  expect(screen.getByTestId("shape-card-triangle")).toHaveTextContent(
    /Triangle.*Unlocked .* 23 Oct 2026/,
  );
  expect(screen.getAllByTestId("shape-unlocked")).toHaveLength(1);
  // The hexagon, 71 % of 20 km.
  expect(screen.getByTestId("shape-card-hexagon")).toHaveTextContent(
    /Hexagon.*20 km in total.*71%.*14\.2 \/ 20 km/,
  );
  // The lightning, with the best kilometre against the target.
  expect(screen.getByTestId("shape-card-lightning")).toHaveTextContent(
    /Lightning.*1 km under 5:00 \/km.*93%.*Best 5:22 \/km · target 5:00 \/km/,
  );
  expect(screen.getAllByTestId("shape-locked")).toHaveLength(2);
  expect(screen.queryByTestId("play-sign-in")).toBeNull();
});

test("without an account the shapes are shown as they are, with the way to sign in", async () => {
  const onSignIn = jest.fn();
  const fetchFn = fake();
  await shown(fetchFn, SIGNED_OUT, onSignIn);
  expect(fetchFn).not.toHaveBeenCalled();
  expect(screen.getAllByTestId("shape-locked")).toHaveLength(3);
  expect(screen.getByTestId("shape-card-triangle")).toHaveTextContent(/5 km in total$/);
  expect(screen.queryByText(/%/)).toBeNull();
  await fireEvent.press(screen.getByTestId("play-sign-in"));
  expect(onSignIn).toHaveBeenCalledTimes(1);
});

test("in miles the way is said in miles", async () => {
  saveUnitsChoice("mi");
  await shown(fake({ status: 200, body: me }));
  await waitFor(() => expect(screen.getByTestId("play-totals")).toBeTruthy());
  expect(screen.getByTestId("play-totals")).toHaveTextContent("8.8 mi counted so far");
  expect(screen.getByTestId("shape-card-hexagon")).toHaveTextContent(
    /12\.4 mi in total.*8\.8 \/ 12\.4 mi/,
  );
  expect(screen.getByTestId("shape-card-lightning")).toHaveTextContent(
    /0\.6 mi under 8:03 \/mi/,
  );
});

test("the names follow the app's language", async () => {
  saveLanguageChoice("it");
  await shown(fake(), SIGNED_OUT);
  expect(screen.getByTestId("shape-card-triangle")).toHaveTextContent(/Triangolo/);
  expect(screen.getByTestId("shape-card-lightning")).toHaveTextContent(/Fulmine/);
  expect(screen.getByText("Accedi per collezionare le forme.")).toBeTruthy();
});

test("an API that cannot be reached says so, and «Try again» asks again", async () => {
  await shown(fake(new Error("offline"), { status: 200, body: me }));
  await waitFor(() => expect(screen.getByTestId("play-retry")).toBeTruthy());
  expect(
    screen.getByText(/^No connection\. Check the network and try again\./),
  ).toBeTruthy();
  await fireEvent.press(screen.getByTestId("play-retry"));
  await waitFor(() => expect(screen.getByTestId("play-totals")).toBeTruthy());
});

test("a refused session shows the account's words", async () => {
  await shown(fake({ status: 401, body: apiError("session_expired") }));
  await waitFor(() => expect(screen.getByTestId("play-retry")).toBeTruthy());
  expect(screen.getByText("Your session has ended. Log in again.")).toBeTruthy();
});
