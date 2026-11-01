import type { Person } from "@shaperoute/shared-types";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { type Account, useAccount } from "../account/useAccount";
import { ActivitiesContext, useActivitiesOf } from "../activities/activitiesDoor";
import {
  closeContestPage,
  openContestPage,
  useAskedContest,
} from "../contest/contestDoor";
import { askContestOnce } from "../contest/contestKept";
import { ContestPageHost } from "../contest/ContestPage";
import { FavoritesContext, useFavoritesOf } from "../favorites/favoritesDoor";
import { t, tPlural } from "../i18n";
import { MessagesContext, useMessagesOf } from "../messages/messagesDoor";
import { MessagesOverlay } from "../messages/MessagesOverlay";
import { usePushNotifications } from "../notifications/usePushNotifications";
import { ProfilePhotoContext, useProfilePhotoOf } from "../profile/useProfilePhoto";
import { CommentsContext, useCommentsOf } from "../social/commentsDoor";
import { DrawingsContext, useDrawingsOf } from "../social/drawingsDoor";
import { useFollowRequestsOf } from "../social/followRequests";
import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { PeopleContext } from "../social/peopleDoor";
import { openChallenge } from "../game/challengeDoor";
import { openPlay } from "../game/unlocks";
import { LOG_IN_TO_FIND } from "../social/PeopleSearch";
import { ReactionsContext, useReactionsOf } from "../social/reactionsDoor";
import { RequestsBadge } from "../social/RequestsBadge";
import { StravaContext, useStravaOf } from "../strava/useStrava";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { PeopleScreen } from "./PeopleScreen";
import { type ProfilePage, ProfileScreen } from "./ProfileScreen";

/** «Find friends» (TASK-215): on screen, or behind a drawing opened from it. */
type PeopleAt = "shown" | "behind" | null;

/** Where the first page of «Profile» is, for the pages opened from it: the
 * fourth page of the pager, under the layer (TASK-278), or the layer
 * itself, when the button opened «Profile» over the app. «←» goes back
 * there. A member opened from the app (a tagged name, a notification) has
 * no first page to go back to: «←» shows the app as it was (TASK-278 part
 * B, the user's choice). */
type Home = "page" | "layer" | "app";

/**
 * The fourth page asked for from elsewhere in the app (TASK-278 part B):
 * the heart or «Save» without an account, the lens of «Feed» without one,
 * the account's own name. `n` counts the asks, and the app goes to the
 * page at each new one; `hint` says why, over «Sign up».
 */
export type OwnAsk = { n: number; hint: string | null };

/** What the button in the header needs to know of the account. */
type Door = {
  /** «Profile» over the app: where the button goes outside the pager. */
  open: () => void;
  /** The session ended: «Profile» asks to log in again. */
  attention: boolean;
  /** The first letter of who is signed in; null when nobody is. */
  initial: string | null;
  /** Their picture (TASK-178), in place of the letter; null without one. */
  photo: string | null;
  /** How many ask to follow them and wait for an answer (TASK-239). */
  requests: number;
};

const DoorContext = createContext<Door>({
  open: () => {},
  attention: false,
  initial: null,
  photo: null,
  requests: 0,
});

/** What the fourth page needs to show the first page of «Profile». */
type OwnDoor = {
  account: Account;
  /** A page of «Profile» over the app, «←» back to the fourth page. */
  open: (page: ProfilePage) => void;
  /** The lists of who follows the account: a name opens a profile over the
   * app, and back comes to the fourth page. */
  follows: FollowsDoor;
  /** Something of the account is over the app, the fourth page under it. */
  covered: boolean;
  /** The last ask for the fourth page (TASK-278 part B). */
  asked: OwnAsk;
  /** The fourth page is left: the line of why goes, and without an account
   * the heart's route waits no more. */
  leave: () => void;
};

const OwnContext = createContext<OwnDoor | null>(null);

const NOT_ASKED: Pick<OwnDoor, "asked" | "leave"> = {
  asked: { n: 0, hint: null },
  leave: () => {},
};

/** For the app, which shows the pages (TASK-278 part B): when it is asked
 * to go to the fourth page, and how it says it left it. */
export function useOwnPage(): Pick<OwnDoor, "asked" | "leave"> {
  return useContext(OwnContext) ?? NOT_ASKED;
}

type Props = {
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  /** The app: its pages, the map, the run. */
  children: ReactNode;
};

/**
 * The account, and «Profile» over the app (TASK-115; TASK-154, ADR-0124).
 * Its first page is the fourth page of the pager (`OwnProfile`, TASK-278),
 * where the rest of the app sends whoever needs an account (TASK-278 part
 * B); the pages opened from there come over the app and close with their
 * way back, as «Profile» does when the button opens it outside the pager.
 * The app stays mounted underneath, with its map loaded and its choices as
 * they were left.
 */
export function ProfileLayer({ apiUrl, children }: Props) {
  // The page of «Profile» on screen; null while the app is.
  const [page, setPage] = useState<ProfilePage | null>(null);
  // Where «←» from a page of «Profile» goes back to (TASK-278).
  const home = useRef<Home>("layer");
  // Why «Profile» opened on its own, in a line over «Sign up» (the heart).
  const [hint, setHint] = useState<string | null>(null);
  // «Find friends», opened from «Feed» (TASK-215); a ref too, for the doors
  // of the drawings, made once.
  const [people, setPeopleState] = useState<PeopleAt>(null);
  const peopleAt = useRef<PeopleAt>(null);
  const setPeople = useCallback((next: PeopleAt) => {
    peopleAt.current = next;
    setPeopleState(next);
  }, []);
  // A member touched in the lists of «Profile» (TASK-211): «Find friends»
  // opens on their profile, and back comes to «Profile».
  const [member, setMember] = useState<Person | null>(null);
  const showMember = useCallback(
    (person: Person, from: Home) => {
      home.current = from;
      setMember(person);
      setPage(null);
      setPeople("shown");
    },
    [setPeople],
  );
  // The fourth page asked for from elsewhere (TASK-278 part B): what is of
  // the account over the app goes, and the app follows `asked` there.
  const [asked, setAsked] = useState<OwnAsk>(NOT_ASKED.asked);
  const showOwnPage = useCallback(
    (why: string | null) => {
      setMember(null);
      setPeople(null);
      setHint(null);
      setPage(null);
      closeContestPage();
      setAsked((last) => ({ n: last.n + 1, hint: why }));
    },
    [setPeople],
  );
  // Where the drawing on the map was opened: back goes there. From a page
  // («Feed», TASK-118; the profile's, TASK-278), with «Profile» closed, back
  // is the page under the map.
  const drawingFrom = useRef<"profile" | "people" | "page">("profile");
  // The page as the doors of the drawings, made once, see it.
  const pageAt = useRef<ProfilePage | null>(null);
  useEffect(() => {
    pageAt.current = page;
  }, [page]);
  const shown = page !== null || people === "shown";
  const account = useAccount(apiUrl);
  const { state } = account;
  // The favorites of the account (TASK-171): the heart on the map goes to
  // the fourth page when nobody is signed in; a favorite opened leaves
  // «Profile».
  const doors = useMemo(
    () => ({
      onProfile: (to: ProfilePage, why: string | null) => {
        // The heart without an account (TASK-278 part B); the list of a
        // favorite left goes back where it was.
        if (to === "account") {
          showOwnPage(why);
          return;
        }
        setHint(why);
        setPage(to);
      },
      onOpened: () => setPage(null),
    }),
    [showOwnPage],
  );
  const favorites = useFavoritesOf(apiUrl, account, doors);
  const { forgetWaiting } = favorites;
  // The runs of the account (TASK-172): one opened from its list leaves
  // «Profile» for the map, and comes back to the list.
  const activityDoors = useMemo(
    () => ({
      onList: () => {
        setHint(null);
        setPage("activities");
      },
      // «Save» without an account (TASK-278 part B).
      onAccount: showOwnPage,
      onOpened: () => setPage(null),
    }),
    [showOwnPage],
  );
  const activities = useActivitiesOf(apiUrl, account, activityDoors);
  // The picture of the account (TASK-178): changed in «Settings», shown
  // here and in «Profile».
  const photo = useProfilePhotoOf(apiUrl, account);
  // Strava of the account (TASK-187): the end of a run, a run of «My
  // activities» and «Settings» show it.
  const strava = useStravaOf(apiUrl, account);
  // The drawings (TASK-117): one opened from «Profile» over the app leaves
  // it for the map, and comes back to it; one opened from a member found by
  // «Find friends» comes back there (TASK-215); one opened from a page,
  // «Feed» (TASK-118) or the profile's (TASK-278), with «Profile» closed,
  // comes back to that page.
  const drawingDoors = useMemo(
    () => ({
      onOpened: () => {
        if (peopleAt.current === "shown") {
          drawingFrom.current = "people";
          setPeople("behind");
        } else {
          drawingFrom.current = pageAt.current === null ? "page" : "profile";
          setPeople(null);
        }
        setPage(null);
      },
      onBack: () => {
        setHint(null);
        if (drawingFrom.current === "people" && peopleAt.current !== null) {
          setPeople("shown");
        } else if (drawingFrom.current === "profile") {
          // Its first page: the fourth page, when that is where it was opened
          // (a notification over «Settings», TASK-278 part B).
          setPage(home.current === "page" ? null : "account");
        }
      },
      // «Draw it near me» (TASK-313): to «Draw», «Find friends» let go too,
      // and the page of a monthly challenge (TASK-343).
      onLeave: () => {
        setHint(null);
        setPeople(null);
        closeContestPage();
      },
    }),
    [setPeople],
  );
  const drawings = useDrawingsOf(apiUrl, account, drawingDoors);
  // What the members write under a drawing (TASK-120): the drawing's card
  // is in the app, on the map.
  const comments = useCommentsOf(apiUrl, account);
  // And the reactions they leave there (TASK-119).
  const reactions = useReactionsOf(apiUrl, account);
  // Who asks to follow the account (TASK-239): the number on the button
  // in the header, asked while the app is open.
  const { count: requests, counted: onRequests } = useFollowRequestsOf(apiUrl, account);
  const photoUri = photo.uri;
  const attention = state.status === "signedOut" && state.notice === "ended";
  const initial =
    state.status === "signedIn"
      ? state.session.user.username.charAt(0).toUpperCase()
      : null;
  // «Find friends» asks the API with the account: without one, the fourth
  // page first, saying why (TASK-278 part B).
  const signedIn = state.status === "signedIn";
  const peopleDoor = useMemo(
    () => ({
      open: () => {
        if (signedIn) {
          setMember(null);
          setPeople("shown");
          return;
        }
        showOwnPage(t(LOG_IN_TO_FIND));
      },
    }),
    [setPeople, showOwnPage, signedIn],
  );
  // In: the line of why has said what it had to.
  if (signedIn && asked.hint !== null) {
    setAsked({ n: asked.n, hint: null });
  }
  // A name tagged under a drawing on the map (TASK-208), or who acted in a
  // notification (TASK-262): their profile over the app, «←» back to the
  // app as it was; the account's own, the fourth page (TASK-278 part B).
  const ownId = signedIn ? (state.session.user.public_id ?? null) : null;
  // The contest for who signs in, once (TASK-343): the form of a run needs
  // its theme and what they entered, and «Feed» may not have been opened.
  const contestToken = signedIn ? state.session.token : null;
  useEffect(() => {
    if (contestToken !== null) {
      void askContestOnce(apiUrl, contestToken, ownId);
    }
  }, [apiUrl, contestToken, ownId]);
  const { opened: drawingOpened, back: closeDrawing } = drawings;
  const openSomeone = useCallback(
    (person: Person) => {
      if (person.public_id !== ownId) {
        showMember(person, "app");
        return;
      }
      if (drawingOpened !== null) {
        // The map leaves for the page: nothing to come back to.
        drawingFrom.current = "page";
        closeDrawing();
      }
      showOwnPage(null);
    },
    [closeDrawing, drawingOpened, ownId, showMember, showOwnPage],
  );
  // Who follows the account (TASK-211): «Profile» shows the lists, and a
  // name in them opens the member's profile over it.
  const followsDoor = useMemo(
    () => ({
      apiUrl,
      account,
      openProfile: openSomeone,
      requests,
      onRequests,
    }),
    [account, apiUrl, onRequests, openSomeone, requests],
  );
  // The lists of «Profile» over the app, opened by the button: back from a
  // member comes to it.
  const layerFollows = useMemo(
    () => ({
      ...followsDoor,
      openProfile: (person: Person) => showMember(person, "layer"),
    }),
    [followsDoor, showMember],
  );
  // The first page of «Profile» as the fourth page of the pager (TASK-278):
  // what it opens comes over the app, and back comes to it.
  const own = useMemo<OwnDoor>(
    () => ({
      account,
      open: (to) => {
        home.current = "page";
        setHint(null);
        // Its first page is the fourth page itself, never over the app.
        setPage(to === "account" ? null : to);
      },
      follows: {
        ...followsDoor,
        openProfile: (person: Person) => showMember(person, "page"),
      },
      covered: shown,
      asked,
      leave: () => {
        setAsked((last) => (last.hint === null ? last : { n: last.n, hint: null }));
        // As «←» did when «Profile» was over the map: the route is not kept.
        if (!signedIn) {
          forgetWaiting();
        }
      },
    }),
    [account, asked, followsDoor, forgetWaiting, shown, showMember, signedIn],
  );
  // Back to the first page of «Profile»: the fourth page, when it was
  // opened there.
  const onProfilePage = useCallback((to: ProfilePage) => {
    setPage(to === "account" && home.current === "page" ? null : to);
  }, []);
  // The private messages (TASK-319): «Messages» and the conversations over
  // everything else, and the numbers of the dot.
  const messages = useMessagesOf(apiUrl, account);
  // Push notifications (TASK-262): this phone's token on the API while the
  // switch is on; a notification touched opens its drawing or a profile,
  // as a tagged name does, or the conversation of a message.
  usePushNotifications(apiUrl, account, {
    openDrawing: (id) => drawings.open({ id }),
    openProfile: followsDoor.openProfile,
    // A shape of the game unlocked (TASK-296): the app shows «Play».
    openPlay,
    // A challenge's notification (TASK-296 part D): «Play» on the challenge.
    openChallenge,
    openConversation: messages.openConversation,
    // A monthly challenge's notification (TASK-343): its page.
    openContest: openContestPage,
  });
  // The page of a monthly challenge over the app (TASK-343): out of the way
  // while a drawing opened from it is on the map.
  const contestOver = useAskedContest() !== null && drawings.opened === null;
  const door = useMemo(
    () => ({
      open: () => {
        home.current = "layer";
        setHint(null);
        setPage("account");
      },
      attention,
      initial,
      photo: photoUri,
      requests,
    }),
    [attention, initial, photoUri, requests],
  );
  return (
    <DoorContext.Provider value={door}>
      <FavoritesContext.Provider value={favorites}>
        <ActivitiesContext.Provider value={activities}>
          <ProfilePhotoContext.Provider value={photo}>
            <StravaContext.Provider value={strava}>
              <DrawingsContext.Provider value={drawings}>
                <PeopleContext.Provider value={peopleDoor}>
                  <MessagesContext.Provider value={messages}>
                    <View style={styles.layer}>
                      <View
                        style={styles.app}
                        // Under «Profile» the app is out of the screen reader's sight too.
                        accessibilityElementsHidden={shown || contestOver}
                        importantForAccessibility={
                          shown || contestOver ? "no-hide-descendants" : "auto"
                        }
                      >
                        <CommentsContext.Provider value={comments}>
                          <ReactionsContext.Provider value={reactions}>
                            {/* The end of a run tags members, and a tagged
                              name opens a profile (TASK-208). */}
                            <FollowsContext.Provider value={followsDoor}>
                              <OwnContext.Provider value={own}>
                                {children}
                              </OwnContext.Provider>
                            </FollowsContext.Provider>
                          </ReactionsContext.Provider>
                        </CommentsContext.Provider>
                      </View>
                      {/* Under «Find friends» and «Profile»: a name in its
                        gallery opens over it, and back comes to it. */}
                      <FollowsContext.Provider value={followsDoor}>
                        <ContestPageHost />
                      </FollowsContext.Provider>
                      {people !== null && (
                        <PeopleScreen
                          // A member of the lists, or the search: not the same page.
                          key={member?.public_id ?? "search"}
                          apiUrl={apiUrl}
                          account={account}
                          first={member}
                          hidden={people === "behind"}
                          onBack={() => {
                            setPeople(null);
                            if (member !== null) {
                              setMember(null);
                              // The fourth page, or the app, is under it already.
                              if (home.current === "layer") {
                                setHint(null);
                                setPage("account");
                              }
                            }
                          }}
                        />
                      )}
                      {page !== null && (
                        <FollowsContext.Provider value={layerFollows}>
                          <ProfileScreen
                            account={account}
                            page={page}
                            onPage={onProfilePage}
                            hint={hint}
                            onBack={() => {
                              // Closed without an account: the heart's route waits no more.
                              forgetWaiting();
                              setPage(null);
                            }}
                          />
                        </FollowsContext.Provider>
                      )}
                      {/* Over everything: opened from a profile, «Profile» or a
                        notification, and closed back to it (TASK-319). */}
                      <MessagesOverlay />
                    </View>
                  </MessagesContext.Provider>
                </PeopleContext.Provider>
              </DrawingsContext.Provider>
            </StravaContext.Provider>
          </ProfilePhotoContext.Provider>
        </ActivitiesContext.Provider>
      </FavoritesContext.Provider>
    </DoorContext.Provider>
  );
}

/**
 * The first page of «Profile» as the fourth page of the pager, after
 * «Explore» (TASK-278): sign up or log in, or the account with its rows.
 * What it opens comes over the app, and «←» comes back here. Built anew
 * each time it comes on screen, as «Profile» was each time it opened: the
 * lists of who follows and the drawings are read again. Asked for by the
 * heart or «Save» without an account, it says why over «Sign up», as
 * «Profile» did over the app (TASK-278 part B).
 */
export function OwnProfile({
  active,
  onBack,
}: {
  active: boolean;
  /** Back to the map or the end of a run it was asked for from, until
   * somebody signs in: «←» and the title, as over the app (TASK-278 part
   * B, the user's choice). Left out, none, as on the other pages. */
  onBack?: () => void;
}) {
  const own = useContext(OwnContext);
  const shown = active && own !== null && !own.covered;
  const [visit, setVisit] = useState(0);
  const [wasShown, setWasShown] = useState(shown);
  if (shown !== wasShown) {
    setWasShown(shown);
    if (shown) {
      setVisit(visit + 1);
    }
  }
  if (own === null) {
    return null;
  }
  return (
    <FollowsContext.Provider value={own.follows}>
      <ProfileScreen
        key={visit}
        account={own.account}
        page="account"
        onPage={own.open}
        hint={own.asked.hint}
        onBack={onBack}
      />
    </FollowsContext.Provider>
  );
}

type ButtonProps = {
  /** In the pager (TASK-278): true while the profile is the page on screen,
   * and the button has the page's mark, as the names have. */
  selected?: boolean;
  /** Where a touch goes: the profile's page. Left out, «Profile» opens over
   * the app. */
  onPress?: () => void;
};

/**
 * The way to «Profile», at the right of the pages' names: the picture of
 * who is signed in (TASK-178), or their first letter, or a figure when
 * nobody is. At its top right, in red, how many ask to follow them
 * (TASK-239). Under it, the mark of the page on screen when it is the
 * profile's (TASK-278).
 */
export function ProfileButton({ selected, onPress }: ButtonProps = {}) {
  const { open, attention, initial, photo, requests } = useContext(DoorContext);
  return (
    <Pressable
      style={styles.button}
      onPress={onPress ?? open}
      accessibilityRole="button"
      accessibilityState={selected !== undefined ? { selected } : undefined}
      accessibilityLabel={
        requests > 0
          ? tPlural(
              requests,
              "Profile, {count} follow request",
              "Profile, {count} follow requests",
            )
          : t(attention ? "Profile, log in again" : "Profile")
      }
    >
      {initial !== null && photo !== null ? (
        <Image
          source={{ uri: photo }}
          style={styles.photo}
          testID="profile-button-photo"
          accessibilityIgnoresInvertColors
        />
      ) : initial !== null ? (
        <Text style={styles.initial}>{initial}</Text>
      ) : (
        <View style={styles.figure}>
          <View style={styles.head} />
          <View style={styles.shoulders} />
        </View>
      )}
      {attention && <View style={styles.dot} testID="profile-attention" />}
      <RequestsBadge count={requests} />
      {selected && <View style={styles.mark} testID="profile-page-mark" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    backgroundColor: color.background,
  },
  app: {
    flex: 1,
  },
  // Neutral, as every control that is not the route's (docs/UI.md, «Il tema»).
  button: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  // Inside the border of the button.
  photo: {
    width: MIN_TAP_SIZE - 2,
    height: MIN_TAP_SIZE - 2,
    borderRadius: radius.pill,
  },
  initial: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  // A head and shoulders, drawn: the app has no icons (no react-native-svg).
  figure: {
    alignItems: "center",
    gap: space.xs / 2,
  },
  head: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.text,
  },
  shoulders: {
    width: space.lg,
    height: space.sm,
    borderTopLeftRadius: space.sm,
    borderTopRightRadius: space.sm,
    backgroundColor: color.text,
  },
  dot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: space.sm + space.xs / 2,
    height: space.sm + space.xs / 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.background,
    backgroundColor: color.warning,
  },
  // The mark of the page on screen, as under the names (Pager.tsx), in the
  // room under the circle: the header keeps its height. Inside the border.
  mark: {
    position: "absolute",
    top: MIN_TAP_SIZE,
    left: (MIN_TAP_SIZE - 2 - space.xl) / 2,
    width: space.xl,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: color.text,
  },
});
