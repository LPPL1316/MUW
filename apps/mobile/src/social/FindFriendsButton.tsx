import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { SamplePost } from "../feed/sampleFeed";
import { t } from "../i18n";
import { SearchScreen } from "../search/SearchScreen";
import { color, MIN_TAP_SIZE, radius } from "../theme/tokens";

/** The side of the lens's glass. */
const GLASS = 15;
/** The thickness of its rim and of its handle. */
const RIM = 2;

type Props = {
  /** An example of «Feed» found and touched: its route, as «Feed» opens it. */
  onOpenExample: (post: SamplePost) => void;
};

/**
 * The lens at the top of «Feed» (TASK-215, TASK-219): only a lens, in a
 * circle like the button of «Profile». Since TASK-344 (ADR-0297, the
 * user's choice) it opens the search of drawings, members and routes over
 * the whole app; the members are its tab «People». VoiceOver reads
 * «Search».
 */
export function FindFriendsButton({ onOpenExample }: Props) {
  const [searching, setSearching] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => setSearching(true)}
        accessibilityRole="button"
        accessibilityLabel={t("Search")}
      >
        <Lens />
      </Pressable>
      <SearchScreen
        visible={searching}
        onClose={() => setSearching(false)}
        onOpenExample={onOpenExample}
      />
    </>
  );
}

/** A magnifying glass, drawn: the app has no icons (no react-native-svg). */
function Lens() {
  return (
    <View style={styles.lens}>
      <View style={styles.glass} />
      <View style={styles.handle} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Neutral, as every control that is not the route's (docs/UI.md, «Il tema»).
  // As the button of «Profile» (ProfileLayer.tsx).
  button: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  pressed: {
    backgroundColor: color.surface,
  },
  lens: {
    width: GLASS + RIM * 2,
    height: GLASS + RIM * 2,
  },
  glass: {
    width: GLASS,
    height: GLASS,
    borderRadius: radius.pill,
    borderWidth: RIM,
    borderColor: color.text,
  },
  // Out of the glass, down to the right.
  handle: {
    position: "absolute",
    right: 0,
    bottom: RIM / 2,
    width: RIM,
    height: GLASS / 2,
    borderRadius: RIM / 2,
    backgroundColor: color.text,
    transform: [{ rotate: "-45deg" }],
  },
});
