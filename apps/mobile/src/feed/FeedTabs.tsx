import type { FeedFilter } from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";
import { color, font, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { Tap } from "../ui/Tap";

/** The name of the tab. Not through `t`: its table is by the English text,
 * and «Following» is already the button of a member followed, in Italian
 * «Segui già» and not this. */
const FOLLOWING_TAB: Readonly<Record<Language, string>> = {
  en: "Following",
  it: "Seguiti",
  de: "Folge ich",
  fr: "Suivis",
  es: "Siguiendo",
};

/** The name of a tab of «Feed», in the app's language. */
export function feedTabName(tab: FeedFilter): string {
  return tab === "all" ? t("All") : FOLLOWING_TAB[appLanguage()];
}

const TABS: readonly FeedFilter[] = ["all", "following"];

type Props = {
  tab: FeedFilter;
  onChoose: (tab: FeedFilter) => void;
};

/**
 * The two tabs at the top of «Feed» (TASK-362, ADR-0308). Neutral, as every
 * control that is not the route's (docs/UI.md, «Il tema»).
 */
export function FeedTabs({ tab, onChoose }: Props) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((each) => (
        <Tap
          key={each}
          style={[styles.tab, each === tab && styles.chosen]}
          onPress={() => onChoose(each)}
          accessibilityRole="tab"
          accessibilityState={{ selected: each === tab }}
          testID={`feed-tab-${each}`}
        >
          <Text style={[styles.name, each === tab && styles.chosenName]}>
            {feedTabName(each)}
          </Text>
        </Tap>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  tab: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  chosen: {
    backgroundColor: color.surfaceRaised,
  },
  name: {
    ...font.label,
    color: color.textMuted,
  },
  chosenName: {
    color: color.text,
  },
});
