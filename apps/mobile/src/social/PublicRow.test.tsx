import open from "@shaperoute/shared-types/fixtures/contest.json";
import myDetails from "@shaperoute/shared-types/fixtures/my-drawing-details.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Contest, MyDrawing, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import { apiError } from "../account/testing";
import type { Account } from "../account/useAccount";
import { forgetContest, setContest } from "../contest/contestKept";
import { DrawingsContext, useDrawingsOf } from "./drawingsDoor";
import { keepPhoto, loadDrawingPhotos } from "./drawingPhotos";
import { FollowsContext } from "./followsDoor";
import type { PickedDrawingPhoto } from "./pickDrawingPhoto";
import { ONLY_ME_PHOTOS, PHOTOS_LEAVE } from "./PublicParts";
import { PublicRow } from "./PublicRow";

// The form of the drawing on a run of «My activities» (TASK-208): what the
// API has, changed one piece at a time, with the photos of the phone.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The phone's documents folder, in memory.
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
  return { File, files, Paths: { document: { uri: "file:///documents/" } } };
});

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");
const URL = "http://api";
const signedIn = session as Session;
const OWNER = signedIn.user.id;
const MINE = myDetails as MyDrawing;
const KEY = MINE.key;
const DRAWING = `/me/activities/${KEY}/drawing`;
const doors = { onOpened: jest.fn(), onBack: jest.fn() };

function account(): Account {
  return {
    state: { status: "signedIn", session: signedIn },
    busy: null,
    problem: null,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    editProfile: jest.fn(),
    changeEmail: jest.fn(),
    changePhone: jest.fn(),
    changeNotifications: jest.fn(),
    clearProblem: jest.fn(),
    sessionEnded: jest.fn(),
  };
}

type Route = (init?: RequestInit) => Response;

/** A fetch answering by «METHOD path», keeping each call and its body. */
function api(routes: Record<string, Route>) {
  const calls: { name: string; body: unknown }[] = [];
  const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
    const name = `${init?.method ?? "GET"} ${url.replace(URL, "")}`;
    calls.push({ name, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[name];
    if (route === undefined) {
      throw new Error(`No answer for ${name}`);
    }
    return route(init);
  });
  return { fetchFn, calls, names: () => calls.map((call) => call.name) };
}

/** The API keeps what it is sent. */
const kept: Route = (init) => {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  const { tags: _tags, ...rest } = body;
  return Response.json({ ...MINE, ...rest, public: body.visibility === "everyone" });
};

const picked = jest.fn(async (): Promise<PickedDrawingPhoto> => ({
  kind: "picked",
  base64: "c2hydW5r",
  width: 1080,
  height: 810,
}));

function Row({ fetchFn }: { fetchFn: jest.Mock }) {
  // The same account at every render, as «Profile» hands it.
  const [account_] = useState(account);
  const door = useDrawingsOf(URL, account_, doors, { fetchFn, key: null });
  return (
    <DrawingsContext.Provider value={door}>
      <FollowsContext.Provider
        value={{ apiUrl: URL, account: account_, openProfile: jest.fn() }}
      >
        <PublicRow activityKey={KEY} pick={picked} fetchFn={fetchFn} apiKey={null} />
      </FollowsContext.Provider>
    </DrawingsContext.Provider>
  );
}

const BODY = {
  title: MINE.title,
  visibility: "followers",
  description: MINE.description,
  activity: "running",
  tags: ["3b9d2e10-7c4a-4f8e-a1d6-5e2f9c0b7a44"],
};

beforeEach(() => {
  files.clear();
});

describe("«Enter “{theme}”» on a run of «My activities» (TASK-343 part B)", () => {
  const THEME = {
    ...(open as Contest),
    starts_at: "2020-01-01T00:00:00Z",
    ends_at: "2999-12-31T23:59:59Z",
    theme: { en: { title: "Animals", description: "Draw an animal." } },
    entrants: 3,
    entered: [],
  } as Contest;
  const FOR_EVERYONE = { ...MINE, visibility: "everyone", public: true };
  const ENTRY = `/contests/${THEME.id}/entries/${MINE.id}`;
  const NAME = "Enter “Animals”";
  const ACCOUNT = signedIn.user.public_id ?? null;

  afterEach(() => {
    forgetContest();
  });

  test("on: the drawing is saved, then entered", async () => {
    setContest({ account: ACCOUNT, contest: THEME });
    const { fetchFn, names } = api({
      [`GET ${DRAWING}`]: () => Response.json(FOR_EVERYONE),
      [`PUT ${DRAWING}`]: kept,
      [`PUT ${ENTRY}`]: () => new Response(null, { status: 204 }),
    });
    await render(<Row fetchFn={fetchFn} />);
    await fireEvent.press(await screen.findByRole("switch", { name: NAME }));
    await waitFor(() =>
      expect(names().slice(0, 3)).toEqual([
        `GET ${DRAWING}`,
        `PUT ${DRAWING}`,
        `PUT ${ENTRY}`,
      ]),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: NAME }).props.accessibilityState.checked,
      ).toBe(true),
    );
  });

  test("already entered it starts on, and off withdraws it", async () => {
    setContest({
      account: ACCOUNT,
      contest: { ...THEME, entered: [MINE.id] } as Contest,
    });
    const { fetchFn, names } = api({
      [`GET ${DRAWING}`]: () => Response.json(FOR_EVERYONE),
      [`PUT ${DRAWING}`]: kept,
      [`DELETE ${ENTRY}`]: () => new Response(null, { status: 204 }),
    });
    await render(<Row fetchFn={fetchFn} />);
    const on = await screen.findByRole("switch", { name: NAME });
    expect(on.props.accessibilityState.checked).toBe(true);
    await fireEvent.press(on);
    await waitFor(() => expect(names()).toContain(`DELETE ${ENTRY}`));
  });

  test("refused: it says why and goes back off; the drawing is saved", async () => {
    setContest({ account: ACCOUNT, contest: THEME });
    const { fetchFn } = api({
      [`GET ${DRAWING}`]: () => Response.json(FOR_EVERYONE),
      [`PUT ${DRAWING}`]: kept,
      [`PUT ${ENTRY}`]: () =>
        Response.json(apiError("not_entrant", "No."), { status: 409 }),
    });
    await render(<Row fetchFn={fetchFn} />);
    await fireEvent.press(await screen.findByRole("switch", { name: NAME }));
    expect(await screen.findByText(/This run cannot take part/)).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: NAME }).props.accessibilityState.checked,
      ).toBe(false),
    );
  });

  test("with today's API, no switch and no call of the challenge", async () => {
    setContest({ account: ACCOUNT, contest: open as Contest });
    const { fetchFn, names } = api({
      [`GET ${DRAWING}`]: () => Response.json(FOR_EVERYONE),
      [`PUT ${DRAWING}`]: kept,
    });
    await render(<Row fetchFn={fetchFn} />);
    await screen.findByDisplayValue("Sunday heart by the river");
    expect(screen.queryByRole("switch")).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: "Followers" }));
    await waitFor(() => expect(names()).toEqual([`GET ${DRAWING}`, `PUT ${DRAWING}`]));
  });
});

test("the form shows what the API has, and a chip sends the choice whole at once", async () => {
  const { fetchFn, calls } = api({
    [`GET ${DRAWING}`]: () => Response.json(MINE),
    [`PUT ${DRAWING}`]: kept,
  });
  await render(<Row fetchFn={fetchFn} />);
  expect(await screen.findByDisplayValue("Sunday heart by the river")).toBeTruthy();
  expect(screen.getByDisplayValue(MINE.description ?? "")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Followers", checked: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove adam.trento" })).toBeTruthy();
  // The API's photo, read with the token.
  const photo = screen.getByLabelText("Photo 1");
  expect(photo.props.source).toEqual({
    uri: `${URL}${MINE.photos?.[0].url}`,
    headers: { Authorization: `Bearer ${signedIn.token}` },
  });
  expect(
    screen.getByText(
      "Your followers see it in your profile, without the first and last 200 m.",
    ),
  ).toBeTruthy();

  await fireEvent.press(screen.getByRole("radio", { name: "Everyone" }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1]).toEqual({
    name: `PUT ${DRAWING}`,
    body: { ...BODY, visibility: "everyone" },
  });
  expect(
    await screen.findByText(
      "Every member sees it in your profile, without the first and last 200 m.",
    ),
  ).toBeTruthy();
});

test("the title goes when typing is over, and only when it changed", async () => {
  const { fetchFn, calls } = api({
    [`GET ${DRAWING}`]: () => Response.json(MINE),
    [`PUT ${DRAWING}`]: kept,
  });
  await render(<Row fetchFn={fetchFn} />);
  const title = await screen.findByLabelText("Title");
  await fireEvent.changeText(title, " Star of Trento ");
  expect(calls).toHaveLength(1);
  await fireEvent(title, "endEditing");
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1].body).toEqual({ ...BODY, title: "Star of Trento" });
  await fireEvent(title, "endEditing");
  expect(calls).toHaveLength(2);
});

test("a photo added while others see the run goes to the API after the drawing", async () => {
  const { fetchFn, names } = api({
    [`GET ${DRAWING}`]: () => Response.json(MINE),
    [`PUT ${DRAWING}`]: kept,
    [`PUT ${DRAWING}/photos/2`]: () => Response.json(MINE),
  });
  await render(<Row fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  await waitFor(() => expect(names()).toContain(`PUT ${DRAWING}/photos/2`));
  expect(names()).toEqual([
    `GET ${DRAWING}`,
    `PUT ${DRAWING}`,
    `PUT ${DRAWING}/photos/2`,
  ]);
  expect(await screen.findByLabelText("Photo 2")).toBeTruthy();
  expect(loadDrawingPhotos()).toEqual([{ owner: OWNER, key: KEY, n: 2, sent: true }]);
});

test("a photo of the API taken off is emptied there", async () => {
  const { fetchFn, names } = api({
    [`GET ${DRAWING}`]: () => Response.json(MINE),
    [`PUT ${DRAWING}`]: kept,
    [`DELETE ${DRAWING}/photos/1`]: () => new Response(null, { status: 204 }),
  });
  await render(<Row fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: "Remove photo 1" }));
  await waitFor(() => expect(names()).toContain(`DELETE ${DRAWING}/photos/1`));
  expect(screen.queryByLabelText("Photo 1")).toBeNull();
  expect(loadDrawingPhotos()).toEqual([]);
});

test("back to «Only me» with photos: they leave MuW, and the phone's stay here", async () => {
  keepPhoto(OWNER, KEY, 2, "BBBB");
  const { fetchFn, calls } = api({
    [`GET ${DRAWING}`]: () => Response.json(MINE),
    [`PUT ${DRAWING}`]: kept,
  });
  await render(<Row fetchFn={fetchFn} />);
  expect(await screen.findByLabelText("Photo 2")).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Only me" }));
  expect(await screen.findByText(PHOTOS_LEAVE)).toBeTruthy();
  expect(calls[1].body).toEqual({ ...BODY, visibility: "only_me" });
  expect(calls).toHaveLength(2);
  expect(screen.getByText(ONLY_ME_PHOTOS)).toBeTruthy();
  expect(loadDrawingPhotos()).toEqual([{ owner: OWNER, key: KEY, n: 2, sent: false }]);
});

test("on a run only the owner sees, a photo stays on the phone and nothing is sent", async () => {
  const { fetchFn, names } = api({
    [`GET ${DRAWING}`]: () =>
      Response.json({ ...MINE, visibility: "only_me", public: false, photos: [] }),
  });
  await render(<Row fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  expect(await screen.findByLabelText("Photo 1")).toBeTruthy();
  expect(screen.getByText(ONLY_ME_PHOTOS)).toBeTruthy();
  expect(names()).toEqual([`GET ${DRAWING}`]);
  expect(loadDrawingPhotos()).toEqual([{ owner: OWNER, key: KEY, n: 1, sent: false }]);
});

test("a choice the API refuses is said, and the form goes back to what it kept", async () => {
  const { fetchFn } = api({
    [`GET ${DRAWING}`]: () => Response.json(MINE),
    [`PUT ${DRAWING}`]: () =>
      Response.json(apiError("invalid_request", "This run is too short to publish."), {
        status: 422,
      }),
  });
  await render(<Row fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("radio", { name: "Everyone" }));
  expect(await screen.findByText("This run is too short to publish.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Followers", checked: true })).toBeTruthy();
});
