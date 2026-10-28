/**
 * The App Store build has no ads for now (TASK-267, ADR-0237): there,
 * AdMob's native code is not linked at all, so neither its SDK nor Google's
 * privacy manifest is in the app Apple receives. The store build is the
 * one with APP_VARIANT=production (eas.json, profile `production`, as for
 * its runtime version in app.config.ts). Preview builds and Expo Go keep
 * AdMob as before on iOS. Without the native module the app has no ads and
 * does not break: `src/ads/admob.ts` never loads the package (as in Expo Go).
 *
 * On Android the package is never linked (TASK-294, ADR-0237 addition): its
 * Gradle script wants an AdMob section at the root of app.json, which the
 * app does not have, and the first Android build failed on it. Ads come
 * with the company (the user's choice), and on Android with a new native
 * build then.
 *
 * Apple Health and Health Connect (TASK-321, ADR-0281) wait for their own
 * native builds: the 1.0.1 for the iPhone (part B), a new Android build
 * (part C). Until then their libraries are in package.json but linked on
 * no platform, so today's builds keep their fingerprints; the app never
 * loads them without the native module (`src/health/healthModules.ts`).
 * `@react-native-healthkit/core` comes with the iPhone library.
 */
const storeBuild = process.env.APP_VARIANT === "production";

const notYet = { platforms: { ios: null, android: null } };

module.exports = {
  dependencies: {
    "react-native-google-mobile-ads": {
      platforms: storeBuild ? { ios: null, android: null } : { android: null },
    },
    "@kingstinct/react-native-healthkit": notYet,
    "@react-native-healthkit/core": notYet,
    "react-native-nitro-modules": notYet,
    "react-native-health-connect": notYet,
  },
};
