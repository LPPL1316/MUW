import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { pageName, tabName, tourPart, useTourPager } from "../tour/tourParts";
import { TOUR_PART } from "../tour/tourSteps";

export type PagerPage = {
  /** Its name in the header: what is touched to go there. */
  title: string;
  /** Built only when first reached: a page that asks the API as it opens
   * («Explore») asks nothing until someone goes to look. */
  lazy?: boolean;
  /** Not named in the header: a control of `action` goes there, and shows
   * when it is on screen (the profile's circle, TASK-278). */
  unnamed?: boolean;
  render: () => ReactNode;
};

type Props = {
  /** The pages, left to right, one swipe apart. */
  pages: readonly PagerPage[];
  /** The one on screen. */
  page: number;
  onPage: (index: number) => void;
  /** At the right of the names: the sport, and the way to the profile. */
  action?: ReactNode;
};

/** A sideways scroll never rests exactly on a page: this much is the page. */
const SLACK = 1;

/** The page a scroll offset rests on. */
export function pageAt(x: number, width: number, count: number): number {
  if (width <= 0) {
    return 0;
  }
  return Math.min(count - 1, Math.max(0, Math.round(x / width)));
}

/** The pages a scroll offset shows at least a part of. */
export function pagesInView(x: number, width: number, count: number): number[] {
  if (width <= 0) {
    return [];
  }
  const first = Math.max(0, Math.floor((x + SLACK) / width));
  const last = Math.min(count - 1, Math.ceil((x - SLACK) / width));
  const pages: number[] = [];
  for (let index = first; index <= last; index += 1) {
    pages.push(index);
  }
  return pages;
}

/**
 * The pages of the app side by side (TASK-154, ADR-0124): a swipe to the
 * left or to the right goes to the next one, and so does touching its name
 * in the header, which shows them in the order they lie in. A page without
 * a name there (the profile, TASK-278) is reached by its control in
 * `action`. Made of the paging scroll of React Native: no navigation
 * library, as in TASK-051.
 */
export function Pager({ pages, page, onPage, action }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  // Where the scroll rests, as it last said. A `page` that differs came from
  // outside (a name touched, the app): it is one to scroll to.
  const rests = useRef(page);
  const laidOut = useRef(width);
  // Where the scroll starts: one object, or each render would move it.
  const [start] = useState(() => ({ x: page * width, y: 0 }));
  // By title, not by place: a page that joins the row later («Play» once the
  // API says it has the game, TASK-296) moves the ones after it without
  // taking them down.
  const [seen, setSeen] = useState<readonly string[]>(() =>
    pages.flatMap((each, index) => (each.lazy && index !== page ? [] : [each.title])),
  );
  // A page asked for from outside is built before the scroll gets there.
  const asked = pages[page]?.title;
  const built = asked === undefined || seen.includes(asked) ? seen : [...seen, asked];
  if (built !== seen) {
    setSeen(built);
  }
  // How tall the pages are, once the scroll is laid out: as tall as it is.
  const [height, setHeight] = useState<number | null>(null);
  // The header keeps the top edge: the pages start under it.
  const under = useMemo(() => ({ ...insets, top: 0 }), [insets]);
  // The tour of the first opening moves between the pages (TASK-266).
  const titles = useMemo(() => pages.map((each) => each.title), [pages]);
  useTourPager(titles, page, onPage);

  useEffect(() => {
    const turned = laidOut.current !== width;
    laidOut.current = width;
    if (turned || rests.current !== page) {
      rests.current = page;
      // A phone turned keeps its page, at once; a name touched slides to it.
      scroller.current?.scrollTo({ x: page * width, y: 0, animated: !turned });
    }
  }, [page, width]);

  function restOn(index: number) {
    rests.current = index;
    if (index !== page) {
      onPage(index);
    }
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const reached = pagesInView(event.nativeEvent.contentOffset.x, width, pages.length)
      .map((index) => pages[index].title)
      .filter((title) => !built.includes(title));
    if (reached.length > 0) {
      setSeen([...built, ...reached]);
    }
  }

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    restOn(pageAt(event.nativeEvent.contentOffset.x, width, pages.length));
  }

  function onLayout(event: LayoutChangeEvent) {
    setHeight(event.nativeEvent.layout.height);
    // Android may not start where `contentOffset` says.
    scroller.current?.scrollTo({ x: rests.current * width, y: 0, animated: false });
  }

  // A finger lifted right on a page leaves no momentum to wait for.
  function onDragEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    const index = pageAt(x, width, pages.length);
    if (Math.abs(x - index * width) <= SLACK) {
      restOn(index);
    }
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.pager]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.names} accessibilityRole="tablist">
          {pages.map((each, index) => {
            if (each.unnamed) {
              return null;
            }
            const selected = index === page;
            return (
              <Pressable
                key={each.title}
                ref={tourPart(tabName(each.title))}
                style={styles.name}
                onPress={() => onPage(index)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={each.title}
              >
                <Text style={[styles.nameText, selected && styles.nameTextSelected]}>
                  {each.title}
                </Text>
                <View style={[styles.mark, selected && styles.markSelected]} />
              </Pressable>
            );
          })}
        </View>
        {action && (
          // The sport and «Profile», shown by the tour together.
          <View ref={tourPart(TOUR_PART.header)} collapsable={false}>
            {action}
          </View>
        )}
      </View>
      <ScrollView
        ref={scroller}
        testID="pager"
        style={styles.pages}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentOffset={start}
        onLayout={onLayout}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onDragEnd}
      >
        <SafeAreaInsetsContext.Provider value={under}>
          {pages.map((each, index) => {
            const onScreen = index === page;
            return (
              <View
                key={each.title}
                ref={tourPart(pageName(each.title))}
                collapsable={false}
                style={[{ width }, height !== null && { height }]}
                // A page out of sight is out of the screen reader's too.
                accessibilityElementsHidden={!onScreen}
                importantForAccessibility={onScreen ? "auto" : "no-hide-descendants"}
              >
                {built.includes(each.title) && each.render()}
              </View>
            );
          })}
        </SafeAreaInsetsContext.Provider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    backgroundColor: color.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.xs,
  },
  names: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
  },
  name: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  nameText: {
    color: color.textMuted,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  // The page on screen is told by light, not by yellow: that is the route's.
  nameTextSelected: {
    color: color.text,
  },
  mark: {
    width: space.xl,
    height: 3,
    borderRadius: radius.pill,
  },
  markSelected: {
    backgroundColor: color.text,
  },
  pages: {
    flex: 1,
  },
});
