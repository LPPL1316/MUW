import type { ReactNode } from "react";
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { countLabel } from "../messages/MessagesRow";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { tabName, tourPart } from "../tour/tourParts";
import { Tap } from "../ui/Tap";

/** The icons of the bar, from Lucide (ISC, assets/ui/tabs/LICENSE-lucide.txt):
 * white, coloured by `tintColor`; the tab on screen has the bolder line. */
export const TAB_ICONS = {
  house: {
    off: require("../../assets/ui/tabs/house.png"),
    on: require("../../assets/ui/tabs/house-active.png"),
  },
  pencil: {
    off: require("../../assets/ui/tabs/pencil.png"),
    on: require("../../assets/ui/tabs/pencil-active.png"),
  },
  send: {
    off: require("../../assets/ui/tabs/send.png"),
    on: require("../../assets/ui/tabs/send-active.png"),
  },
  search: {
    off: require("../../assets/ui/tabs/search.png"),
    on: require("../../assets/ui/tabs/search-active.png"),
  },
} satisfies Record<string, { off: ImageSourcePropType; on: ImageSourcePropType }>;

export type TabIcon = keyof typeof TAB_ICONS;

/** The side of an icon of the bar, in points. */
export const TAB_ICON_SIZE = 26;
/** How tall the bar is over the home indicator. */
export const TAB_BAR_HEIGHT = 50;

export type BarTab = {
  /** The page's name: the tour finds the tab by it. */
  title: string;
  /** What the screen reader says: the name, with what waits in it. */
  label: string;
  /** Its icon, or `face`: the profile's picture (TASK-367). */
  icon?: TabIcon;
  face?: (selected: boolean) => ReactNode;
  /** A red number over the icon, when more than 0. */
  count?: number;
};

type Props = {
  tabs: readonly BarTab[];
  /** The tab of the page on screen. */
  page: number;
  onTab: (index: number) => void;
};

/**
 * The tab bar at the foot of the app (TASK-367, ADR-0311), as Instagram's:
 * one icon a page, no words, over the home indicator. The page on screen is
 * told by the bolder line and by light, never by the route's yellow.
 */
export function TabBar({ tabs, page, onTab }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
      testID="tab-bar"
    >
      {tabs.map((tab, index) => {
        const selected = index === page;
        return (
          // The tour shows the tab: a plain view, which it can measure.
          <View
            key={tab.title}
            ref={tourPart(tabName(tab.title))}
            collapsable={false}
            style={styles.slot}
          >
            <Tap
              style={styles.tab}
              onPress={() => onTab(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
              {tab.face ? (
                tab.face(selected)
              ) : tab.icon ? (
                <Image
                  source={selected ? TAB_ICONS[tab.icon].on : TAB_ICONS[tab.icon].off}
                  style={[
                    styles.icon,
                    { tintColor: selected ? color.text : color.textFaint },
                  ]}
                />
              ) : null}
              {(tab.count ?? 0) > 0 && (
                <View style={styles.count}>
                  <Text style={styles.countText}>{countLabel(tab.count ?? 0)}</Text>
                </View>
              )}
            </Tap>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Over the pages, a little see-through: what scrolls under it shows, as
  // under Instagram's. A hairline above, as under the header.
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    backgroundColor: color.background + "F2",
  },
  slot: {
    flex: 1,
  },
  tab: {
    height: TAB_BAR_HEIGHT,
    minWidth: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
  },
  count: {
    position: "absolute",
    top: space.xs,
    left: "50%",
    marginLeft: space.sm,
    minWidth: space.lg + space.xs / 2,
    height: space.lg + space.xs / 2,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.background,
    backgroundColor: color.badge,
  },
  countText: {
    color: color.onBadge,
    fontSize: fontSize.label,
    fontWeight: fontWeight.bold,
  },
});
