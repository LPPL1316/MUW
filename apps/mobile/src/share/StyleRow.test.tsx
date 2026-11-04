import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import type { PostRun } from "./postRun";
import { StyleRow } from "./StyleRow";

/** A straight line north, a point every 50 m. */
function north(metres: number): LatLon[] {
  return Array.from({ length: metres / 50 + 1 }, (_, i): LatLon => [
    46.07 + (i * 50) / 111_195,
    11.12,
  ]);
}

const RUN: PostRun = {
  key: "run-1",
  title: "Heart in Trento",
  track: north(5200),
  distanceM: 5200,
  durationMs: (28 * 60 + 10) * 1000,
};

describe("StyleRow", () => {
  it("offers Night and Day, the chosen one checked, and tells which is tapped", async () => {
    const onChange = jest.fn();
    await render(<StyleRow run={RUN} style="night" onChange={onChange} />);
    expect(screen.getByText("Style")).toBeOnTheScreen();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Night" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Day" })).not.toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: "Day" }));
    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("draws the run in each tile", async () => {
    await render(<StyleRow run={RUN} style="day" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Day" })).toBeChecked();
    // One line of pieces in each of the two tiles.
    expect(screen.getAllByTestId("style-line").length).toBeGreaterThanOrEqual(2);
  });

  it("draws nothing for a run too short to show", async () => {
    await render(
      <StyleRow
        run={{ ...RUN, track: north(350), distanceM: 350 }}
        style="night"
        onChange={() => {}}
      />,
    );
    expect(screen.queryAllByTestId("style-line")).toHaveLength(0);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});
