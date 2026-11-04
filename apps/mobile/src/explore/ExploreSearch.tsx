import { useState } from "react";
import { Image, StyleSheet, Text } from "react-native";

import type { SamplePost } from "../feed/sampleFeed";
import { t } from "../i18n";
import { SearchScreen } from "../search/SearchScreen";
import { TAB_ICON_SIZE } from "../tabs/TabBar";
import { color, fontSize, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { Tap } from "../ui/Tap";

const LENS = require("../../assets/ui/tabs/search.png");

type Props = {
  /** An example of «Feed» found and touched: its route, as «Feed» opens it. */
  onOpenExample: (post: SamplePost) => void;
};

/**
 * The search at the top of «Explore» (TASK-367 part B, ADR-0311), as
 * Instagram's: what looks like a field, with the lens of the tab bar, opens
 * the search of drawings, members and places over the app (TASK-344), the
 * one the lens of «Feed» opened before. VoiceOver reads «Search».
 */
export function ExploreSearch({ onOpenExample }: Props) {
  const [searching, setSearching] = useState(false);
  return (
    <>
      <Tap
        style={styles.field}
        onPress={() => setSearching(true)}
        accessibilityRole="button"
        accessibilityLabel={t("Search")}
        testID="explore-search"
      >
        <Image source={LENS} style={styles.lens} />
        <Text style={styles.hint} numberOfLines={1}>
          {t("Search drawings, people, places")}
        </Text>
      </Tap>
      <SearchScreen
        visible={searching}
        onClose={() => setSearching(false)}
        onOpenExample={onOpenExample}
      />
    </>
  );
}

// As the fields of the app (PlaceSearch, SearchBar): neutral, on the surface.
const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  lens: {
    width: TAB_ICON_SIZE - space.xs,
    height: TAB_ICON_SIZE - space.xs,
    tintColor: color.textMuted,
  },
  hint: {
    flex: 1,
    color: color.textMuted,
    fontSize: fontSize.input,
  },
});
