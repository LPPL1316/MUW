import activities from "@shaperoute/shared-types/fixtures/activities.json";
import imported from "@shaperoute/shared-types/fixtures/activities-imported.json";
import recorded from "@shaperoute/shared-types/fixtures/activity.json";
import importedRun from "@shaperoute/shared-types/fixtures/activity-imported.json";
import drawing from "@shaperoute/shared-types/fixtures/drawing-details.json";
import importedDrawing from "@shaperoute/shared-types/fixtures/drawing-details-imported.json";
import feed from "@shaperoute/shared-types/fixtures/feed.json";
import importedFeed from "@shaperoute/shared-types/fixtures/feed-imported.json";
import type { DrawingDetail, FeedPost as Post } from "@shaperoute/shared-types";
import { act, render, screen } from "@testing-library/react-native";

import { ActivitiesList } from "../activities/ActivitiesList";
import {
  ActivitiesContext,
  type ActivitiesDoor,
  useActivitiesDoor,
} from "../activities/activitiesDoor";
import { ActivityCard } from "../activities/ActivityCard";
import {
  type ActivitiesPage,
  type ActivityDetail,
  isActivitiesPage,
  isActivityDetail,
  isImported,
} from "../api/activities";
import { postFacts } from "../feed/FeedPost";
import { isImportedPost, shownPost } from "../feed/feedPosts";
import { CommentsContext, type CommentsDoor } from "../social/commentsDoor";
import { DrawingCard } from "../social/DrawingCard";
import { ReactionsContext, type ReactionsDoor } from "../social/reactionsDoor";
import { StravaContext, type StravaState } from "../strava/useStrava";

// «Imported» wherever an activity added from a file shows (TASK-312): its
// row and its card in «My activities», the facts of its «Feed» card, its
// drawing opened; and
// its card has no «Send to Strava». Runs recorded with MuW, and the
// answers of an API before part A, read as before.

jest.mock("expo-file-system");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native-webview");

const CONNECTED: StravaState = {
  status: { available: true, connected: true, athlete: "Ada" },
  busy: null,
  problem: null,
  ensure: () => {},
  connect: () => {},
  disconnect: () => {},
  activityOf: async () => ({
    kind: "ok",
    value: { status: "not_sent", url: null },
    http: 200,
  }),
  send: async () => null,
};

describe("the API's answers", () => {
  it("say where a run comes from, and an API before part A says nothing", () => {
    expect(isActivitiesPage(imported)).toBe(true);
    expect(isActivityDetail(importedRun)).toBe(true);
    const page = imported as ActivitiesPage;
    expect(isImported(page.activities[0])).toBe(true);
    expect(isImported((activities as ActivitiesPage).activities[0])).toBe(false);
    expect(isImported({ source: "muw" })).toBe(false);
  });
});

describe("a row of «My activities»", () => {
  async function list(page: unknown) {
    function WithDoor() {
      const nothing = useActivitiesDoor();
      const door: ActivitiesDoor = {
        ...nothing,
        signedIn: true,
        status: "ready",
        list: (page as ActivitiesPage).activities,
      };
      return (
        <ActivitiesContext.Provider value={door}>
          <ActivitiesList />
        </ActivitiesContext.Provider>
      );
    }
    await render(<WithDoor />);
  }

  it("of an imported run says «Imported»", async () => {
    await list(imported);
    expect(screen.getByTestId("imported-mark")).toHaveTextContent("Imported");
  });

  it("of a run recorded with MuW does not", async () => {
    await list(activities);
    expect(screen.getAllByTestId("activity-row").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("imported-mark")).toBeNull();
  });
});

describe("the card of a run opened", () => {
  async function card(run: unknown) {
    await render(
      <StravaContext.Provider value={CONNECTED}>
        <ActivityCard
          activity={run as ActivityDetail}
          onList={jest.fn()}
          onDelete={jest.fn()}
        />
      </StravaContext.Provider>,
    );
    // What Strava has of it, asked once the card shows.
    await act(async () => {});
  }

  it("of an imported run says «Imported», with no «Send to Strava»", async () => {
    await card(importedRun);
    expect(screen.getByTestId("imported-mark")).toBeTruthy();
    expect(screen.queryByText("Send to Strava")).toBeNull();
  });

  it("of a run recorded with MuW has «Send to Strava» as before", async () => {
    await card(recorded);
    expect(screen.queryByTestId("imported-mark")).toBeNull();
    expect(screen.getByText("Send to Strava")).toBeTruthy();
  });
});

describe("the facts of a «Feed» card", () => {
  it("begin with «Imported» for an imported run", () => {
    const post = shownPost((importedFeed.posts as unknown as Post[])[0]);
    expect(isImportedPost(post)).toBe(true);
    expect(postFacts(post)).toMatch(/^Imported · /);
  });

  it("are as before for a run recorded with MuW, and for an example", () => {
    const post = shownPost((feed.posts as unknown as Post[])[0]);
    expect(isImportedPost(post)).toBe(false);
    expect(postFacts(post)).not.toContain("Imported");
    const { drawing: _drawing, ...example } = post;
    expect(isImportedPost(example)).toBe(false);
  });
});

describe("a drawing opened", () => {
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

  async function opened(shown: unknown) {
    await render(
      <CommentsContext.Provider value={commentsDoor}>
        <ReactionsContext.Provider value={reactionsDoor}>
          <DrawingCard drawing={shown as DrawingDetail} onBack={jest.fn()} />
        </ReactionsContext.Provider>
      </CommentsContext.Provider>,
    );
    await act(async () => {});
  }

  it("of an imported run says «Imported»", async () => {
    await opened(importedDrawing);
    expect(screen.getByTestId("imported-mark")).toHaveTextContent("Imported");
  });

  it("of a run recorded with MuW does not", async () => {
    await opened(drawing);
    expect(screen.queryByTestId("imported-mark")).toBeNull();
  });
});
