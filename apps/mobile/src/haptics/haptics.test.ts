import { requireOptionalNativeModule } from "expo";

import { hapticsAvailable, selectionFeel, stepFeel } from "./haptics";

jest.mock("expo", () => ({ requireOptionalNativeModule: jest.fn() }));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
}));

const native = requireOptionalNativeModule as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const haptics = require("expo-haptics") as {
  selectionAsync: jest.Mock;
  impactAsync: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

test("an app built without expo-haptics (the store's 1.0) does nothing", () => {
  native.mockReturnValue(null);
  expect(hapticsAvailable()).toBe(false);
  selectionFeel();
  stepFeel();
  expect(haptics.selectionAsync).not.toHaveBeenCalled();
  expect(haptics.impactAsync).not.toHaveBeenCalled();
});

test("with it, a choice and a step are felt", () => {
  native.mockReturnValue({});
  selectionFeel();
  stepFeel();
  expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
  expect(haptics.impactAsync).toHaveBeenCalledWith("light");
});

test("a phone that cannot buzz is no error", async () => {
  native.mockReturnValue({});
  haptics.selectionAsync.mockRejectedValueOnce(new Error("unavailable"));
  expect(() => selectionFeel()).not.toThrow();
  await Promise.resolve();
});
