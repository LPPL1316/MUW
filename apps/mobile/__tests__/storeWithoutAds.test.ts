import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * The App Store build links no AdMob native code (TASK-267, ADR-0237):
 * `react-native.config.js` leaves the package out when APP_VARIANT is
 * "production". The JS then has no native module, as in Expo Go, so only
 * `src/ads/admob.ts`, which checks first, may load the package at run time.
 */

const PACKAGE = "react-native-google-mobile-ads";
const APP = join(__dirname, "..");

function config(variant: string | undefined) {
  let loaded: { dependencies: Record<string, unknown> } | undefined;
  jest.isolateModules(() => {
    if (variant === undefined) {
      delete process.env.APP_VARIANT;
    } else {
      process.env.APP_VARIANT = variant;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("../react-native.config.js");
  });
  delete process.env.APP_VARIANT;
  return loaded!;
}

/** Every .ts and .tsx file of the app that ships, without the tests. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    const shipped = /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
    return shipped ? [path] : [];
  });
}

describe("the App Store build without ads", () => {
  it("does not link AdMob's native code in the store build", () => {
    expect(config("production").dependencies[PACKAGE]).toEqual({
      platforms: { ios: null, android: null },
    });
  });

  it("keeps AdMob on iOS in every other build (preview, simulator), never on Android", () => {
    // Android: the package's Gradle script wants an AdMob section in app.json
    // that the app does not have (TASK-294), and ads come with the company.
    expect(config(undefined).dependencies[PACKAGE]).toEqual({
      platforms: { android: null },
    });
    expect(config("preview").dependencies[PACKAGE]).toEqual({
      platforms: { android: null },
    });
  });

  it("loads the package at run time only in src/ads/admob.ts", () => {
    const files = [join(APP, "App.tsx"), ...sources(join(APP, "src"))];
    const loading = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      // A type import goes away in the bundle; anything else loads the package.
      const valueImport = new RegExp(
        `import\\s+(?!type\\b)[^;]*from\\s+["']${PACKAGE}["']`,
      );
      const required = new RegExp(`require\\(\\s*["']${PACKAGE}["']`);
      return valueImport.test(text) || required.test(text);
    });
    expect(files.length).toBeGreaterThan(50);
    expect(loading.map((file) => relative(APP, file))).toEqual(["src/ads/admob.ts"]);
  });
});
