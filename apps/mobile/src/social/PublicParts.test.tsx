import people from "@shaperoute/shared-types/fixtures/people.json";
import open from "@shaperoute/shared-types/fixtures/contest.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { type Contest, DRAWING_MAX_TAGS, type Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { answers } from "../account/testing";
import { type DrawingChoice, NOT_CHOSEN } from "../api/drawings";
import { forgetContest, setContest } from "../contest/contestKept";
import { FollowsContext } from "./followsDoor";
import type { PhotoShown } from "./drawingsDoor";
import type { PickedDrawingPhoto } from "./pickDrawingPhoto";
import {
  ActivityChips,
  DrawingForm,
  nextPlace,
  ONLY_ME_PHOTOS,
  PhotosRow,
  TagsField,
  VisibilityChips,
} from "./PublicParts";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const signedIn = session as Session;
const follows = (fetchFn: jest.Mock) => ({
  apiUrl: "http://api",
  account: {
    state: { status: "signedIn" as const, session: signedIn },
    sessionEnded: jest.fn(),
  },
  openProfile: jest.fn(),
  fetchFn,
});

const PHOTO: PhotoShown = {
  n: 1,
  source: { uri: "data:image/jpeg;base64,AAAA" },
  onPhone: true,
};

const picked = (kind: PickedDrawingPhoto["kind"]) =>
  jest.fn(async (): Promise<PickedDrawingPhoto> =>
    kind === "picked"
      ? { kind, base64: "c2hydW5r", width: 1080, height: 810 }
      : { kind },
  );

test("the first empty place is the photo's", () => {
  expect(nextPlace([])).toBe(1);
  expect(nextPlace([{ n: 1 }, { n: 3 }])).toBe(2);
  expect(nextPlace([{ n: 1 }, { n: 2 }, { n: 3 }])).toBeNull();
});

test("«Who can see it» and «Activity» are one of a few, said at once", async () => {
  const onVisibility = jest.fn();
  const onActivity = jest.fn();
  await render(
    <>
      <VisibilityChips value="only_me" onChange={onVisibility} />
      <ActivityChips value="running" onChange={onActivity} />
    </>,
  );
  expect(screen.getByRole("radio", { name: "Only me", checked: true })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Everyone", checked: false })).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Followers" }));
  expect(onVisibility).toHaveBeenCalledWith("followers");
  expect(screen.getByRole("radio", { name: "Run", checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Paddle" }));
  expect(onActivity).toHaveBeenCalledWith("paddling");
});

test("«Tag people» finds a member by name, and a tag has its ×", async () => {
  const fetchFn: jest.Mock = answers({ status: 200, body: people });
  const onChange = jest.fn();
  const door = follows(fetchFn);
  await render(
    <FollowsContext.Provider value={door}>
      <TagsField tags={[]} onChange={onChange} fetchFn={fetchFn} apiKey={null} />
    </FollowsContext.Provider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Tag people" }));
  expect(screen.getByRole("header", { name: "Tag people" })).toBeTruthy();
  const field = screen.getByLabelText("Name");
  await fireEvent.changeText(field, "ad");
  await fireEvent(field, "submitEditing");
  await fireEvent.press(await screen.findByRole("button", { name: "adam.trento" }));
  expect(onChange).toHaveBeenCalledWith([
    { public_id: "3b9d2e10-7c4a-4f8e-a1d6-5e2f9c0b7a44", username: "adam.trento" },
  ]);

  const tagged = [
    { public_id: "3b9d2e10-7c4a-4f8e-a1d6-5e2f9c0b7a44", username: "adam.trento" },
  ];
  await screen.rerender(
    <FollowsContext.Provider value={door}>
      <TagsField tags={tagged} onChange={onChange} fetchFn={fetchFn} apiKey={null} />
    </FollowsContext.Provider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Remove adam.trento" }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test("with the most people tagged, no more can be", async () => {
  const tags = Array.from({ length: DRAWING_MAX_TAGS }, (_, i) => ({
    public_id: `id-${i}`,
    username: `runner${i}`,
  }));
  await render(
    <FollowsContext.Provider value={follows(answers())}>
      <TagsField tags={tags} onChange={jest.fn()} />
    </FollowsContext.Provider>,
  );
  expect(screen.queryByRole("button", { name: "Tag people" })).toBeNull();
  expect(screen.getByRole("button", { name: "Remove runner9" })).toBeTruthy();
});

test("«Add photo» asks where from, and the photo chosen is handed over", async () => {
  const pick = picked("picked");
  const onAdd = jest.fn();
  await render(
    <PhotosRow photos={[]} onAdd={onAdd} onRemove={jest.fn()} pick={pick} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  expect(pick).toHaveBeenCalledWith("library");
  await screen.findByRole("button", { name: "Add photo" });
  expect(onAdd).toHaveBeenCalledWith("c2hydW5r");
});

test("a camera refused says so, with the way to Settings; a photo has its ×", async () => {
  const onRemove = jest.fn();
  await render(
    <PhotosRow
      photos={[PHOTO]}
      onAdd={jest.fn()}
      onRemove={onRemove}
      pick={picked("denied")}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Take a photo" }));
  expect(
    await screen.findByText(
      "The camera is off for this app. Allow it in Settings, or choose a picture instead.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy();
  expect(screen.getByLabelText("Photo 1")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Remove photo 1" }));
  expect(onRemove).toHaveBeenCalledWith(PHOTO);
});

test("the form: the title and «How did it go?» as typed, trimmed; a warning for the photos of «Only me»", async () => {
  const onChoice = jest.fn();
  await render(
    <FollowsContext.Provider value={follows(answers())}>
      <DrawingForm
        choice={NOT_CHOSEN}
        onChoice={onChoice}
        photos={[PHOTO]}
        onAddPhoto={jest.fn()}
        onRemovePhoto={jest.fn()}
      />
    </FollowsContext.Provider>,
  );
  expect(screen.getByLabelText("Title").props.placeholder).toBe("Give it a name");
  await fireEvent.changeText(screen.getByLabelText("Title"), " Heart ");
  expect(onChoice).toHaveBeenLastCalledWith({ ...NOT_CHOSEN, title: "Heart" });
  await fireEvent.changeText(screen.getByLabelText("How did it go?"), "Heavy legs.\n");
  expect(onChoice).toHaveBeenLastCalledWith({
    ...NOT_CHOSEN,
    description: "Heavy legs.",
  });
  expect(screen.getByText(ONLY_ME_PHOTOS)).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Everyone" }));
  expect(onChoice).toHaveBeenLastCalledWith({ ...NOT_CHOSEN, visibility: "everyone" });
});

describe("«Enter “{theme}”» (TASK-343 part B)", () => {
  const THEME = {
    ...(open as Contest),
    starts_at: "2020-01-01T00:00:00Z",
    ends_at: "2999-12-31T23:59:59Z",
    theme: { en: { title: "Animals", description: "Draw an animal." } },
  } as Contest;
  const FOR_EVERYONE = { ...NOT_CHOSEN, visibility: "everyone" as const };

  async function form(
    choice: DrawingChoice,
    onChoice: (next: DrawingChoice) => void = jest.fn(),
    imported = false,
  ) {
    await render(
      <FollowsContext.Provider value={follows(answers())}>
        <DrawingForm
          choice={choice}
          onChoice={onChoice}
          photos={[]}
          onAddPhoto={jest.fn()}
          onRemovePhoto={jest.fn()}
          imported={imported}
        />
      </FollowsContext.Provider>,
    );
  }

  afterEach(() => {
    forgetContest();
  });

  test("with a challenge open and «Everyone», it changes the choice", async () => {
    setContest({ account: null, contest: THEME });
    const onChoice = jest.fn();
    await form(FOR_EVERYONE, onChoice);
    const name = "Enter “Animals”";
    expect(screen.getByRole("switch", { name }).props.accessibilityState.checked).toBe(
      false,
    );
    await fireEvent.press(screen.getByRole("switch", { name }));
    expect(onChoice).toHaveBeenLastCalledWith({
      ...FOR_EVERYONE,
      entry: { contest: THEME.id, entered: true },
    });
  });

  test("not for «Followers» or «Only me»", async () => {
    setContest({ account: null, contest: THEME });
    await form({ ...NOT_CHOSEN, visibility: "followers" });
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("not for a run from a file of another app", async () => {
    setContest({ account: null, contest: THEME });
    await form(FOR_EVERYONE, jest.fn(), true);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("not without a theme, as with today's API", async () => {
    setContest({ account: null, contest: open as Contest });
    await form(FOR_EVERYONE);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("not on a phone that never heard of a contest", async () => {
    await form(FOR_EVERYONE);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
