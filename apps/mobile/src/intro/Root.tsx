import { useState } from "react";
import { StyleSheet, View } from "react-native";

import App from "../../App";
import { UnlockLayer } from "../game/UnlockLayer";
import { color } from "../theme/tokens";
import { Tour } from "../tour/Tour";
import { useTour } from "../tour/useTour";
import { AppBoundary } from "./AppBoundary";
import { markFirstPage } from "./firstPage";
import { LaunchIntro } from "./LaunchIntro";
import { SavedLogoLayer } from "./SavedLogo";

/**
 * What the phone opens (TASK-179): the app, and over it the launch animation
 * until it has played once. The app starts underneath at once, so its first
 * requests run while the heart is drawn. Over the app, under the animation,
 * the logo that comes up after «Save» (TASK-212). Around it all, the screen
 * for a component that throws (TASK-256): «Try again» there starts the app
 * anew, without the animation again. After the animation, the first time
 * and whenever the guide asks, the tour of the app (TASK-266). Under the
 * logo after «Save», the card of a shape the run unlocked (TASK-296): it
 * waits for the logo to go. When the animation ends, what the app does
 * ahead of the user may start (TASK-306, firstPage.ts).
 */
export function Root() {
  const [intro, setIntro] = useState(true);
  const tour = useTour();
  return (
    <View style={styles.root}>
      <AppBoundary>
        <App />
        <UnlockLayer />
        <SavedLogoLayer />
        {!intro && tour.on !== null ? (
          <Tour key={tour.on.key} lockSeconds={tour.on.lockSeconds} onEnd={tour.end} />
        ) : null}
        {intro ? (
          <LaunchIntro
            onDone={() => {
              setIntro(false);
              markFirstPage();
            }}
          />
        ) : null}
      </AppBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background,
  },
});
