import done from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { FeedMapShooter, forgetFeedMaps } from "../feed/FeedMaps";

import { cardMapsCredit } from "./RouteCard";
import type { ThemedIdea } from "./themedIdeas";
import { IdeasFromEurope, SEEN_AT_FIRST, wantsMap } from "./IdeasFromEurope";
import type { ThemedResult } from "./themedRoutes";

jest.mock("react-native-webview");

const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const result = done.result as ThemedResult;

/** The maps the page was asked to take, in order. */
function shots(): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]) => /receive\((.*)\); true;$/.exec(String(script))?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === "shoot");
}

beforeEach(() => {
  forgetFeedMaps();
  injectJavaScript.mockClear();
});
const idea = (city: string, category: string, shape: string): ThemedIdea => ({
  id: `${city}-${category}-${shape}`,
  city,
  category,
  text: `${category} ${shape} 8 km`,
  preview: [
    [41.89, 12.49],
    [41.891, 12.491],
    [41.89, 12.49],
  ],
  result: { ...result, shape, city, distance_m: 8123 },
});
const IDEAS = [
  idea("Rome", "Famous Places", "star"),
  idea("Paris", "Best Views", "heart"),
];

test("a row of cards, each the city, its shape, its category and its length", async () => {
  const onIdea = jest.fn();
  await render(<IdeasFromEurope width={350} onIdea={onIdea} ideas={IDEAS} />);
  expect(screen.getByText("IDEAS FROM EUROPE")).toBeOnTheScreen();
  const row = within(screen.getByTestId("themed-ideas"));
  expect(row.getAllByRole("button")).toHaveLength(2);
  expect(row.getByText("Rome · Star")).toBeOnTheScreen();
  expect(row.getByText("Famous Places · 8.1 km")).toBeOnTheScreen();
  expect(row.getByText("Paris · Heart")).toBeOnTheScreen();
  // The maps under the lines say whose they are, and the places theirs.
  expect(screen.getByText(cardMapsCredit())).toBeOnTheScreen();
  expect(screen.getByText("© OpenStreetMap contributors")).toBeOnTheScreen();

  await fireEvent.press(row.getByLabelText("Paris, Heart, Best Views, 8.1 km"));
  expect(onIdea).toHaveBeenCalledWith(IDEAS[1]);
});

test("without ideas there is nothing", async () => {
  await render(<IdeasFromEurope width={350} onIdea={jest.fn()} ideas={[]} />);
  expect(screen.queryByText("IDEAS FROM EUROPE")).toBeNull();
});

test("only the cards in sight ask for their maps, and none before the page's routes", () => {
  expect(SEEN_AT_FIRST).toBe(3);
  expect([0, 1, 2, 3, 11].map((i) => wantsMap(i, true, false))).toEqual([
    true,
    true,
    true,
    false,
    false,
  ]);
  // The row slid: every card is in sight sooner or later.
  expect(wantsMap(11, true, true)).toBe(true);
  // The routes of the page are loading: theirs go first.
  expect(wantsMap(0, false, true)).toBe(false);
});

test("in the app, three maps are asked at first, the others once the row slides", async () => {
  const many = ["Rome", "Paris", "London", "Barcelona", "Lisbon"].map((city, i) => ({
    ...idea(city, "Famous Places", "star"),
    // Each its own line, so each its own map.
    preview: [
      [41.89 + i, 12.49],
      [41.891 + i, 12.491],
      [41.89 + i, 12.49],
    ] as ThemedIdea["preview"],
  }));
  await render(
    <>
      <FeedMapShooter width={718} height={445} />
      <IdeasFromEurope width={350} onIdea={jest.fn()} ideas={many} />
    </>,
  );
  /** Every map asked for until none is left: each given up on at once. The
   * page that takes them is there only while one is wanted. */
  const asked = async (): Promise<Set<string>> => {
    const page = screen.getByTestId("feed-map-page", { includeHiddenElements: true });
    await fireEvent(page, "message", { nativeEvent: { data: '{"type":"ready"}' } });
    const keys = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const last = shots().at(-1);
      if (last === undefined || keys.has(String(last.key))) {
        break;
      }
      keys.add(String(last.key));
      await fireEvent(page, "message", {
        nativeEvent: { data: JSON.stringify({ type: "miss", key: last.key }) },
      });
    }
    return keys;
  };
  expect((await asked()).size).toBe(SEEN_AT_FIRST);
  await fireEvent.scroll(screen.getByTestId("themed-ideas"), {
    nativeEvent: { contentOffset: { x: 200, y: 0 } },
  });
  expect((await asked()).size).toBe(many.length - SEEN_AT_FIRST);
  expect(new Set(shots().map((shot) => shot.key)).size).toBe(many.length);
});
