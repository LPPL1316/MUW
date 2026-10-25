/**
 * The Feed's maps in the app's language (TASK-210, part H): the page names
 * the places as the app's map does, and a new language in «Settings» asks
 * for new pictures, kept apart from those in the language before. The rest
 * is in FeedMaps.test.tsx.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { saveLanguageChoice } from "../i18n/language";
import { buildFeedMapPage } from "./feedMapPage";
import { FeedMapShooter, forgetFeedMaps, useFeedMap } from "./FeedMaps";

jest.mock("expo-file-system");
jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

// An «L» in Firenze.
const LINE: LatLon[] = [
  [43.78, 11.25],
  [43.77, 11.25],
  [43.77, 11.257],
];
const PICTURE = "data:image/jpeg;base64,AAAA";
const IN_ITALIAN = "data:image/jpeg;base64,CCCC";

function Drawing() {
  const map = useFeedMap("a", LINE, 358, 222, 24);
  return <Text>{map ?? "no map"}</Text>;
}

function page() {
  return screen.getByTestId("feed-map-page", { includeHiddenElements: true });
}

function pagePosts(message: object) {
  return fireEvent(page(), "message", {
    nativeEvent: { data: JSON.stringify(message) },
  });
}

/** What the page was asked last. */
function asked(): Record<string, unknown> {
  const script = injectJavaScript.mock.calls.at(-1)?.[0] ?? "{}";
  return JSON.parse(script.slice(script.indexOf("{"), script.lastIndexOf("}") + 1));
}

beforeEach(() => {
  forgetFeedMaps();
  injectJavaScript.mockClear();
});

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("the page names the places in the language it is made for", () => {
  expect(buildFeedMapPage("de")).toContain('"name:de"');
  expect(buildFeedMapPage("de")).not.toContain('"name:en"');
  expect(buildFeedMapPage("en")).toContain('"name:en"');
});

test("a new language makes the page again and asks the picture in it", async () => {
  await render(
    <>
      <FeedMapShooter width={358} height={222} />
      <Drawing />
    </>,
  );
  expect(page().props.source.html).toContain('"name:en"');
  await pagePosts({ type: "ready" });
  expect(asked()).toMatchObject({ type: "shoot", key: "a:358x222" });
  await pagePosts({ type: "shot", key: "a:358x222", image: PICTURE });
  expect(screen.getByText(PICTURE)).toBeOnTheScreen();

  await act(async () => saveLanguageChoice("it"));
  // The English picture does not stand in for the Italian one.
  expect(screen.getByText("no map")).toBeOnTheScreen();
  expect(page().props.source.html).toContain('"name:it"');
  await pagePosts({ type: "ready" });
  expect(asked()).toMatchObject({ type: "shoot", key: "a:358x222/it" });
  await pagePosts({ type: "shot", key: "a:358x222/it", image: IN_ITALIAN });
  expect(screen.getByText(IN_ITALIAN)).toBeOnTheScreen();

  // Back to English, the picture taken before is still there.
  await act(async () => saveLanguageChoice("en"));
  expect(screen.getByText(PICTURE)).toBeOnTheScreen();
});
