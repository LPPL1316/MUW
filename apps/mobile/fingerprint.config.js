// What the runtime version of the App Store build is made of (app.config.ts).
// Left out: the app's version and build number, which EAS raises at every
// store build, and eas.json, which gains store settings over time. Neither
// changes the native code, so a build with a new number must still receive
// the same updates.
//
// Settings for Android only, added after the 1.0 iPhone build (TASK-294):
// the whole app config counts in the fingerprint of either phone, so each of
// them would have moved the iPhone app's runtime too, and cut the 1.0 build
// off its updates without anything of it changing. They count in the
// Android fingerprint only: taken out of the config, and added to the list
// of Android's native modules, which only the Android fingerprint reads.

/** The settings, by where they are in the config: `android` keys, the
 * options of a plugin, and the Android permissions those options add to the
 * config. Only what an iPhone build never reads goes here. */
const ANDROID_ONLY = {
  android: ["package"],
  plugins: {
    "expo-location": [
      "isAndroidForegroundServiceEnabled",
      "androidForegroundServiceIcon",
    ],
  },
  permissions: [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
  ],
};

/** The source only the Android fingerprint has. */
const ANDROID_SOURCE = "expoAutolinkingConfig:android";

/** As @expo/fingerprint writes the config (`stringifyJsonSorted`): keys in
 * order, and lists in the order of their items written out, so the config
 * without the Android settings reads as if they had never been there. */
function sortJson(json) {
  if (Array.isArray(json)) {
    return json.sort((a, b) => {
      const left = stringifyJsonSorted(a);
      const right = stringifyJsonSorted(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }
  if (json !== null && typeof json === "object") {
    return Object.keys(json)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = json[key];
        return sorted;
      }, {});
  }
  return json;
}

function stringifyJsonSorted(target) {
  return JSON.stringify(target, (_, value) => sortJson(value));
}

/** The options of `name` in `plugins`, when it has some. */
function pluginOptions(plugins, name) {
  const entry = (plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === name,
  );
  const options = entry?.[1];
  return options !== null && typeof options === "object" ? options : null;
}

/** `config` without the Android settings, and the settings taken out. */
function splitAndroidOnly(config) {
  const taken = { android: {}, plugins: {}, permissions: [] };
  for (const key of ANDROID_ONLY.android) {
    if (config.android !== undefined && key in config.android) {
      taken.android[key] = config.android[key];
      delete config.android[key];
    }
  }
  const permissions = config.android?.permissions;
  if (Array.isArray(permissions)) {
    taken.permissions = permissions.filter((name) =>
      ANDROID_ONLY.permissions.includes(name),
    );
    config.android.permissions = permissions.filter(
      (name) => !ANDROID_ONLY.permissions.includes(name),
    );
  }
  for (const [name, keys] of Object.entries(ANDROID_ONLY.plugins)) {
    const options = pluginOptions(config.plugins, name);
    for (const key of keys) {
      if (options !== null && key in options) {
        taken.plugins[name] = { ...taken.plugins[name], [key]: options[key] };
        delete options[key];
      }
    }
  }
  return { config, taken };
}

/** The Android settings of the app config as it is in the project. */
function androidOnlySettings() {
  const { getConfig } = require("expo/config");
  const { exp } = getConfig(__dirname, { skipSDKVersionRequirement: true });
  return splitAndroidOnly(JSON.parse(JSON.stringify(exp))).taken;
}

/** @type {import('expo/fingerprint').Config['fileHookTransform']} */
function fileHookTransform(source, chunk) {
  if (source.type !== "contents" || typeof chunk !== "string") {
    return chunk;
  }
  if (source.id === "expoConfig") {
    return stringifyJsonSorted(splitAndroidOnly(JSON.parse(chunk)).config);
  }
  if (source.id === ANDROID_SOURCE) {
    return `${chunk}\n${stringifyJsonSorted(androidOnlySettings())}`;
  }
  return chunk;
}

/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: ["ExpoConfigVersions", "PackageJsonAndroidAndIosScriptsIfNotContainRun"],
  ignorePaths: ["eas.json"],
  fileHookTransform,
};

module.exports = config;
module.exports.ANDROID_ONLY = ANDROID_ONLY;
module.exports.splitAndroidOnly = splitAndroidOnly;
