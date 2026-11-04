import { readFileSync } from "fs";
import path from "path";

import appJson from "../../app.json";
import de from "../../locales/de.json";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import fr from "../../locales/fr.json";
import it from "../../locales/it.json";
import packageJson from "../../package.json";

/**
 * The native side of the iPhone build 1.0.1 (TASK-321 part B, ADR-0281): the
 * HealthKit entitlement and the texts of the permissions to write and to
 * read the heart rate (TASK-345 C), straight in app.json, not through the
 * library's config plugin, which would also add background delivery. The
 * iPhone's libraries are linked on iOS only; Health Connect waits for part C.
 * The contacts (TASK-262 C), the file picker (TASK-312 B) and the touch
 * that buzzes (TASK-361, `expo-haptics`) are switched on with this build.
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

const APPROVED_READ: [Record<string, Record<string, string>>, string][] = [
  [
    en,
    "MuW reads your heart rate from Apple Health during each activity, to show it with the activity and in your post. You can hide it before you publish.",
  ],
  [
    it,
    "MuW legge il tuo battito da Apple Salute durante ogni attività, per mostrarlo con l'attività e nel tuo post. Puoi nasconderlo prima di pubblicare.",
  ],
  [
    de,
    "MuW liest deine Herzfrequenz aus Apple Health während jeder Aktivität, um sie mit der Aktivität und in deinem Beitrag zu zeigen. Du kannst sie vor dem Veröffentlichen ausblenden.",
  ],
  [
    fr,
    "MuW lit ta fréquence cardiaque dans Apple Santé pendant chaque activité, pour l'afficher avec l'activité et dans ta publication. Tu peux la masquer avant de publier.",
  ],
  [
    es,
    "MuW lee tu frecuencia cardíaca de Apple Salud durante cada actividad, para mostrarla con la actividad y en tu publicación. Puedes ocultarla antes de publicar.",
  ],
];

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

function plugins(): string[] {
  return (appJson.expo.plugins as Plugin[]).map((plugin) =>
    typeof plugin === "string" ? plugin : plugin[0],
  );
}

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

test("the permission to read has the text the user approved, in every language", () => {
  expect(ios.infoPlist.NSHealthShareUsageDescription).toBe(APPROVED_READ[0][1]);
  for (const [locale, text] of APPROVED_READ) {
    expect(locale.ios.NSHealthShareUsageDescription).toBe(text);
  }
});

test("the library's plugin is not used, and nothing runs in the background for Health", () => {
  expect(plugins()).not.toContain("@kingstinct/react-native-healthkit");
  expect(ios.infoPlist.UIBackgroundModes).toEqual(["audio"]);
});

test("the contacts and the file picker are in the 1.0.1, the contacts with their text", () => {
  expect(packageJson.expo.autolinking.exclude).toEqual(["react-native-health-connect"]);
  expect(plugins()).toContain("expo-contacts");
  const contacts = (appJson.expo.plugins as Plugin[]).find(
    (plugin) => typeof plugin !== "string" && plugin[0] === "expo-contacts",
  ) as [string, Record<string, unknown>];
  expect(contacts[1].contactsPermission).toMatch(/^MuW reads only the phone numbers/);
  // The plugin also asks to write them on Android: MuW only reads.
  expect(appJson.expo.android.blockedPermissions).toEqual([
    "android.permission.WRITE_CONTACTS",
  ]);
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

/** The native module a file of ours asks for (its `NATIVE_MODULE`). */
function askedFor(file: string): string {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8");
  return source.match(/const NATIVE_MODULE = "([^"]+)";/)![1];
}

/** The name the library's iPhone module registers (`Name("…")`). */
function registered(library: string, swiftFile: string): string {
  const root = path.dirname(require.resolve(`${library}/package.json`));
  const source = readFileSync(path.join(root, "ios", swiftFile), "utf8");
  return source.match(/Name\("([^"]+)"\)/)![1];
}

test("the 1.0.1 links the haptics, the contacts and the picker, under the names the app asks for", () => {
  const exclude: string[] = packageJson.expo.autolinking.exclude;
  for (const library of ["expo-haptics", "expo-contacts", "expo-document-picker"]) {
    expect(Object.keys(packageJson.dependencies)).toContain(library);
    expect(exclude).not.toContain(library);
  }
  // A name that does not match would hide the feature in the build as if the
  // module were missing.
  expect(askedFor("haptics/haptics.ts")).toBe(
    registered("expo-haptics", "HapticsModule.swift"),
  );
  expect(askedFor("contacts/phoneContacts.ts")).toBe(
    registered("expo-contacts", "next/ContactsNextModule.swift"),
  );
  expect(askedFor("imports/pickActivityFile.ts")).toBe(
    registered("expo-document-picker", "DocumentPickerModule.swift"),
  );
});
