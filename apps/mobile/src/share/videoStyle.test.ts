import { SHADES } from "../theme/tokens";
import {
  DAY,
  NIGHT,
  styleName,
  stylePalette,
  styleRelief,
  VIDEO_STYLES,
} from "./videoStyle";

describe("videoStyle", () => {
  it("offers Night, Day, then 3D", () => {
    expect(VIDEO_STYLES).toEqual(["night", "day", "3d"]);
  });

  it("is each tone at its end, whatever tone the app is in; 3D is the night on its hills", () => {
    expect(NIGHT.map).toEqual(SHADES.dark.darkest.map);
    expect(NIGHT.text).toBe(SHADES.dark.darkest.text);
    expect(DAY.map).toEqual(SHADES.light.brightest.map);
    expect(DAY.text).toBe(SHADES.light.brightest.text);
    expect(stylePalette("night")).toBe(NIGHT);
    expect(stylePalette("day")).toBe(DAY);
    expect(stylePalette("3d")).toBe(NIGHT);
    expect(styleRelief("3d")).toBe(true);
    expect(styleRelief("night")).toBe(false);
    expect(styleRelief("day")).toBe(false);
  });

  it("names the styles as the row shows them", () => {
    expect(styleName("night")).toBe("Night");
    expect(styleName("day")).toBe("Day");
    expect(styleName("3d")).toBe("3D");
  });
});
