import { SHADES } from "../theme/tokens";
import { DAY, NIGHT, styleName, stylePalette, VIDEO_STYLES } from "./videoStyle";

describe("videoStyle", () => {
  it("offers Night, then Day", () => {
    expect(VIDEO_STYLES).toEqual(["night", "day"]);
  });

  it("is each tone at its end, whatever tone the app is in", () => {
    expect(NIGHT.map).toEqual(SHADES.dark.darkest.map);
    expect(NIGHT.text).toBe(SHADES.dark.darkest.text);
    expect(DAY.map).toEqual(SHADES.light.brightest.map);
    expect(DAY.text).toBe(SHADES.light.brightest.text);
    expect(stylePalette("night")).toBe(NIGHT);
    expect(stylePalette("day")).toBe(DAY);
  });

  it("names the styles as the row shows them", () => {
    expect(styleName("night")).toBe("Night");
    expect(styleName("day")).toBe("Day");
  });
});
