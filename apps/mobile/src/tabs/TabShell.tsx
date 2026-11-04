import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { color } from "../theme/tokens";
import { pageName, tourPart, useTourPager } from "../tour/tourParts";
import { Hairline } from "../ui/Hairline";
import { AppHeader } from "./AppHeader";
import { type BarTab, TabBar } from "./TabBar";
import { TabReselect, TabReselectContext } from "./tabReselect";
import {
  pagesAround,
  placeAt,
  placesInView,
  restsOnPlace,
  type Strip,
  STRIP_PLACES,
  STRIP_START,
  stripAt,
} from "./tabStrip";

export type ShellPage = BarTab & {
  /** Built only when first reached: a page that asks the API as it opens
   * («Explore») asks nothing until someone goes to look. */
  lazy?: boolean;
  render: () => ReactNode;
};

type Props = {
  /** The pages, in the order of their tabs. */
  pages: readonly ShellPage[];
  /** The one on screen. */
  page: number;
  onPage: (index: number) => void;
  /** At the right of the header: the sport. */
  action?: ReactNode;
};

/** Whether VoiceOver or TalkBack is on. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (enabled) => {
        if (mounted) {
          setOn(enabled);
        }
      },
      () => {},
    );
    const listening = AccessibilityInfo.addEventListener("screenReaderChanged", setOn);
    return () => {
      mounted = false;
      listening.remove();
    };
  }, []);
  return on;
}

/**
 * The pages of the app under one header, over the tab bar (TASK-367,
 * ADR-0311). A tab touched shows its page at once; a swipe to the left or to
 * the right slides to the page beside it, round and round: after the
 * profile comes «Feed» (TASK-379, ADR-0323). A page stays built once
 * reached, out of sight but with its scroll and its fields as they were
 * left. The tab of the page on screen touched again takes it back to its
 * top (`useTabReselect`). On Android «back» goes to the page shown before,
 * and leaves the app from the first one shown.
 *
 * A row or a set of photos that slides sideways inside a page keeps the
 * finger that starts on it: the paging scroll of React Native, one inside
 * the other, as the pages side by side of TASK-154 were.
 */
export function TabShell({ pages, page, onPage, action }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const count = pages.length;
  // VoiceOver goes by the tabs: a three-finger swipe would say «page 1001
  // of 2000», the strip's.
  const screenReader = useScreenReader();
  const scroller = useRef<ScrollView>(null);
  // The page on screen and its place on the strip; `asked` is the app's page
  // as last seen. When the app moves (a tab, the tour, «back», the profile
  // in place of «Messages»), its page comes at once where the strip is.
  const [strip, setStrip] = useState<Strip & { asked: number }>(() => ({
    page,
    place: STRIP_START,
    asked: page,
  }));
  let now = strip;
  if (page !== strip.asked) {
    now = { page, place: strip.place, asked: page };
    setStrip(now);
  }
  // Where the scroll starts: one object, or each render would move it.
  const [start] = useState(() => ({ x: STRIP_START * width, y: 0 }));
  const around = pagesAround(now, count);
  // How far a finger has slid the strip from the app's page, in pages: the
  // bar's capsule follows it (TASK-388). The app's page keeps its place all
  // through a swipe, and moves only in the commit that brings a new page,
  // after the bar has taken it: the capsule never shows a frame behind.
  const [scrollX] = useState(() => new Animated.Value(start.x));
  const [restX] = useState(() => new Animated.Value(start.x));
  const restPlace = around.get(page) ?? now.place;
  useLayoutEffect(() => {
    restX.setValue(restPlace * width);
  }, [restX, restPlace, width]);
  const drag = useMemo(
    () => Animated.divide(Animated.subtract(scrollX, restX), width),
    [scrollX, restX, width],
  );
  // By title, not by place, as the pager kept them.
  const [seen, setSeen] = useState<readonly string[]>(() =>
    pages.flatMap((each, index) => (each.lazy && index !== page ? [] : [each.title])),
  );
  const shown = pages[now.page]?.title;
  const built = shown === undefined || seen.includes(shown) ? seen : [...seen, shown];
  if (built !== seen) {
    setSeen(built);
  }
  // The header keeps the top edge and the bar the bottom one: the pages
  // lie between them.
  const between = useMemo(() => ({ ...insets, top: 0, bottom: 0 }), [insets]);
  // One for each page, made the first time it is asked for.
  const [reselects] = useState(() => new Map<string, TabReselect>());
  function reselectOf(title: string): TabReselect {
    let reselect = reselects.get(title);
    if (reselect === undefined) {
      reselect = new TabReselect();
      reselects.set(title, reselect);
    }
    return reselect;
  }
  // The tour of the first opening moves between the pages (TASK-266).
  const titles = useMemo(() => pages.map((each) => each.title), [pages]);
  useTourPager(titles, page, onPage);

  // The app moved, or the phone turned: the strip stands on its place. Not
  // while a finger slides it from place to place.
  const standsOn = useRef(now.place);
  useEffect(() => {
    standsOn.current = now.place;
  });
  useEffect(() => {
    scroller.current?.scrollTo({ x: standsOn.current * width, y: 0, animated: false });
  }, [now.asked, width]);

  // The pages shown before, for «back» on Android.
  const asked = pages[page]?.title;
  const before = useRef<string[]>([]);
  const last = useRef(asked);
  useEffect(() => {
    const was = last.current;
    if (asked !== was) {
      if (was !== undefined) {
        before.current = [...before.current.filter((title) => title !== asked), was];
      }
      last.current = asked;
    }
  }, [asked]);
  const latest = useRef({ titles, onPage });
  useEffect(() => {
    latest.current = { titles, onPage };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const previous = before.current.pop();
      if (previous === undefined) {
        return false;
      }
      const index = latest.current.titles.indexOf(previous);
      if (index < 0) {
        return false;
      }
      // Going back is no new step to come back from.
      last.current = previous;
      latest.current.onPage(index);
      return true;
    });
    return () => subscription.remove();
  }, []);

  function onTab(index: number) {
    if (index === page) {
      reselectOf(pages[index].title).reselect();
    } else {
      onPage(index);
    }
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    // The first pixels of a page build it: it slides in whole.
    const inView = placesInView(x, width);
    const reached = pages
      .filter((each, index) => {
        const place = around.get(index);
        return place !== undefined && inView.includes(place);
      })
      .map((each) => each.title)
      .filter((title) => !built.includes(title));
    if (reached.length > 0) {
      setSeen([...built, ...reached]);
    }
    // Past half way the page beside is the one on screen, and the next one
    // takes its place beyond it, out of sight.
    const nearest = placeAt(x, width);
    if (nearest !== now.place) {
      setStrip({ ...stripAt(now, nearest, count), asked: now.asked });
    }
  }

  function restOn(x: number) {
    const rest = stripAt(now, placeAt(x, width), count);
    if (rest !== now) {
      setStrip({ ...rest, asked: now.asked });
    }
    if (rest.page !== page) {
      onPage(rest.page);
    }
  }

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    restOn(event.nativeEvent.contentOffset.x);
  }

  // A finger lifted right on a page leaves no momentum to wait for.
  function onDragEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    if (restsOnPlace(x, width)) {
      restOn(x);
    }
  }

  // The strip's offset goes to `scrollX` on the native driver; `onScroll`
  // hears every event as before, through the last render's handler.
  const hear = useRef(onScroll);
  useLayoutEffect(() => {
    hear.current = onScroll;
  });
  const [onStripScroll] = useState(() =>
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => hear.current(event),
    }),
  );

  function onLayout() {
    // Android may not start where `contentOffset` says.
    scroller.current?.scrollTo({ x: standsOn.current * width, y: 0, animated: false });
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.shell]}>
      <AppHeader action={action} />
      <Hairline />
      <Animated.ScrollView
        ref={scroller}
        testID="tab-pages"
        style={styles.pages}
        contentContainerStyle={{ width: STRIP_PLACES * width }}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        directionalLockEnabled
        // A touch on the clock goes to the page's own scroll.
        scrollsToTop={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEnabled={!screenReader}
        contentOffset={start}
        onLayout={onLayout}
        scrollEventThrottle={16}
        onScroll={onStripScroll}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onDragEnd}
      >
        <SafeAreaInsetsContext.Provider value={between}>
          {pages.map((each, index) => {
            const place = around.get(index);
            const isBuilt = built.includes(each.title);
            if (!isBuilt && place === undefined) {
              return null;
            }
            const onScreen = index === now.page;
            return (
              <View
                key={each.title}
                ref={tourPart(pageName(each.title))}
                collapsable={false}
                testID={`tab-page-${each.title}`}
                // Out of sight and a swipe away, still built: its state stays
                // as it was left.
                style={[
                  styles.page,
                  place === undefined ? styles.hidden : { left: place * width, width },
                ]}
                accessibilityElementsHidden={!onScreen}
                importantForAccessibility={onScreen ? "auto" : "no-hide-descendants"}
              >
                {isBuilt && (
                  <TabReselectContext.Provider value={reselectOf(each.title)}>
                    {each.render()}
                  </TabReselectContext.Provider>
                )}
              </View>
            );
          })}
        </SafeAreaInsetsContext.Provider>
      </Animated.ScrollView>
      <TabBar tabs={pages} page={page} onTab={onTab} drag={drag} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: color.background,
  },
  pages: {
    flex: 1,
  },
  page: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  hidden: {
    display: "none",
  },
});
