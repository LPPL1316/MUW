/**
 * For tests only (TASK-388): under jest the native driver is a stub that
 * never moves anything, so an animation on it cannot be watched. With this
 * spy the same springs and fades run on JS, frame by frame on jest's fake
 * timers, still asked for with `useNativeDriver: true`. Call it in a
 * `beforeEach`; `jest.restoreAllMocks()` puts the stub back.
 */
export function runAnimationsOnJs(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const helper = require("react-native/src/private/animated/NativeAnimatedHelper")
    .default as { shouldUseNativeDriver: (config: unknown) => boolean };
  jest.spyOn(helper, "shouldUseNativeDriver").mockReturnValue(false);
}
