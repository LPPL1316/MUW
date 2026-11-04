// The fingerprint's own way of writing the app config, to compare with.
import { stringifyJsonSorted } from "@expo/fingerprint/build/sourcer/Utils";
import { getConfig } from "expo/config";
import path from "path";

/**
 * The settings for Android only (TASK-294) count in the Android
 * fingerprint and not in the iPhone's: the 1.0 iPhone build (7, runtime
 * 83793e26…) must keep receiving the updates made after them.
 * `fingerprint.config.js` takes them out of the config and adds them to a
 * source only the Android fingerprint has.
 */

type HookSource = { type: "contents"; id: string } | { type: "file"; filePath: string };
type FingerprintConfig = {
  fileHookTransform(
    source: HookSource,
    chunk: string | null,
    isEndOfFile: boolean,
    encoding: string,
  ): string | null;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fingerprint = require("../fingerprint.config.js") as FingerprintConfig;

const APP = path.resolve(__dirname, "..");

/** The app config as the fingerprint reads it. */
function expoConfig(): Record<string, any> {
  const { exp } = getConfig(APP, { skipSDKVersionRequirement: true });
  return JSON.parse(JSON.stringify(exp));
}

function transform(id: string, chunk: string): string | null {
  return fingerprint.fileHookTransform({ type: "contents", id }, chunk, true, "utf8");
}

function locationOptions(config: Record<string, any>): Record<string, unknown> {
  const entry = config.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-location",
  );
  return entry[1];
}

it("the iPhone fingerprint reads the config without the Android settings", () => {
  const config = expoConfig();
  // The package name of part B is in app.json: taken out as well.
  expect(config.android.package).toBe("app.getmuw.android");
  const read = JSON.parse(transform("expoConfig", stringifyJsonSorted(config))!);

  // The options of the 1.0 build, and its Android permissions with those the
  // contacts' plugin adds since the 1.0.1 (TASK-321 B).
  expect(Object.keys(locationOptions(read)).sort()).toEqual([
    "isIosBackgroundLocationEnabled",
    "locationWhenInUsePermission",
  ]);
  expect(read.android.permissions).toEqual([
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS",
  ]);
  expect(read.android.package).toBeUndefined();
  // Written as the fingerprint writes a config that never had them.
  expect(transform("expoConfig", stringifyJsonSorted(config))).toBe(
    stringifyJsonSorted(read),
  );
});

it("a config without the Android settings is read as it is", () => {
  const config = expoConfig();
  delete config.android.package;
  delete locationOptions(config).isAndroidForegroundServiceEnabled;
  delete locationOptions(config).androidForegroundServiceIcon;
  config.android.permissions = config.android.permissions.filter(
    (name: string) => !name.startsWith("android.permission.FOREGROUND_SERVICE"),
  );
  const written = stringifyJsonSorted(config);
  expect(transform("expoConfig", written)).toBe(written);
});

it("the Android fingerprint keeps the Android settings", () => {
  const read = transform("expoAutolinkingConfig:android", "modules")!;
  expect(read.startsWith("modules\n")).toBe(true);
  const settings = JSON.parse(read.slice("modules\n".length));
  expect(settings.android).toEqual({ package: "app.getmuw.android" });
  expect(settings.plugins["expo-location"]).toEqual({
    isAndroidForegroundServiceEnabled: true,
    androidForegroundServiceIcon: "./assets/android-icon-monochrome.png",
  });
  expect(settings.permissions).toEqual([
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
  ]);
});

it("every other source is read as it is", () => {
  expect(transform("expoAutolinkingConfig:ios", "modules")).toBe("modules");
  expect(transform("packageJson:scripts", "{}")).toBe("{}");
  const file = Buffer.from("code") as unknown as string;
  expect(
    fingerprint.fileHookTransform(
      { type: "file", filePath: "app.json" },
      file,
      false,
      "utf8",
    ),
  ).toBe(file);
});
