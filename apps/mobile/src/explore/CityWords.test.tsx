import type { RouteResult } from "@shaperoute/shared-types";
import penUpFixture from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Place } from "../places/photon";
import { CityWords } from "./CityWords";
import { asWord, type WordExample } from "./exampleRoutes";
import { type Explored, optionsOf } from "./explored";
import { ExploredCard } from "./ExploredCard";
import { cardMapsCredit } from "./RouteCard";

// The row of a city's words in «Explore», and a word opened on the map
// (TASK-279).

const vercelli: Place = {
  label: "Vercelli, Piedmont, Italy",
  point: [45.3252, 8.4228],
};
const written = penUpFixture as unknown as RouteResult;
const run = asWord(vercelli, "RUN", written);
const km = (written.distance_m / 1000).toFixed(1);

test("no word drawn or on its way: no row", async () => {
  const words: WordExample[] = [
    { word: "CIAO", status: "waiting" },
    { word: "LOVE", status: "failed", message: "no" },
  ];
  await render(<CityWords words={words} width={360} onOpen={jest.fn()} credit />);
  expect(screen.queryByText("WORDS")).toBeNull();
  expect(screen.queryAllByTestId("route-card")).toHaveLength(0);
});

test("the words that came out and the one being written; a tap opens it", async () => {
  const onOpen = jest.fn();
  const words: WordExample[] = [
    { word: "CIAO", status: "failed", message: "no" },
    { word: "RUN", status: "ready", route: run.route },
    { word: "MUW", status: "drawing" },
    { word: "HELLO", status: "waiting" },
  ];
  await render(<CityWords words={words} width={360} onOpen={onOpen} credit />);
  expect(screen.getByText("WORDS")).toBeOnTheScreen();
  // Only the word drawn and the one on its way: none failed, none waiting.
  expect(screen.getAllByTestId("route-card")).toHaveLength(2);
  expect(screen.queryByText(/^CIAO/)).toBeNull();
  expect(screen.queryByText(/^HELLO/)).toBeNull();
  expect(screen.getByText(`RUN · ${km} km`)).toBeOnTheScreen();
  expect(screen.getByText("Vercelli")).toBeOnTheScreen();
  expect(screen.getByText("MUW")).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  // The maps' credit once, when nothing above it has one.
  expect(screen.getAllByText(cardMapsCredit())).toHaveLength(1);

  await fireEvent.press(screen.getByLabelText(`RUN, ${km} km`));
  expect(onOpen).toHaveBeenCalledWith(run.route);
});

test("with the credit above, the row has none", async () => {
  const words: WordExample[] = [{ word: "RUN", status: "ready", route: run.route }];
  await render(
    <CityWords words={words} width={360} onOpen={jest.fn()} credit={false} />,
  );
  expect(screen.queryByText(cardMapsCredit())).toBeNull();
});

test("a word opened on the map: its letters and the walks between them, and Start", async () => {
  const [option] = optionsOf(run.route, run.detail, run.detail.alternatives);
  const explored: Explored = {
    status: "done",
    ...option,
    choices: [option.result],
    chosen: 0,
    choose: jest.fn(),
    others: [],
  };
  expect(option.result.walks).toEqual(written.walks);
  await render(
    <ExploredCard
      explored={explored}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onList={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
    />,
  );
  expect(screen.getByText(/^RUN · Vercelli · looks \d+% like it$/)).toBeOnTheScreen();
  expect(
    screen.getByText(/^\d+\.\d km of letters \+ \d+\.\d km walking between them$/),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
});
