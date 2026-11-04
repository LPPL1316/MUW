import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
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

/**
 * The pages of the app under one header, over the tab bar (TASK-367,
 * ADR-0311), in place of the pages side by side (TASK-154): a tab touched
 * shows its page at once, no swipe between them. A page stays built once
 * reached, out of sight but with its scroll and its fields as they were
 * left. The tab of the page on screen touched again takes it back to its
 * top (`useTabReselect`). On Android «back» goes to the page shown before,
 * and leaves the app from the first one shown.
 */
export function TabShell({ pages, page, onPage, action }: Props) {
  const insets = useSafeAreaInsets();
  // By title, not by place, as the pager kept them.
  const [seen, setSeen] = useState<readonly string[]>(() =>
    pages.flatMap((each, index) => (each.lazy && index !== page ? [] : [each.title])),
  );
  const asked = pages[page]?.title;
  const built = asked === undefined || seen.includes(asked) ? seen : [...seen, asked];
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

  // The pages shown before, for «back» on Android.
  const before = useRef<string[]>([]);
  const shown = useRef(asked);
  useEffect(() => {
    const last = shown.current;
    if (asked !== last) {
      if (last !== undefined) {
        before.current = [...before.current.filter((title) => title !== asked), last];
      }
      shown.current = asked;
    }
  }, [asked]);
  const latest = useRef({ titles, onPage });
  useEffect(() => {
    latest.current = { titles, onPage };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const last = before.current.pop();
      if (last === undefined) {
        return false;
      }
      const index = latest.current.titles.indexOf(last);
      if (index < 0) {
        return false;
      }
      // Going back is no new step to come back from.
      shown.current = last;
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

  return (
    <View style={[StyleSheet.absoluteFill, styles.shell]}>
      <AppHeader action={action} />
      <Hairline />
      <View style={styles.pages} testID="tab-pages">
        <SafeAreaInsetsContext.Provider value={between}>
          {pages.map((each, index) => {
            const onScreen = index === page;
            if (!built.includes(each.title)) {
              return null;
            }
            return (
              <View
                key={each.title}
                ref={tourPart(pageName(each.title))}
                collapsable={false}
                // Out of sight, still built: its state stays as it was left.
                style={[StyleSheet.absoluteFill, !onScreen && styles.hidden]}
                accessibilityElementsHidden={!onScreen}
                importantForAccessibility={onScreen ? "auto" : "no-hide-descendants"}
              >
                <TabReselectContext.Provider value={reselectOf(each.title)}>
                  {each.render()}
                </TabReselectContext.Provider>
              </View>
            );
          })}
        </SafeAreaInsetsContext.Provider>
      </View>
      <TabBar tabs={pages} page={page} onTab={onTab} />
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
  hidden: {
    display: "none",
  },
});
