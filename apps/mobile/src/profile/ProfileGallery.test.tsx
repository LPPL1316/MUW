import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import userPhotos from "@shaperoute/shared-types/fixtures/user-photos.json";
import type { UserPhoto, UserPhotosPage } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { answers, apiError } from "../account/testing";
import { dayLabel } from "../activities/activityText";
import { DrawingsContext, type DrawingsDoor } from "../social/drawingsDoor";
import { ProfileGallery } from "./ProfileGallery";

// «Drawings» and «Photos» on a profile (TASK-305): the photos are asked for
// the first time «Photos» is touched, and a tap opens the drawing of one.

const URL = "http://api";
const ID = publicProfile.public_id;
const TOKEN = session.token;
const PAGE = userPhotos as UserPhotosPage;
const [FIRST, SECOND, THIRD] = PAGE.photos;

function door() {
  const open = jest.fn();
  const value: DrawingsDoor = {
    publicKeys: new Set(),
    refreshMine: () => {},
    choiceOf: async () => null,
    choose: async () => null,
    photosOf: () => [],
    keepPhotoOf: () => false,
    removePhotoOf: () => {},
    photoSource: () => null,
    pageOf: async () => ({ kind: "ok", value: { drawings: [], next: null, total: 0 } }),
    opening: null,
    openProblem: null,
    open,
    opened: null,
    back: () => {},
  };
  return { value, open };
}

async function show(
  fetchFn: jest.Mock,
  { own = false, photos = true }: { own?: boolean; photos?: boolean } = {},
) {
  const { value, open } = door();
  const onSessionEnded = jest.fn();
  await render(
    <DrawingsContext.Provider value={value}>
      <ProfileGallery
        publicId={ID}
        own={own}
        photos={photos}
        apiUrl={URL}
        token={TOKEN}
        onSessionEnded={onSessionEnded}
        fetchFn={fetchFn}
        apiKey={null}
      />
    </DrawingsContext.Provider>,
  );
  return { open, onSessionEnded };
}

function page(photos: UserPhoto[], next: string | null = null) {
  return { status: 200, body: { photos, next } };
}

test("the drawings first; the photos only once «Photos» is touched", async () => {
  const fetchFn = answers(page(PAGE.photos));
  await show(fetchFn);
  expect(await screen.findByText("No drawings yet.")).toBeOnTheScreen();
  // The tab says «Drawings»: no title over the grid.
  expect(screen.queryByRole("header", { name: "Drawings" })).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  expect(await screen.findAllByTestId("photo-cell")).toHaveLength(3);
  expect(screen.getByRole("tab", { name: "Photos", selected: true })).toBeOnTheScreen();
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${URL}/users/${ID}/photos`);
  expect(init).toMatchObject({
    method: "GET",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  // Back to «Drawings» and to «Photos» again: not asked twice.
  await fireEvent.press(screen.getByRole("tab", { name: "Drawings" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  expect(screen.getAllByTestId("photo-cell")).toHaveLength(3);
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("each photo is read with the token, and opens its drawing", async () => {
  const { open } = await show(answers(page(PAGE.photos)));
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  const [cell] = await screen.findAllByTestId("photo-cell");
  expect(screen.getAllByTestId("photo-image")[0]).toHaveProp("source", {
    uri: `${URL}${FIRST.url}`,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(cell).toHaveProp(
    "accessibilityLabel",
    "Sunday heart by the river, open on the map",
  );
  // A photo of a drawing without a title is named by its day.
  expect(
    screen.getByRole("button", {
      name: `${dayLabel(THIRD.started_at)}, open on the map`,
    }),
  ).toBeOnTheScreen();
  await fireEvent.press(cell);
  expect(open).toHaveBeenCalledWith({ id: FIRST.drawing_id });
});

test("«Show more» brings the next page, without a photo twice", async () => {
  const fetchFn = answers(page([FIRST, SECOND], "cursor-1"), page([SECOND, THIRD]));
  await show(fetchFn);
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  expect(await screen.findAllByTestId("photo-cell")).toHaveLength(2);
  await fireEvent.press(screen.getByRole("button", { name: "Show more" }));
  expect(await screen.findAllByTestId("photo-cell")).toHaveLength(3);
  expect(fetchFn.mock.calls[1][0]).toBe(`${URL}/users/${ID}/photos?cursor=cursor-1`);
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("without photos the tab says so, on one's own how to add them", async () => {
  await show(answers(page([])));
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  expect(await screen.findByText("No photos yet.")).toBeOnTheScreen();
  await show(answers(page([])), { own: true });
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  expect(
    await screen.findByText(
      "No photos yet. Add some to a public drawing in My activities.",
    ),
  ).toBeOnTheScreen();
});

test("photos that did not come say why, and «Try again» asks again", async () => {
  const fetchFn = answers(new Error("no network"), page([FIRST]));
  await show(fetchFn);
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findAllByTestId("photo-cell")).toHaveLength(1);
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

test("a session ended while asking is said to the account", async () => {
  const fetchFn = answers({ status: 401, body: apiError("not_signed_in") });
  const { onSessionEnded } = await show(fetchFn);
  await fireEvent.press(screen.getByRole("tab", { name: "Photos" }));
  await screen.findByRole("button", { name: "Try again" });
  expect(onSessionEnded).toHaveBeenCalledWith(TOKEN);
});

test("with an API older than TASK-305, the drawings alone, as before", async () => {
  const fetchFn = jest.fn();
  await show(fetchFn, { photos: false });
  expect(await screen.findByRole("header", { name: "Drawings" })).toBeOnTheScreen();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});
