import { render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StyleSheet, type TextStyle } from "react-native";

import { font, fontWeight } from "../theme/tokens";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileStats } from "./ProfileStats";

// The premium look, part D (TASK-339, ADR-0293): the name of a profile is
// a page's title, large and light; its totals light, in tabular digits; the
// account's controls and the two sheets answer the finger through `Tap`,
// and a sheet's top edge is one physical pixel of `color.hairline`.

function styleOf(text: string | RegExp): TextStyle {
  return StyleSheet.flatten(screen.getByText(text).props.style) as TextStyle;
}

function source(file: string): string {
  return readFileSync(join(__dirname, "..", file), "utf8");
}

test("the name of a profile is written as a page's title", async () => {
  await render(
    <ProfileHeader username="ada_runs" bio="" photo={null} detail="ada@x" />,
  );
  const name = styleOf("ada_runs");
  expect(name.fontSize).toBe(font.title.fontSize);
  expect(name.fontWeight).toBe(font.title.fontWeight);
  expect(name.letterSpacing).toBe(font.title.letterSpacing);
});

test("the totals are light, in tabular digits", async () => {
  await render(
    <ProfileStats totals={{ distance_m: 42_340, climb_m: 3215, reactions: 7 }} />,
  );
  // The number and its unit are one line: «3215 m».
  const climb = styleOf(/^3215 m$/);
  expect(climb.fontWeight).toBe(fontWeight.light);
  expect(climb.fontVariant).toEqual(["tabular-nums"]);
});

const TAPPED = [
  "profile/ProfileHeader.tsx",
  "profile/SettingsPage.tsx",
  "social/SuperLikeSheet.tsx",
  "messages/MessageSheet.tsx",
];

test.each(TAPPED)("%s answers the finger through Tap, not a pressed style", (file) => {
  const text = source(file);
  expect(text).toMatch(/<Tap\b/);
  expect(text).not.toMatch(/\(\{\s*pressed\s*\}\)\s*=>/);
  expect(text).not.toMatch(/styles\.\w*[pP]ressed\b/);
});

test.each(["social/SuperLikeSheet.tsx", "messages/MessageSheet.tsx"])(
  "%s has a hairline at the top of its sheet",
  (file) => {
    const text = source(file);
    expect(text).toMatch(
      /borderTopWidth: StyleSheet\.hairlineWidth,\s*borderColor: color\.hairline/,
    );
    expect(text).not.toMatch(/borderTopWidth: 1,\s*borderColor: color\.border/);
  },
);
