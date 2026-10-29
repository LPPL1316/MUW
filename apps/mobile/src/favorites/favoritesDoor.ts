import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Account } from "../account/useAccount";
import { sessionEnded } from "../account/messages";
import { type Favorite, type FavoriteDetail, fetchFavorite } from "../api/favorites";
import { t, tLater } from "../i18n";
import { type Keepable, type OpenedFavorite, openedFavorite } from "./favoriteRoute";
import { favoriteProblem, type FavoritesState, useFavorites } from "./useFavorites";

/**
 * The favorites as the whole app reaches them (TASK-171): the heart on the
 * map, the list in «Profile», and the favorite opened from the list, which
 * the map shows.
 */
export type FavoritesDoor = FavoritesState & {
  /** The heart: keeps the route or removes it; with nobody signed in,
   * «Profile» first, and the route is kept once somebody is. */
  press: (route: Keepable) => void;
  /** The favorite of the list being fetched whole, by id; null when none. */
  opening: string | null;
  /** Fetches the favorite whole and shows it on the map. */
  open: (favorite: Favorite) => void;
  /**
   * Shows on the map a route that is not among the favorites, as one: a
   * drawing of a message (TASK-333). «←» of its card goes to `back`, not to
   * the list.
   */
  show: (detail: FavoriteDetail, back: () => void) => void;
  /** The favorite on the map; null when none. */
  opened: OpenedFavorite | null;
  /** The map lets the favorite go. */
  close: () => void;
  /** From the map back to the list in «Profile». */
  showList: () => void;
  /** «Profile» closed without an account: the route that waited is dropped. */
  forgetWaiting: () => void;
};

const NOTHING: FavoritesDoor = {
  status: "off",
  list: [],
  problem: null,
  has: () => false,
  toggle: () => {},
  remove: () => {},
  refresh: () => {},
  clearProblem: () => {},
  press: () => {},
  opening: null,
  open: () => {},
  show: () => {},
  opened: null,
  close: () => {},
  showList: () => {},
  forgetWaiting: () => {},
};

/** Without «Profile» around it (a test of one screen): no favorites. */
export const FavoritesContext = createContext<FavoritesDoor>(NOTHING);

export function useFavoritesDoor(): FavoritesDoor {
  return useContext(FavoritesContext);
}

/** What «Profile» says to who taps the heart without an account; shown
 * with `t(SIGN_IN_TO_KEEP)` (TASK-210). */
export const SIGN_IN_TO_KEEP = tLater(
  "Sign up or log in to keep your favorite routes.",
);

type Doors = {
  /** Opens «Profile»: on the list, or on the account with a line that says why. */
  onProfile: (page: "account" | "favorites", hint: string | null) => void;
  /** A favorite is on the map: «Profile» gets out of its way. */
  onOpened: () => void;
};

type Options = { fetchFn?: typeof fetch; key?: string | null; now?: () => Date };

/** The favorites of the account, for «Profile» to hand to the app. */
export function useFavoritesOf(
  baseUrl: string | null,
  account: Account,
  { onProfile, onOpened }: Doors,
  options: Options = {},
): FavoritesDoor {
  const { state } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const favorites = useFavorites(baseUrl, token, account.sessionEnded, options);
  const { status, has, toggle } = favorites;
  const { fetchFn, key } = options;

  // The route whose heart was tapped with nobody signed in.
  const waiting = useRef<Keepable | null>(null);
  const press = useCallback(
    (route: Keepable) => {
      if (token === null) {
        waiting.current = route;
        onProfile("account", t(SIGN_IN_TO_KEEP));
        return;
      }
      toggle(route);
    },
    [onProfile, toggle, token],
  );
  // Somebody signed in, and their list is here: the route is kept, unless
  // it already was.
  useEffect(() => {
    const route = waiting.current;
    if (status === "ready" && route !== null) {
      waiting.current = null;
      if (!has(route.id)) {
        toggle(route);
      }
    }
  }, [status, has, toggle]);
  const forgetWaiting = useCallback(() => {
    waiting.current = null;
  }, []);

  const [opening, setOpening] = useState<string | null>(null);
  const [opened, setOpened] = useState<OpenedFavorite | null>(null);
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  // The last favorite asked for wins.
  const asked = useRef<string | null>(null);
  // Where «←» goes from a route shown with `show`; null: the list. Kept
  // when the map lets the route go, which comes before «←» asks for it.
  const back = useRef<(() => void) | null>(null);
  const { sessionEnded: endSession } = account;
  const open = useCallback(
    (favorite: Favorite) => {
      if (token === null || baseUrl === null) {
        return;
      }
      asked.current = favorite.id;
      back.current = null;
      setOpening(favorite.id);
      setOpenProblem(null);
      void fetchFavorite(baseUrl, token, favorite.id, { fetchFn, key }).then(
        (outcome) => {
          if (asked.current !== favorite.id) {
            return;
          }
          asked.current = null;
          setOpening(null);
          if (outcome.kind === "ok") {
            setOpened(openedFavorite(outcome.value));
            onOpened();
            return;
          }
          if (sessionEnded(outcome)) {
            endSession(token);
          }
          setOpenProblem(favoriteProblem(outcome));
        },
      );
    },
    [baseUrl, endSession, fetchFn, key, onOpened, token],
  );
  const show = useCallback(
    (detail: FavoriteDetail, onBack: () => void) => {
      asked.current = null;
      back.current = onBack;
      setOpening(null);
      setOpenProblem(null);
      setOpened(openedFavorite(detail));
      onOpened();
    },
    [onOpened],
  );
  const close = useCallback(() => {
    asked.current = null;
    setOpening(null);
    setOpened(null);
  }, []);
  const showList = useCallback(() => {
    const to = back.current;
    back.current = null;
    if (to !== null) {
      to();
      return;
    }
    onProfile("favorites", null);
  }, [onProfile]);

  const { clearProblem: clearListProblem } = favorites;
  const clearProblem = useCallback(() => {
    clearListProblem();
    setOpenProblem(null);
  }, [clearListProblem]);

  return useMemo(
    () => ({
      ...favorites,
      problem: favorites.problem ?? openProblem,
      clearProblem,
      press,
      opening,
      open,
      show,
      opened,
      close,
      showList,
      forgetWaiting,
    }),
    [
      favorites,
      openProblem,
      clearProblem,
      press,
      opening,
      open,
      show,
      opened,
      close,
      showList,
      forgetWaiting,
    ],
  );
}
