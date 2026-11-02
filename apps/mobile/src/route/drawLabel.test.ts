import { translate } from "../i18n/translate";
import { drawLabel } from "./drawLabel";

test("what will be drawn and how far, in the button", () => {
  expect(drawLabel({ kind: "shape", shape: "circle" }, 7800, "km")).toBe(
    "Draw a 7.8 km circle",
  );
  expect(drawLabel({ kind: "shape", shape: "dog_head" }, 5000, "km")).toBe(
    "Draw a 5.0 km dog head",
  );
  expect(drawLabel({ kind: "word", word: "CIAO" }, 6000, "km")).toBe(
    "Draw “CIAO”, 6.0 km",
  );
  expect(drawLabel({ kind: "image" }, 4000, "km")).toBe("Draw the picture, 4.0 km");
});

test("with no choice or no distance, «Draw route» as before", () => {
  expect(drawLabel({ kind: "none" }, 5000, "km")).toBe("Draw route");
  expect(drawLabel({ kind: "shape", shape: "heart" }, null, "km")).toBe("Draw route");
});

test("in Italian, with no article to get wrong", () => {
  expect(
    translate("it", "Draw a {distance} {name}", {
      distance: "7,8 km",
      name: "cerchio",
    }),
  ).toBe("Disegna: cerchio da 7,8 km");
});
