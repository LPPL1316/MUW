import appJson from "../../app.json";
import de from "../../locales/de.json";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import fr from "../../locales/fr.json";
import it from "../../locales/it.json";
import packageJson from "../../package.json";

/**
 * The native side of Apple Health in the iPhone build 1.0.1 (TASK-321 part
 * B, ADR-0281): the HealthKit entitlement and the text of the permission to
 * write, straight in app.json, not through the library's config plugin,
 * which would also add a text to read and background delivery. The iPhone's
 * libraries are linked on iOS only; Health Connect waits for part C.
 */

type Dependency = { platforms: Record<string, null> };

function linking(variant: string | undefined): Record<string, Dependency> {
  let loaded: { dependencies: Record<string, Dependency> } | undefined;
  jest.isolateModules(() => {
    if (variant === undefined) {
      delete process.env.APP_VARIANT;
    } else {
      process.env.APP_VARIANT = variant;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("../../react-native.config.js");
  });
  delete process.env.APP_VARIANT;
  return loaded!.dependencies;
}

const APPROVED =
  "MuW saves your finished activities to Apple Health, with their time, distance, route and, for runs, estimated calories, so they also appear in the Fitness app.";

const IPHONE_LIBRARIES = [
  "@kingstinct/react-native-healthkit",
  "@react-native-healthkit/core",
  "react-native-nitro-modules",
];

type Plugin = string | [string, Record<string, unknown>];

const ios = appJson.expo.ios as {
  entitlements?: Record<string, unknown>;
  infoPlist: Record<string, unknown>;
};

test("the build has HealthKit, without clinical records nor background delivery", () => {
  expect(ios.entitlements).toEqual({
    "com.apple.developer.healthkit": true,
    "com.apple.developer.healthkit.access": [],
  });
});

test("the permission to write has the text the user approved", () => {
  expect(ios.infoPlist.NSHealthUpdateUsageDescription).toBe(APPROVED);
  expect(en.ios.NSHealthUpdateUsageDescription).toBe(APPROVED);
});

test("the permission text is in every language, with the Health and Fitness names of each", () => {
  const names: [Record<string, Record<string, string>>, string, string][] = [
    [it, "Apple Salute", "Fitness"],
    [de, "Apple Health", "Fitness-App"],
    [es, "Apple Salud", "Fitness"],
    [fr, "Apple Santé", "Forme"],
  ];
  for (const [locale, health, fitness] of names) {
    const text = locale.ios.NSHealthUpdateUsageDescription;
    expect(text).toMatch(/^MuW /);
    expect(text).toContain(health);
    expect(text).toContain(fitness);
  }
});

test("MuW never asks to read health data, and the library's plugin is not used", () => {
  expect(ios.infoPlist).not.toHaveProperty("NSHealthShareUsageDescription");
  for (const locale of [en, it, de, es, fr]) {
    expect(locale.ios).not.toHaveProperty("NSHealthShareUsageDescription");
  }
  const plugins = (appJson.expo.plugins as Plugin[]).map((plugin) =>
    typeof plugin === "string" ? plugin : plugin[0],
  );
  expect(plugins).not.toContain("@kingstinct/react-native-healthkit");
  expect(ios.infoPlist.UIBackgroundModes).toEqual(["audio"]);
});

test("the iPhone's libraries are linked on iOS only, in every build", () => {
  for (const variant of [undefined, "preview", "production"]) {
    const dependencies = linking(variant);
    for (const name of IPHONE_LIBRARIES) {
      expect(dependencies[name]).toEqual({ platforms: { android: null } });
    }
  }
});

test("Health Connect stays out of every build until part C", () => {
  for (const variant of [undefined, "preview", "production"]) {
    expect(linking(variant)["react-native-health-connect"]).toEqual({
      platforms: { ios: null, android: null },
    });
  }
  expect(packageJson.expo.autolinking.exclude).toContain("react-native-health-connect");
});
