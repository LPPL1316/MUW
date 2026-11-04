import { readFileSync } from "node:fs";
import { join } from "node:path";

// The premium look, part C2 (TASK-339, ADR-0293): in the files it freed, no
// control keeps the flat `pressed && styles.pressed` look of before (they
// answer the finger through `Tap`), and no division is drawn in `color.border`
// any more: a divider is `Hairline`, a row's edge one physical pixel of
// `color.hairline`. The source is what is checked, so a `pressed` look that
// comes back is caught wherever it is put.

const FILES = [
  "about/AboutRows.tsx",
  "activities/ActivitiesList.tsx",
  "engine/OfflineMapsSetting.tsx",
  "explore/AskForRoute.tsx",
  "explore/CityExamples.tsx",
  "explore/ExploreTools.tsx",
  "explore/StopPhotos.tsx",
  "game/PlayRow.tsx",
  "imports/AddPastActivity.tsx",
  "map/MapKindButton.tsx",
  "paddle/PaddleExplore.tsx",
  "places/PlaceSearch.tsx",
  "profile/PhotoChoices.tsx",
  "profile/PhotoRow.tsx",
  "profile/ProfileGallery.tsx",
  "screens/ForgotPassword.tsx",
  "settings/ContactField.tsx",
  "settings/EmailSetting.tsx",
  "settings/LanguageSetting.tsx",
  "settings/PhoneSetting.tsx",
  "settings/SportButton.tsx",
  "settings/SportSetting.tsx",
  "settings/ToneSetting.tsx",
  "settings/UnitsSetting.tsx",
  "social/BlockedPeople.tsx",
  "social/ContactsFriends.tsx",
  "social/DrawingsGrid.tsx",
  "social/FollowButton.tsx",
  "social/FollowLists.tsx",
  "social/PeopleSearch.tsx",
  "social/ReportMenu.tsx",
  "strava/StravaSetting.tsx",
  "tour/GuideRow.tsx",
  "voice/VoiceSetting.tsx",
];

/** A `style` that reads the press: the look `Tap` replaces. */
const PRESS_LOOK = /\(\{\s*pressed\s*\}\)\s*=>/;
/** A press style by any name: `styles.pressed`, `styles.rowPressed`. */
const PRESS_STYLE = /styles\.\w*[pP]ressed\b/;
/** A divider view drawn in `color.border`. */
const BORDER_DIVIDER =
  /height: StyleSheet\.hairlineWidth,[^}]*backgroundColor: color\.border/s;
/** A row's edge drawn in `color.border`: 1 pt or a hairline. */
const BORDER_EDGE =
  /border(Top|Bottom)Width: (?:1|StyleSheet\.hairlineWidth),\s*border\1Color: color\.border/;

function source(file: string): string {
  return readFileSync(join(__dirname, "..", file), "utf8");
}

test.each(FILES)("%s answers the finger through Tap, not a pressed style", (file) => {
  const text = source(file);
  expect(text).not.toMatch(PRESS_LOOK);
  expect(text).not.toMatch(PRESS_STYLE);
});

test.each(FILES)("%s draws no division in color.border", (file) => {
  const text = source(file);
  expect(text).not.toMatch(BORDER_DIVIDER);
  expect(text).not.toMatch(BORDER_EDGE);
});

test("every file of the part is still there", () => {
  for (const file of FILES) {
    expect(() => source(file)).not.toThrow();
  }
});
