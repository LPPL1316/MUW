import skiNames from "@shaperoute/shared-types/fixtures/ski-names.json";
import type { SkiNames } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { translate } from "../i18n/translate";
import { DrawingsContext, useDrawingsDoor } from "./drawingsDoor";
import { SkiNamesList, spokenOf } from "./SkiNamesList";

// «Lifts and pistes» on the post of a day of skiing (TASK-375 part D).

const NAMES = skiNames as SkiNames;
const ID = "0b8f8a1e-7c1d-4d2a-9f3e-2a6c5b4d3e21";

function List({ names }: { names: jest.Mock }) {
  const nothing = useDrawingsDoor();
  return (
    <DrawingsContext.Provider value={{ ...nothing, skiNamesOf: names }}>
      <SkiNamesList drawingId={ID} />
    </DrawingsContext.Provider>
  );
}

test("the lifts, then the pistes, each with how many times", async () => {
  const names = jest.fn(async () => NAMES);
  await render(<List names={names} />);
  expect(names).toHaveBeenCalledWith(ID);
  expect(await screen.findByText("Lifts and pistes")).toBeOnTheScreen();
  const rows = [
    "Seggiovia Col Raiser ×3",
    "Ciampinoi ×1",
    "Pista Rossa ×2",
    "Gran Risa ×1",
  ];
  for (const row of rows) {
    expect(screen.getByText(row)).toBeOnTheScreen();
  }
  // VoiceOver does not read «×».
  expect(screen.getByLabelText("Seggiovia Col Raiser, 3 times")).toBeOnTheScreen();
  expect(screen.getByLabelText("Ciampinoi, once")).toBeOnTheScreen();
});

test("a day without names shows nothing", async () => {
  const names = jest.fn(async () => ({ lifts: [], pistes: [] }));
  await render(<List names={names} />);
  expect(names).toHaveBeenCalled();
  expect(screen.queryByText("Lifts and pistes")).toBeNull();
});

test("when the API does not give them, nothing shows", async () => {
  const names = jest.fn(async () => null);
  await render(<List names={names} />);
  expect(names).toHaveBeenCalled();
  expect(screen.queryByText("Lifts and pistes")).toBeNull();
});

test("the approved texts, in Italian", () => {
  expect(translate("it", "Lifts and pistes")).toBe("Impianti e piste");
  expect(
    translate("it", "{name}, {times} times", { name: "Pista Rossa", times: 2 }),
  ).toBe("Pista Rossa, 2 volte");
  expect(translate("it", "{name}, once", { name: "Ciampinoi" })).toBe(
    "Ciampinoi, una volta",
  );
  expect(spokenOf({ name: "Gran Risa", type: "", times: 1 })).toBe("Gran Risa, once");
});
