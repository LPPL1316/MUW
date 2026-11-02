import type { FeedFilter } from "@shaperoute/shared-types";
import { StyleSheet } from "react-native";

import { t } from "../i18n";
import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";
import { Segmented } from "../screens/Segmented";
import { color } from "../theme/tokens";

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

type Props = {
  tab: FeedFilter;
  onChoose: (tab: FeedFilter) => void;
};

/**
 * The two tabs at the top of «Feed» (TASK-362, ADR-0308): the app's
 * `Segmented`, as the start of «Draw», on a surface to show on the page.
 */
export function FeedTabs({ tab, onChoose }: Props) {
  const options = (["all", "following"] as const).map((value) => ({
    value,
    label: feedTabName(value),
  }));
  return (
    <Segmented options={options} value={tab} onChange={onChoose} style={styles.track} />
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    backgroundColor: color.surface,
  },
});
