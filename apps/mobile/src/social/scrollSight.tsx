import {
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewProps,
  useWindowDimensions,
} from "react-native";

/** How often, at most, a page that scrolls tells what is inside it to look. */
const SCROLL_THROTTLE_MS = 100;

/** Where a view is on the screen, as `measureInWindow` answers. */
type Answer = (x: number, y: number, width: number, height: number) => void;

/** What can say where it is on the screen: a View. */
export type Measurable = { measureInWindow: (answer: Answer) => void };

/**
 * A page that scrolls, for the parts inside it that wait to come on screen
 * (TASK-332): it tells them each time it moves, and they look again where
 * they are. `measure` is how they look: the tests give their own.
 */
export class ScrollSight {
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly measure: (view: Measurable, answer: Answer) => void = (view, answer) =>
      view.measureInWindow(answer),
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The page moved. */
  moved = () => {
    this.listeners.forEach((listener) => listener());
  };
}

/** Null: no page tells when it scrolls, and all of it counts as on screen. */
export const ScrollSightContext = createContext<ScrollSight | null>(null);

/**
 * Whether a view `height` tall at `y` from the top of a window `window`
 * tall is in it, at least in part. A view not shown has no height: it is not.
 */
export function inSight(y: number, height: number, window: number): boolean {
  return height > 0 && y < window && y + height > 0;
}

/**
 * Whether `view` has come on screen, in the page that scrolls around it:
 * true from the first time it is, for good. `look` goes in its `onLayout`,
 * and the page's moves call it again until then. Outside such a page, true
 * at once.
 */
export function useSeen(view: RefObject<Measurable | null>): {
  seen: boolean;
  look: () => void;
} {
  const sight = useContext(ScrollSightContext);
  const { height: window } = useWindowDimensions();
  const [seen, setSeen] = useState(false);
  const look = useCallback(() => {
    const now = view.current;
    if (sight === null || seen || now === null) {
      return;
    }
    sight.measure(now, (_x, y, _width, height) => {
      if (inSight(y, height, window)) {
        setSeen(true);
      }
    });
  }, [sight, seen, view, window]);
  useEffect(() => {
    if (sight === null || seen) {
      return;
    }
    return sight.subscribe(look);
  }, [sight, seen, look]);
  return { seen: seen || sight === null, look };
}

/**
 * A `ScrollView` that tells the parts inside it when it moves
 * (`useSeen`): a picture they show is asked for once it is on screen, not
 * all of a long page's at once.
 */
export function SightScrollView({ children, onScroll, ...props }: ScrollViewProps) {
  const [sight] = useState(() => new ScrollSight());
  return (
    <ScrollView
      {...props}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        sight.moved();
        onScroll?.(event);
      }}
      scrollEventThrottle={SCROLL_THROTTLE_MS}
    >
      <ScrollSightContext.Provider value={sight}>
        {children}
      </ScrollSightContext.Provider>
    </ScrollView>
  );
}
