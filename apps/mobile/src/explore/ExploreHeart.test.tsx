import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MIN_TAP_SIZE } from "../theme/tokens";
import { ExploreScreen } from "./ExploreScreen";

// The heart on yellow at the top of «Explore», under the button of
// «Profile» (TASK-222, ADR-0184). In a file of its own, as
// ExploreMoreShapes.test.tsx says why.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

/** A part of the rendered page, as `screen.toJSON()` gives it. */
type Rendered = string | { props: { testID?: unknown }; children: Rendered[] | null };

/** The texts and the heart, in the order they are laid out, top to bottom. */
function inOrder(node: Rendered | Rendered[] | null) {
  const found: string[] = [];
  const walk = (each: typeof node) => {
    if (each === null) {
      return;
    }
    if (typeof each === "string") {
      found.push(each);
      return;
    }
    if (Array.isArray(each)) {
      each.forEach(walk);
      return;
    }
    if (each.props.testID === "heart-badge") {
      found.push("heart-badge");
      return;
    }
    (each.children ?? []).forEach(walk);
  };
  walk(node);
  return found;
}

async function renderExplore() {
  // No API and no start: the page has only its header and a note.
  await render(<ExploreScreen apiUrl={null} near={null} onOpen={jest.fn()} />);
}

test("the heart on yellow is at the right of «Best near you», before the list", async () => {
  await renderExplore();
  const order = inOrder(screen.toJSON());
  const heart = order.indexOf("heart-badge");
  expect(heart).toBeGreaterThan(order.indexOf("Best near you"));
  expect(order[heart - 1]).toMatch(/^Starting within /);
  expect(order[heart + 1]).toMatch(/^Choose a start first/);
});

test("it is as wide as the button of «Profile» above it", async () => {
  await renderExplore();
  const badge = screen.getByTestId("heart-badge", { includeHiddenElements: true });
  expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
  });
});

test("only a picture: VoiceOver does not find it, and nothing is pressed", async () => {
  await renderExplore();
  expect(screen.queryByTestId("heart-badge")).toBeNull();
  // The only button is the search at the top (TASK-367 part B).
  expect(
    screen.queryAllByRole("button").map((button) => button.props.accessibilityLabel),
  ).toEqual(["Search"]);
});
