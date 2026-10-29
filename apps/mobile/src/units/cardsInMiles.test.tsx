import type { DrawingDetail, RouteResult } from "@shaperoute/shared-types";
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import listed from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import fixture from "@shaperoute/shared-types/fixtures/route-result.json";
import activity from "@shaperoute/shared-types/fixtures/activity.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ActivityCard } from "../activities/ActivityCard";
import { runFacts } from "../activities/activityText";
import type { ActivityDetail } from "../api/activities";

import { CityExamples } from "../explore/CityExamples";
import { asRecommended, type Example, forgetExamples } from "../explore/exampleRoutes";
import { ExploreScreen } from "../explore/ExploreScreen";
import { forgetFeedMaps } from "../feed/FeedMaps";
import { FeedPost, postFacts } from "../feed/FeedPost";
import type { SamplePost } from "../feed/sampleFeed";
import { saveLanguageChoice } from "../i18n/language";
import { forgetWaterChoice, PaddleExplore } from "../paddle/PaddleExplore";
import type { Place } from "../places/photon";
import { CommentsContext, type CommentsDoor } from "../social/commentsDoor";
import { DrawingCard } from "../social/DrawingCard";
import { ReactionsContext, type ReactionsDoor } from "../social/reactionsDoor";
import { saveUnitsChoice } from "./units";

/**
 * What the cards and the texts left to part B write once «Settings» says
 * miles (TASK-182): the facts of a «Feed» post, a drawing opened from a
 * profile, «Explore» on the water, and the two sentences of «Explore» with
 * a distance of their own. In kilometres each one reads as before.
 */

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");

beforeEach(() => {
  forgetFeedMaps();
  forgetExamples();
  forgetWaterChoice();
});

afterEach(async () => {
  await act(async () => {
    saveUnitsChoice("phone");
    saveLanguageChoice("phone");
  });
});

const POST: SamplePost = {
  id: "firenze-dog_head-10000-4",
  user: "fede_km",
  title: "Dog walk, without the dog",
  city: "firenze",
  shape: "dog_head",
  route_m: 10514,
  minutes: 64,
  score: 92,
  line: [
    [43.77, 11.25],
    [43.77, 11.26],
    [43.78, 11.26],
    [43.77, 11.25],
  ],
};

test("a «Feed» post says its miles, at once", async () => {
  await render(<FeedPost post={POST} width={358} />);
  expect(
    screen.getByText("Dog head · 10.5 km · 1 h 04 min · 6:05 /km"),
  ).toBeOnTheScreen();
  await act(async () => saveUnitsChoice("mi"));
  expect(
    screen.getByText("Dog head · 6.5 mi · 1 h 04 min · 9:48 /mi"),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/ km /)).toBeNull();
  // On the water, the sport first; with the comma where the language has it.
  expect(
    postFacts({
      ...POST,
      shape: "moon",
      route_m: 2000,
      minutes: 24,
      activity: "paddling",
    }),
  ).toBe("Paddle · Moon · 1.2 mi · 24 min · 6:00 /500 m");
  await act(async () => saveLanguageChoice("it"));
  expect(postFacts(POST)).toMatch(/ · 6,5 mi · /);
  await act(async () => saveUnitsChoice("km"));
  expect(postFacts(POST)).toMatch(/ · 10,5 km · /);
});

test("a drawing opened from a profile says its miles, at once", async () => {
  const commentsDoor: CommentsDoor = {
    pageOf: jest.fn(async () => null),
    write: jest.fn(async () => null),
    remove: jest.fn(async () => null),
    photoOf: jest.fn(async () => null),
  };
  const reactionsDoor: ReactionsDoor = {
    of: jest.fn(async () => null),
    leave: jest.fn(async () => null),
    remove: jest.fn(async () => null),
  };
  await render(
    <CommentsContext.Provider value={commentsDoor}>
      <ReactionsContext.Provider value={reactionsDoor}>
        <DrawingCard drawing={drawing as DrawingDetail} onBack={jest.fn()} />
      </ReactionsContext.Provider>
    </CommentsContext.Provider>,
  );
  await act(async () => {});
  // 4004 m: as on the run's screen, two decimals and a point.
  expect(screen.getByText("4.00 km")).toBeOnTheScreen();
  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByText("2.49 mi")).toBeOnTheScreen();
  expect(screen.queryByText("4.00 km")).toBeNull();
});

test("a run of «My activities» open on the map says its miles, at once", async () => {
  const run = activity as ActivityDetail;
  await render(<ActivityCard activity={run} onList={jest.fn()} onDelete={jest.fn()} />);
  await act(async () => {});
  const inKm = runFacts(run);
  expect(inKm).toMatch(/^\d+\.\d\d km · /);
  expect(screen.getByText(inKm)).toBeOnTheScreen();
  await act(async () => saveUnitsChoice("mi"));
  const inMiles = runFacts(run);
  expect(inMiles).toMatch(/^\d+\.\d\d mi · .* \/mi$/);
  expect(screen.getByText(inMiles)).toBeOnTheScreen();
  expect(screen.queryByText(inKm)).toBeNull();
});

describe("«Explore» on the water", () => {
  const API = "http://api";
  const LEVICO_TERME: [number, number] = [46.0122, 11.2986];
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchSpy = jest.spyOn(globalThis, "fetch");
    // No route ever answers: the cards of a place come with the app.
    fetchSpy.mockImplementation(() => new Promise<Response>(() => {}));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  test("says how far the lake is in miles", async () => {
    await render(<PaddleExplore apiUrl={API} near={LEVICO_TERME} onOpen={jest.fn()} />);
    expect(screen.getByText(/^LAGO DI LEVICO · \d\.\d KM AWAY$/)).toBeOnTheScreen();
    await act(async () => saveUnitsChoice("mi"));
    expect(screen.getByText(/^LAGO DI LEVICO · \d\.\d MI AWAY$/)).toBeOnTheScreen();
    expect(screen.queryByText(/KM AWAY/)).toBeNull();
  });

  test("its cards say their miles, and read them out", async () => {
    await render(<PaddleExplore apiUrl={API} near={null} onOpen={jest.fn()} />);
    await fireEvent.press(screen.getByRole("button", { name: "Lago di Garda" }));
    // About 2 km each, whatever the examples that come with the app.
    expect(screen.getByLabelText(/^Heart, \d\.\d km, on the water$/)).toBeOnTheScreen();
    expect(screen.getByText(/^Heart · \d\.\d km$/)).toBeOnTheScreen();
    await act(async () => saveUnitsChoice("mi"));
    expect(screen.getByLabelText(/^Heart, 1\.\d mi, on the water$/)).toBeOnTheScreen();
    expect(screen.getByText(/^Heart · 1\.\d mi$/)).toBeOnTheScreen();
    expect(screen.queryByText(/ km$/)).toBeNull();
    expect(screen.queryByLabelText(/ km, on the water$/)).toBeNull();
    // The shore's kilometre is the engine's own: it stays as it is.
    expect(
      screen.getByText("Shapes to paddle, within 1 km of the shore"),
    ).toBeOnTheScreen();
  });
});

describe("the sentences of «Explore» with a distance of their own", () => {
  const vercelli: Place = {
    label: "Vercelli, Piedmont, Italy",
    point: [45.3252, 8.4228],
  };

  test("the examples of a city are asked at 5 km, 3.1 mi", async () => {
    const heart = asRecommended(vercelli, "heart", fixture as unknown as RouteResult);
    const examples: Example[] = [
      { shape: "heart", status: "ready", route: heart.route },
    ];
    await render(
      <CityExamples
        city={vercelli}
        examples={examples}
        onOpen={jest.fn()}
        onRetry={jest.fn()}
      />,
    );
    expect(
      screen.getByText(
        "No recommended routes here yet: shapes of 5 km from the centre, drawn now.",
      ),
    ).toBeOnTheScreen();
    await act(async () => saveUnitsChoice("mi"));
    expect(
      screen.getByText(
        "No recommended routes here yet: shapes of 3.1 mi from the centre, drawn now.",
      ),
    ).toBeOnTheScreen();
  });

  test("the routes near the start are within 5 km, 3.1 mi", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(listed));
    try {
      await render(
        <ExploreScreen
          apiUrl="http://api"
          near={[46.067, 11.1215]}
          onBack={jest.fn()}
          onOpen={jest.fn()}
        />,
      );
      expect(await screen.findByText("Star · 5.1 km")).toBeOnTheScreen();
      expect(screen.getByText("Starting within 5 km of your start")).toBeOnTheScreen();
      await act(async () => saveUnitsChoice("mi"));
      expect(
        screen.getByText("Starting within 3.1 mi of your start"),
      ).toBeOnTheScreen();
    } finally {
      fetchMock.mockRestore();
    }
  });
});
