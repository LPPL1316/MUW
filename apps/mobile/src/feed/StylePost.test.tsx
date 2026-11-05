/**
 * A MuW Style post (TASK-384, ADR-0326): MuW as the author, the two labels
 * always under the photo, a dot on each product that opens its sheet with
 * the price or «See price», the two fixed lines and «Shop», which counts and
 * opens the page in the phone's browser.
 */
import post from "@shaperoute/shared-types/fixtures/style-post.json";
import type { StylePost as Post } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Linking } from "react-native";

import { FollowsContext } from "../social/followsDoor";
import { StylePost } from "./StylePost";
import { StyleProductSheet } from "./StyleProductSheet";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const API = "http://api";
const POST = post as Post;
const [JACKET, SHOES] = POST.tags;
const SHOP_PAGE = "https://www.zalando.it/asics-road-packable-jacket.html";

let fetchSpy: jest.SpiedFunction<typeof fetch>;

function Around({ children }: { children: ReactNode }) {
  return (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: {
          state: { status: "signedOut", notice: null },
          sessionEnded: () => {},
        },
        openProfile: () => {},
      }}
    >
      {children}
    </FollowsContext.Provider>
  );
}

beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/shop")) {
      return Response.json({ url: SHOP_PAGE });
    }
    return new Response(null, { status: 204 });
  });
});

afterEach(() => fetchSpy.mockRestore());

function posted(): string[] {
  return fetchSpy.mock.calls.map(([url]) => String(url).replace(API, ""));
}

test("MuW, the title, the photo, a dot for each product and the two labels", async () => {
  await render(<StylePost post={POST} width={300} />, { wrapper: Around });
  expect(screen.getByText("MuW")).toBeOnTheScreen();
  expect(screen.getByText("Rainy 10K")).toBeOnTheScreen();
  expect(screen.getByTestId("style-photo").props.source).toEqual({
    uri: `${API}/style/MS-001/image`,
    headers: {},
  });
  expect(screen.getByTestId(`style-dot-${JACKET.id}`)).toBeOnTheScreen();
  expect(screen.getByTestId(`style-dot-${SHOES.id}`)).toBeOnTheScreen();
  expect(screen.getByText("AI-generated")).toBeOnTheScreen();
  expect(screen.getByText("Ad · Affiliate links")).toBeOnTheScreen();
  // Nothing is counted until a product is opened.
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("a dot sits on its product: x and y of the photo, 4:5", async () => {
  await render(<StylePost post={POST} width={300} />, { wrapper: Around });
  const style = Object.assign(
    {},
    ...[screen.getByTestId("style-dot-1").props.style].flat(),
  );
  // The finger's 44 points are centred on the dot.
  expect(style.left).toBeCloseTo(0.52 * 300 - 22);
  expect(style.top).toBeCloseTo(0.34 * 375 - 22);
});

test("a dot opens the product, counted once for the day", async () => {
  await render(<StylePost post={POST} width={300} />, { wrapper: Around });
  await fireEvent.press(screen.getByTestId("style-dot-1"));
  expect(await screen.findByText(JACKET.product_name)).toBeOnTheScreen();
  expect(screen.getByTestId("style-price")).toHaveTextContent(
    "€84.99 on 18 Nov · Zalando",
  );
  expect(
    screen.getByText(
      "The photo is AI-generated: the item shown is similar, not the exact product.",
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(
      "If you buy through this link, MuW earns a commission. The price for you stays the same.",
    ),
  ).toBeOnTheScreen();
  await waitFor(() => expect(posted()).toEqual(["/style/tags/1/open"]));
});

test("a price read long ago says «See price»", async () => {
  await render(<StylePost post={POST} width={300} />, { wrapper: Around });
  await fireEvent.press(screen.getByTestId("style-dot-2"));
  expect(await screen.findByTestId("style-price")).toHaveTextContent(
    "See price · Zalando",
  );
});

test("«Shop» counts and opens the page the API answers, in the browser", async () => {
  const openUrl = jest.fn(() => Promise.resolve(true));
  await render(
    <StyleProductSheet
      tag={JACKET}
      apiUrl={API}
      onClose={() => {}}
      openUrl={openUrl}
    />,
  );
  await fireEvent.press(screen.getByText("Shop on Zalando"));
  await waitFor(() => expect(openUrl).toHaveBeenCalledWith(SHOP_PAGE));
  expect(posted()).toEqual(["/style/tags/1/open", "/style/tags/1/shop"]);
});

test("the browser of the phone, never a page inside the app", async () => {
  const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render(<StyleProductSheet tag={JACKET} apiUrl={API} onClose={() => {}} />);
  await fireEvent.press(screen.getByText("Shop on Zalando"));
  await waitFor(() => expect(spy).toHaveBeenCalledWith(SHOP_PAGE));
  spy.mockRestore();
});

test("without an answer from the API nothing is opened", async () => {
  fetchSpy.mockImplementation(async () => Response.json({}, { status: 404 }));
  const openUrl = jest.fn(() => Promise.resolve(true));
  await render(
    <StyleProductSheet
      tag={JACKET}
      apiUrl={API}
      onClose={() => {}}
      openUrl={openUrl}
    />,
  );
  await fireEvent.press(screen.getByText("Shop on Zalando"));
  await waitFor(() => expect(posted()).toContain("/style/tags/1/shop"));
  expect(openUrl).not.toHaveBeenCalled();
});

test("a touch outside closes the sheet", async () => {
  const onClose = jest.fn();
  await render(<StyleProductSheet tag={JACKET} apiUrl={API} onClose={onClose} />);
  await fireEvent.press(screen.getByTestId("style-sheet-backdrop"));
  expect(onClose).toHaveBeenCalled();
});
