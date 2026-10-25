import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json stays the whole config; this file only changes the runtime version
 * of the App Store build (TASK-152) and adds Firebase's file on Android
 * (TASK-294).
 *
 * Expo Go opens an update only when its runtime version is "exposdk:<sdk>"
 * (ADR-0078), so the `preview` channel keeps the one in app.json. The store
 * build (eas.json profile `production`, which sets APP_VARIANT) uses a
 * fingerprint of its native code instead: an update made with other native
 * libraries gets another runtime version and never reaches it.
 *
 * Publishing to the `production` channel needs the same variable:
 * `APP_VARIANT=production npx eas-cli update --channel production ...`
 * (docs/DEPLOY.md A.7). Without it the update is made for Expo Go, and store
 * builds simply do not receive it.
 *
 * On Android the push notifications go through Firebase (ADR-0253): the
 * `google-services.json` of the Firebase project is a file variable on EAS,
 * GOOGLE_SERVICES_JSON (docs/DEPLOY.md G.2), never in the repository. EAS
 * writes it to a path and gives the path in the variable; here it becomes
 * `android.googleServicesFile`. Without the variable (Expo Go, the tests, a
 * checkout) the config is app.json as it is: the file counts in the Android
 * fingerprint only, so the iPhone build's runtime does not move.
 */
export default ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const googleServices = process.env.GOOGLE_SERVICES_JSON;
  const withFirebase: Partial<ExpoConfig> = googleServices
    ? { ...config, android: { ...config.android, googleServicesFile: googleServices } }
    : config;
  return process.env.APP_VARIANT === "production"
    ? { ...withFirebase, runtimeVersion: { policy: "fingerprint" } }
    : withFirebase;
};
