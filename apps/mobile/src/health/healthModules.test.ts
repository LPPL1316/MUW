import type { HealthPhone } from "./healthPhone";

// The libraries are loaded only where the build has their native code
// (TASK-321): Expo Go and today's builds have none, and there the end of
// an activity shows no line. Fakes stand for the libraries.

const mockLoadedKit = jest.fn();
const mockLoadedConnect = jest.fn();

jest.mock("@kingstinct/react-native-healthkit", () => {
  mockLoadedKit();
  return { isHealthDataAvailable: () => true };
});
jest.mock("react-native-health-connect", () => {
  mockLoadedConnect();
  return { getSdkStatus: async () => 3 };
});

/** `healthPhone()` of a fresh copy of the app's modules, on `os`, with
 * these native modules in the build. */
function phoneOn(os: "ios" | "android", native: readonly string[]): HealthPhone | null {
  let phone: HealthPhone | null = null;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const rn = require("react-native") as typeof import("react-native");
    jest
      .spyOn(rn.TurboModuleRegistry, "get")
      .mockImplementation((name: string) => (native.includes(name) ? {} : null));
    Object.defineProperty(rn.Platform, "OS", { value: os, configurable: true });
    const { healthPhone } =
      require("./healthModules") as typeof import("./healthModules");
    /* eslint-enable @typescript-eslint/no-require-imports */
    phone = healthPhone();
  });
  return phone;
}

afterEach(() => {
  jest.restoreAllMocks();
  mockLoadedKit.mockClear();
  mockLoadedConnect.mockClear();
});

test("an iPhone build without the native module: no Apple Health, not loaded", () => {
  expect(phoneOn("ios", [])).toBeNull();
  expect(mockLoadedKit).not.toHaveBeenCalled();
});

test("an iPhone build with it: Apple Health", () => {
  expect(phoneOn("ios", ["NitroModules"])?.store).toBe("apple");
  expect(mockLoadedKit).toHaveBeenCalled();
});

test("an Android build without the native module: no Health Connect, not loaded", () => {
  expect(phoneOn("android", [])).toBeNull();
  expect(mockLoadedConnect).not.toHaveBeenCalled();
});

test("an Android build with it: Health Connect", () => {
  expect(phoneOn("android", ["HealthConnect"])?.store).toBe("healthConnect");
});

test("a library that throws as it loads: no line", () => {
  mockLoadedKit.mockImplementationOnce(() => {
    throw new Error("HybridObject CoreModule is not registered");
  });
  expect(phoneOn("ios", ["NitroModules"])).toBeNull();
});
