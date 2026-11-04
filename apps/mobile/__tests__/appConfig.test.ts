import { getConfig, type ConfigContext } from "expo/config";
import path from "path";

import appConfig from "../app.config";
import appJson from "../app.json";
import easJson from "../eas.json";
import storeConfig from "../store.config.json";

/**
 * Expo Go opens only updates made for "exposdk:<sdk>" (ADR-0078); the App
 * Store build takes its runtime from a fingerprint of its native code
 * (ADR-0233). The two must never swap, and app.config.ts must keep
 * everything else of app.json, plugins included.
 */
function withVariant<T>(appVariant: string | undefined, run: () => T): T {
  const before = process.env.APP_VARIANT;
  if (appVariant === undefined) {
    delete process.env.APP_VARIANT;
  } else {
    process.env.APP_VARIANT = appVariant;
  }
  try {
    return run();
  } finally {
    if (before === undefined) {
      delete process.env.APP_VARIANT;
    } else {
      process.env.APP_VARIANT = before;
    }
  }
}

function fromAppJson(appVariant: string | undefined) {
  const context: ConfigContext = {
    projectRoot: "",
    staticConfigPath: null,
    packageJsonPath: null,
    // JSON gives `orientation` and the like as plain strings.
    config: appJson.expo as ConfigContext["config"],
  };
  return withVariant(appVariant, () => appConfig(context));
}

it("loads app.config.ts with the Expo Go runtime and every plugin of app.json", () => {
  // The way eas-cli and the build load it. It runs outside Jest's sandbox
  // and reads the real environment, where tests never set APP_VARIANT.
  const { exp, dynamicConfigPath } = getConfig(path.resolve(__dirname, ".."), {
    skipSDKVersionRequirement: true,
  });
  expect(dynamicConfigPath).toMatch(/app\.config\.ts$/);
  // The store version (TASK-152) must not move Expo Go off its runtime.
  expect(exp.version).toBe("1.0.1");
  expect(exp.runtimeVersion).toBe("exposdk:57.0.0");
  expect(exp.runtimeVersion).toBe(appJson.expo.runtimeVersion);
  // iPhone only for the App Store (TASK-152): an iPad runs it as an iPhone app.
  expect(exp.ios?.supportsTablet).toBe(false);
  expect(exp.plugins).toEqual(appJson.expo.plugins);
});

it("keeps app.json as it is without the production variant", () => {
  expect(fromAppJson(undefined)).toEqual(appJson.expo);
  expect(fromAppJson("preview")).toEqual(appJson.expo);
});

it("gives the App Store build a fingerprint runtime and nothing else new", () => {
  expect(fromAppJson("production")).toEqual({
    ...appJson.expo,
    runtimeVersion: { policy: "fingerprint" },
  });
});

it("sets the variant only in the production build profile", () => {
  const { preview, production } = easJson.build;
  expect(production).toMatchObject({
    channel: "production",
    env: { APP_VARIANT: "production" },
  });
  expect(preview).toMatchObject({ channel: "preview" });
  expect(preview).not.toHaveProperty("env");
});

it("submits the production build to the MuW app on App Store Connect", () => {
  // `eas build --auto-submit` needs a submit profile named like the build
  // profile; without it the build runs and the upload fails (TASK-152).
  expect(easJson.submit.production.ios.ascAppId).toBe("6820961883");
});

it("puts the store texts on the App Store version of the build", () => {
  // `eas metadata:push` edits this App Store Connect version; Apple only
  // takes builds whose version matches it (TASK-152).
  expect(storeConfig.apple.version).toBe(appJson.expo.version);
});
