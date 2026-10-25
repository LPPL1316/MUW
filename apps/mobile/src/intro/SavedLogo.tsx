import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import { t, tLater } from "../i18n";
import { color } from "../theme/tokens";

/**
 * The logo after «Save» (TASK-212, ADR-0174), step by step: the yellow comes
 * up with the logo, stays a moment, and fades back to the app.
 */
export const SAVED_MS = { in: 250, hold: 1100, fade: 300 } as const;

/** How long the yellow screen with the logo is seen, before it fades. */
export const SAVED_SHOWN_MS = SAVED_MS.in + SAVED_MS.hold;

/** From «Save» to the app alone on screen. */
export const SAVED_TOTAL_MS = SAVED_SHOWN_MS + SAVED_MS.fade;

/** What a screen reader says as the logo comes up: in the app's language,
 * with `t(SAVED_SAID)` (TASK-210). */
export const SAVED_SAID = tLater("Saved to My activities");

/** The logo across most of a phone, never huge on a tablet. */
const LOGO_SHARE = 0.75;
const LOGO_WIDEST = 340;
/** The logo's image is a square with the logo across its middle, as in the
 * launch animation (`assets/splash-logo-dark.png`): it shows through a low
 * window. */
const LOGO_WINDOW = 0.26;
/** The logo grows to its size as the yellow comes up. */
const LOGO_FROM = 0.85;

const listeners = new Set<() => void>();

/** «Save» kept the run that ended: the logo comes up over the app. */
export function showSavedLogo(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Where the logo comes up: over the app, with nothing on screen until a run
 * is saved (`Root`). Each «Save» plays it from the start.
 */
export function SavedLogoLayer() {
  // A count, not a flag: a second «Save» while the logo is up starts it again.
  const [saves, setSaves] = useState(0);
  useEffect(() => {
    const show = () => setSaves((count) => count + 1);
    listeners.add(show);
    return () => {
      listeners.delete(show);
    };
  }, []);
  return saves > 0 ? <SavedLogo key={saves} onDone={() => setSaves(0)} /> : null;
}

type Props = {
  /** The logo is gone and the app is alone on screen. */
  onDone: () => void;
};

/**
 * The run is saved: on the brand yellow of the launch, the Sgrava logo, for
 * a moment. It takes the touches while it is up, and a tap sends it away.
 */
export function SavedLogo({ onDone }: Props) {
  const { width } = useWindowDimensions();
  const [shown] = useState(() => new Animated.Value(0));
  // The newest `onDone`, without starting the logo again.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  // Started by the time or by a tap, whichever comes first, once.
  const leave = useRef<() => void>(() => {});

  useEffect(() => {
    let left = false;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const coming = Animated.timing(shown, {
      toValue: 1,
      duration: SAVED_MS.in,
      useNativeDriver: true,
    });
    const leaving = Animated.timing(shown, {
      toValue: 0,
      duration: SAVED_MS.fade,
      useNativeDriver: true,
    });
    leave.current = () => {
      if (left) {
        return;
      }
      left = true;
      clearTimeout(wait);
      coming.stop();
      leaving.start((end) => {
        if (end.finished) {
          done.current();
        }
      });
    };
    coming.start();
    AccessibilityInfo.announceForAccessibility(t(SAVED_SAID));
    // Held by a timer, not by the animation: with the phone's animations
    // switched off the yellow is up at once, and stays all the same.
    wait = setTimeout(() => leave.current(), SAVED_SHOWN_MS);
    return () => {
      left = true;
      clearTimeout(wait);
      coming.stop();
      leaving.stop();
    };
  }, [shown]);

  const logoWidth = Math.min(width * LOGO_SHARE, LOGO_WIDEST);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: shown }]}
      testID="saved-logo"
    >
      <Pressable
        style={styles.cover}
        onPress={() => leave.current()}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t(SAVED_SAID)}
      >
        <Animated.View
          style={[
            styles.logoWindow,
            {
              width: logoWidth,
              height: logoWidth * LOGO_WINDOW,
              transform: [
                {
                  scale: shown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [LOGO_FROM, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require("../../assets/splash-logo-dark.png")}
            style={{ width: logoWidth, height: logoWidth }}
            accessible={false}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // The yellow of the launch (TASK-179, TASK-181): the same logo, the same
    // ground.
    backgroundColor: color.accent,
  },
  logoWindow: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
