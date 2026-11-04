import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectionFeel } from "../haptics/haptics";
import { countLabel } from "../messages/MessagesRow";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  motion,
  radius,
  space,
} from "../theme/tokens";
import { tabName, tourPart } from "../tour/tourParts";
import { fadeTo, springTo } from "../ui/motion";
import { Tap } from "../ui/Tap";
import { useReduceMotion } from "../ui/useReduceMotion";

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

/** The soft capsule behind the tab on screen (TASK-388), in points. */
export const TAB_CAPSULE_WIDTH = 56;
export const TAB_CAPSULE_HEIGHT = 34;
/** How small an icon gets under the finger. */
export const TAB_PRESS_SCALE = 0.88;
/** How far the icon taking its tab rises, in points. */
export const TAB_ICON_RISE = 1.5;
/** How much the capsule stretches half way, for each tab it crosses, and at
 * most: a drop moving, never a band. */
export const TAB_STRETCH_PER_TAB = 0.08;
export const TAB_STRETCH_MOST = 0.2;

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
  /**
   * How far a finger has slid the pages from the page at rest, in pages,
   * signed (+1: the whole next page): the capsule follows it. It comes back
   * to 0 in the same commit that brings the new `page`.
   */
  drag?: Animated.AnimatedInterpolation<number> | Animated.Value;
};

/**
 * The tab bar at the foot of the app (TASK-367, ADR-0311), as Instagram's:
 * one icon a page, no words, over the home indicator. The page on screen is
 * told by the bolder line, by light and by a soft capsule behind it, never
 * by the route's yellow. The capsule slides to a new tab on the spring
 * `snappy`, stretching a little half way as a drop does (TASK-388,
 * ADR-0329); with «Reduce Motion» it fades in where it goes, nothing slides.
 */
export function TabBar({ tabs, page, onTab, drag }: Props) {
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const { width } = useWindowDimensions();
  const count = tabs.length;
  const slot = width / Math.max(count, 1);

  // The capsule's tab, as a number: 2.5 is half way from the third to the fourth.
  const [at] = useState(() => new Animated.Value(page));
  const [stretch] = useState(() => new Animated.Value(1));
  const [shown] = useState(() => new Animated.Value(1));

  // Where the finger last had the pages: a page reached by sliding is where
  // the capsule already is, and the spring has nothing to do.
  const dragged = useRef(0);
  useEffect(() => {
    if (!drag) {
      return;
    }
    const id = drag.addListener(({ value }) => {
      dragged.current = value;
    });
    return () => drag.removeListener(id);
  }, [drag]);

  const before = useRef(page);
  // In the commit that brings the page, so it never shows a frame behind.
  useLayoutEffect(() => {
    const from = before.current;
    if (from === page) {
      return;
    }
    before.current = page;
    if (still) {
      at.setValue(page);
      shown.setValue(0);
      fadeTo(shown, 1).start();
      return;
    }
    // A finger brought the pages a whole page or more: the capsule is there.
    const slid = Math.round(dragged.current);
    dragged.current = 0;
    let start = from;
    if (slid !== 0) {
      start = (((from + slid) % count) + count) % count;
      at.setValue(start);
      if (start === page) {
        return;
      }
    }
    const reach = Math.min(
      TAB_STRETCH_MOST,
      TAB_STRETCH_PER_TAB * Math.abs(page - start),
    );
    springTo(at, page, "snappy").start();
    Animated.sequence([
      Animated.timing(stretch, {
        toValue: 1 + reach,
        duration: motion.pressMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      springTo(stretch, 1, "snappy"),
    ]).start();
  }, [page, still, at, stretch, shown, count]);

  // Two more capsules a whole bar away on either side: sliding from the
  // last page round to the first, one leaves at the right edge as the
  // other comes in at the left.
  const moves = useMemo(() => {
    const where = drag ? Animated.add(at, drag) : at;
    const offset = (slot - TAB_CAPSULE_WIDTH) / 2;
    return [-1, 0, 1].map((round) =>
      where.interpolate({
        inputRange: [0, 1],
        outputRange: [
          offset + round * count * slot,
          offset + (round * count + 1) * slot,
        ],
      }),
    );
  }, [at, drag, slot, count]);

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
      testID="tab-bar"
    >
      <View style={styles.capsules} pointerEvents="none">
        {moves.map((translateX, round) => (
          <Animated.View
            key={round}
            testID={round === 1 ? "tab-capsule" : `tab-capsule-${round}`}
            style={[
              styles.capsule,
              { opacity: shown, transform: [{ translateX }, { scaleX: stretch }] },
            ]}
          />
        ))}
      </View>
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
              pressScale={TAB_PRESS_SCALE}
              onPress={() => {
                // A light buzz for a new tab only, not for every touch.
                if (index !== page) {
                  selectionFeel();
                }
                onTab(index);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
              <Glyph tab={tab} selected={selected} still={still} />
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

type GlyphProps = { tab: BarTab; selected: boolean; still: boolean };

/**
 * A tab's icon: taking its tab it rises a point and a half and its outline
 * gives way to the bolder line in a cross fade; with «Reduce Motion» only
 * the fade.
 */
function Glyph({ tab, selected, still }: GlyphProps) {
  const [on] = useState(() => new Animated.Value(selected ? 1 : 0));
  const was = useRef(selected);
  useEffect(() => {
    if (was.current === selected) {
      return;
    }
    was.current = selected;
    const to = selected ? 1 : 0;
    (still ? fadeTo(on, to) : springTo(on, to, "snappy")).start();
  }, [selected, still, on]);

  const rise = on.interpolate({
    inputRange: [0, 1],
    outputRange: [0, still ? 0 : -TAB_ICON_RISE],
  });
  if (tab.face) {
    return (
      <Animated.View style={{ transform: [{ translateY: rise }] }}>
        {tab.face(selected)}
      </Animated.View>
    );
  }
  if (!tab.icon) {
    return null;
  }
  // The spring passes its mark by a hair: the light never past full.
  const lit = on.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const unlit = on.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  return (
    <Animated.View style={[styles.icon, { transform: [{ translateY: rise }] }]}>
      <Animated.Image
        testID={`tab-icon-off-${tab.title}`}
        source={TAB_ICONS[tab.icon].off}
        style={[styles.layer, { tintColor: color.textFaint, opacity: unlit }]}
      />
      <Animated.Image
        testID={`tab-icon-on-${tab.title}`}
        source={TAB_ICONS[tab.icon].on}
        style={[styles.layer, { tintColor: color.text, opacity: lit }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Over the pages, a little see-through: what scrolls under it shows, as
  // under Instagram's. A hairline above, as under the header. What passes
  // its edges (a capsule going round) is cut.
  bar: {
    flexDirection: "row",
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    backgroundColor: color.background + "F2",
  },
  capsules: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
  },
  capsule: {
    position: "absolute",
    top: (TAB_BAR_HEIGHT - TAB_CAPSULE_HEIGHT) / 2,
    left: 0,
    width: TAB_CAPSULE_WIDTH,
    height: TAB_CAPSULE_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
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
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
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
