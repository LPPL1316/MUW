import type { ConfigContext } from "expo/config";

import appConfig from "../app.config";
import appJson from "../app.json";
import easJson from "../eas.json";

/**
 * MuW on Google Play (TASK-294, ADR-0253): the Android package is the one
 * the user chose and never changes; Firebase's file reaches the config only
 * through EAS's variable; the store submit goes to the closed test.
 */
function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const before = { ...process.env };
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  try {
    return run();
  } finally {
    for (const name of Object.keys(values)) {
      if (before[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = before[name];
      }
    }
  }
}

function fromAppJson(env: Record<string, string | undefined>) {
  const context: ConfigContext = {
    projectRoot: "",
    staticConfigPath: null,
    packageJsonPath: null,
    config: appJson.expo as ConfigContext["config"],
  };
  return withEnv(env, () => appConfig(context));
}

it("the Android package is app.getmuw.android, for good", () => {
  expect(appJson.expo.android.package).toBe("app.getmuw.android");
});

it("without Firebase's variable the Android config is app.json as it is", () => {
  const exp = fromAppJson({ GOOGLE_SERVICES_JSON: undefined, APP_VARIANT: undefined });
  expect(exp.android).toEqual(appJson.expo.android);
  expect(exp.android?.googleServicesFile).toBeUndefined();
});

it("with the variable, Firebase's file is set for Android in both variants", () => {
  const path = "/tmp/eas/google-services.json";
  const preview = fromAppJson({ GOOGLE_SERVICES_JSON: path, APP_VARIANT: undefined });
  expect(preview.android?.googleServicesFile).toBe(path);
  expect(preview.android?.package).toBe("app.getmuw.android");
  expect(preview.runtimeVersion).toBe("exposdk:57.0.0");
  const store = fromAppJson({ GOOGLE_SERVICES_JSON: path, APP_VARIANT: "production" });
  expect(store.android?.googleServicesFile).toBe(path);
  expect(store.runtimeVersion).toEqual({ policy: "fingerprint" });
  // Nothing of iOS changes with it.
  expect(store.ios).toEqual(appJson.expo.ios);
});

it("the store submit sends Android builds to the closed test, rolled out", () => {
  expect(easJson.submit.production.android).toEqual({
    track: "alpha",
    releaseStatus: "completed",
  });
  // iOS keeps its App Store Connect app.
  expect(easJson.submit.production.ios.ascAppId).toBe("6820961883");
});
