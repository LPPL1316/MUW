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
import { FavoritesContext, useFavoritesOf } from "../favorites/favoritesDoor";
import { t, tPlural } from "../i18n";
import { usePushNotifications } from "../notifications/usePushNotifications";
import { ProfilePhotoContext, useProfilePhotoOf } from "../profile/useProfilePhoto";
import { CommentsContext, useCommentsOf } from "../social/commentsDoor";
import { DrawingsContext, useDrawingsOf } from "../social/drawingsDoor";
import { useFollowRequestsOf } from "../social/followRequests";
import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { PeopleContext } from "../social/peopleDoor";
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
 * itself, when another page opened «Profile» over the app. «←» goes back
 * there. */
type Home = "page" | "layer";

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
};

const OwnContext = createContext<OwnDoor | null>(null);

type Props = {
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  /** The app: its pages, the map, the run. */
  children: ReactNode;
};

/**
 * The account, and «Profile» over the app (TASK-115; TASK-154, ADR-0124).
 * Its first page is the fourth page of the pager (`OwnProfile`, TASK-278);
 * the pages opened from there come over the app and close with their way
 * back, as «Profile» does when another page opens it. The app stays
 * mounted underneath, with its map loaded and its choices as they were
 * left.
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
  // The favorites of the account (TASK-171): the heart on the map opens
  // «Profile» when nobody is signed in; a favorite opened leaves it.
  const doors = useMemo(
    () => ({
      onProfile: (to: ProfilePage, why: string | null) => {
        // The heart without an account opens «Profile» over the map; the
        // list of a favorite left goes back where it was.
        if (to === "account") {
          home.current = "layer";
        }
        setHint(why);
        setPage(to);
      },
      onOpened: () => setPage(null),
    }),
    [],
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
      onAccount: (why: string) => {
        home.current = "layer";
        setHint(why);
        setPage("account");
      },
      onOpened: () => setPage(null),
    }),
    [],
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
          setPage("account");
        }
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
  // «Find friends» asks the API with the account: without one, «Profile»
  // first, saying why.
  const signedIn = state.status === "signedIn";
  const peopleDoor = useMemo(
    () => ({
      open: () => {
        if (signedIn) {
          setMember(null);
          setPeople("shown");
          return;
        }
        home.current = "layer";
        setHint(t(LOG_IN_TO_FIND));
        setPage("account");
      },
    }),
    [setPeople, signedIn],
  );
  // Who follows the account (TASK-211): «Profile» shows the lists, and a
  // name in them opens the member's profile over it.
  const followsDoor = useMemo(
    () => ({
      apiUrl,
      account,
      openProfile: (person: Person) => showMember(person, "layer"),
      requests,
      onRequests,
    }),
    [account, apiUrl, onRequests, requests, showMember],
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
    }),
    [account, followsDoor, shown, showMember],
  );
  // Back to the first page of «Profile»: the fourth page, when it was
  // opened there.
  const onProfilePage = useCallback((to: ProfilePage) => {
    setPage(to === "account" && home.current === "page" ? null : to);
  }, []);
  // Push notifications (TASK-262): this phone's token on the API while the
  // switch is on; a notification touched opens its drawing or a profile.
  usePushNotifications(apiUrl, account, {
    openDrawing: (id) => drawings.open({ id }),
    openProfile: followsDoor.openProfile,
  });
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
                  <View style={styles.layer}>
                    <View
                      style={styles.app}
                      // Under «Profile» the app is out of the screen reader's sight too.
                      accessibilityElementsHidden={shown}
                      importantForAccessibility={shown ? "no-hide-descendants" : "auto"}
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
                            // The fourth page is under it already.
                            if (home.current === "layer") {
                              setHint(null);
                              setPage("account");
                            }
                          }
                        }}
                      />
                    )}
                    {page !== null && (
                      <FollowsContext.Provider value={followsDoor}>
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
                  </View>
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
 * lists of who follows and the drawings are read again.
 */
export function OwnProfile({ active }: { active: boolean }) {
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
        hint={null}
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
