import { Component } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

import { useTabReselect } from "../tabs/tabReselect";
import { TourScroll, TourScrollContext } from "./tourParts";

/** Back to the top when the tab of the page is touched again (TASK-367). */
function ToTopOnReselect({ scroll }: { scroll: TourScroll }) {
  useTabReselect(() => scroll.view?.scrollTo({ y: 0, animated: true }));
  return null;
}

/**
 * A `ScrollView` whose parts the tour of the first opening can scroll to
 * (TASK-266): it keeps itself and how far it is scrolled for them. A class,
 * so the scroll it keeps is made once and read only by the tour, after the
 * screen is drawn.
 */
export class TourScrollView extends Component<ScrollViewProps> {
  private readonly scroll = new TourScroll();

  render() {
    const { children, ...props } = this.props;
    return (
      <ScrollView
        {...props}
        ref={this.scroll.hold}
        onScroll={this.scroll.onScroll}
        scrollEventThrottle={16}
      >
        <ToTopOnReselect scroll={this.scroll} />
        <TourScrollContext.Provider value={this.scroll}>
          {children}
        </TourScrollContext.Provider>
      </ScrollView>
    );
  }
}
