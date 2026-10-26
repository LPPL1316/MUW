import { Share } from "react-native";

import { saveLanguageChoice } from "../i18n/language";
import { inviteText, shareTeamCode } from "./shareCode";

const TEAM = { name: "Trento runners", code: "K7PQ2M" };

afterEach(() => {
  jest.restoreAllMocks();
  saveLanguageChoice("phone");
});

test("the share sheet opens with the team's name and code in a sentence", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: "sharedAction" });
  expect(await shareTeamCode(TEAM)).toBe(true);
  expect(share).toHaveBeenCalledWith({
    message:
      "Join my team «Trento runners» on MuW: open Play, Challenges, and enter the code K7PQ2M.",
  });
});

test("a phone that cannot open the sheet says so, without throwing", async () => {
  jest.spyOn(Share, "share").mockRejectedValue(new Error("no sheet"));
  expect(await shareTeamCode(TEAM)).toBe(false);
});

test("the sentence follows the app's language", () => {
  saveLanguageChoice("it");
  expect(inviteText(TEAM)).toBe(
    "Entra nella mia squadra «Trento runners» su MuW: apri Play, Sfide, e inserisci il codice K7PQ2M.",
  );
});
