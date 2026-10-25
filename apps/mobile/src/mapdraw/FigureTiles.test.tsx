import { SHAPES } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SAMPLE_PICTURES } from "../route/samplePictures";
import { FigureTiles } from "./FigureTiles";
import { NO_TILE } from "./resultFigure";

// The row of figures (TASK-281, TASK-286): the same tiles on the map of
// «Draw on the map» and under the route drawn.

const LEAF = SAMPLE_PICTURES.find((sample) => sample.id === "leaf")!;

test("the shapes, then the pictures; the figure there is marked", async () => {
  const onChoose = jest.fn();
  await render(
    <FigureTiles chosen={{ shape: null, sample: "leaf" }} onChoose={onChoose} />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(
    SHAPES.length + SAMPLE_PICTURES.length,
  );
  expect(screen.queryByText("+ photo")).toBeNull();
  expect(screen.getByRole("button", { name: "Leaf" })).toBeSelected();
  expect(screen.getByRole("button", { name: "heart" })).not.toBeSelected();

  await fireEvent.press(screen.getByRole("button", { name: "dog head" }));
  expect(onChoose).toHaveBeenLastCalledWith({ kind: "shape", shape: "dog_head" });
  await fireEvent.press(screen.getByRole("button", { name: "Leaf" }));
  expect(onChoose).toHaveBeenLastCalledWith({ kind: "picture", sample: LEAF });
});

test("on the water only the shapes", async () => {
  await render(<FigureTiles chosen={NO_TILE} onChoose={jest.fn()} pictures={false} />);
  expect(screen.getAllByRole("button")).toHaveLength(SHAPES.length);
  expect(screen.queryByRole("button", { name: "Leaf" })).toBeNull();
});

test("«+ photo» first on the map, waiting while a photo is traced", async () => {
  const onPhoto = jest.fn();
  const { rerender } = await render(
    <FigureTiles chosen={NO_TILE} onChoose={jest.fn()} onPhoto={onPhoto} />,
  );
  expect(screen.getAllByRole("button")[0]).toHaveTextContent("+ photo");
  await fireEvent.press(screen.getByText("+ photo"));
  expect(onPhoto).toHaveBeenCalledTimes(1);

  await rerender(
    <FigureTiles chosen={NO_TILE} onChoose={jest.fn()} onPhoto={onPhoto} photoBusy />,
  );
  await fireEvent.press(screen.getByText("+ photo"));
  expect(onPhoto).toHaveBeenCalledTimes(1);
});
