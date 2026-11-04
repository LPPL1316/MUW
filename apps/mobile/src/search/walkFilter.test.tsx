import { render, screen } from "@testing-library/react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { activityOffered, ALL_SPORTS } from "../settings/sport";
import { FilterSheet } from "./FilterSheet";
import { NO_FILTERS, SEARCH_ACTIVITIES } from "./searchFilters";

// TASK-371: «Walk» is «Soon» until the server walks, and the search's filter
// waits for it too: a filter the app shows never gets a 422.

const INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

test("a walk is not offered until «Walk» is ready, every other sport is", () => {
  expect(ALL_SPORTS.find((sport) => sport.id === "walk")?.ready).toBe(false);
  expect(activityOffered("walking")).toBe(false);
  expect(SEARCH_ACTIVITIES).not.toContain("walking");
  expect(SEARCH_ACTIVITIES).toEqual(["running", "cycling", "paddling", "swimming"]);
  const ready = ALL_SPORTS.map((sport) =>
    sport.id === "walk" ? { ...sport, ready: true } : sport,
  );
  expect(activityOffered("walking", ready)).toBe(true);
  expect(activityOffered("running", ALL_SPORTS)).toBe(true);
});

test("the filters' sheet has no «Walk» while it is «Soon»", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={INSETS}>
      <FilterSheet visible filters={NO_FILTERS} onApply={() => {}} onClose={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
  expect(screen.getByTestId("filter-activity-running")).toBeOnTheScreen();
  expect(screen.queryByTestId("filter-activity-walking")).toBeNull();
});
