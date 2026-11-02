import { fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { feedTabName, FeedTabs } from "./FeedTabs";

afterEach(() => saveLanguageChoice("en"));

test("two tabs, the chosen one said to the screen reader, each choosing itself", async () => {
  const onChoose = jest.fn();
  await render(<FeedTabs tab="following" onChoose={onChoose} />);
  expect(
    screen.getByRole("button", { name: "Following", selected: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "All", selected: false }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("All"));
  expect(onChoose).toHaveBeenCalledWith("all");
});

test("«Following» is the approved name of the tab, not the Follow button's", () => {
  const names = (["en", "it", "de", "fr", "es"] as const).map((language) => {
    saveLanguageChoice(language);
    return [feedTabName("all"), feedTabName("following")];
  });
  expect(names).toEqual([
    ["All", "Following"],
    ["Tutti", "Seguiti"],
    ["Alle", "Folge ich"],
    ["Tous", "Suivis"],
    ["Todos", "Siguiendo"],
  ]);
});
