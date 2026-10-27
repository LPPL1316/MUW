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
 */
const storeBuild = process.env.APP_VARIANT === "production";

module.exports = {
  dependencies: {
    "react-native-google-mobile-ads": {
      platforms: storeBuild ? { ios: null, android: null } : { android: null },
    },
  },
};
