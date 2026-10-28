import type {
  ConversationBox,
  ConversationsUnread,
  Person,
} from "@shaperoute/shared-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { sessionEnded } from "../account/messages";
import type { Account } from "../account/useAccount";
import { fetchUnread } from "../api/messages";

/** What «Messages» shows over the app: a list, or one conversation. */
export type MessagesScreen =
  | { kind: "list"; box: ConversationBox }
  | {
      kind: "conversation";
      person: Person;
      /** Opened from the list: «←» goes back to it, else it closes. */
      fromList: ConversationBox | null;
    };

/**
 * The private messages (TASK-317, ADR-0277) as the whole app reaches them:
 * the list and the conversations over the app, opened from «Profile», from
 * «Message» on another's profile and from a notification; and what the dot
 * of «Messages» counts.
 */
export type MessagesDoor = {
  apiUrl: string | null;
  account: Pick<Account, "state" | "sessionEnded">;
  screen: MessagesScreen | null;
  openList: (box?: ConversationBox) => void;
  openConversation: (person: Person) => void;
  /** «←»: back to the list a conversation came from, else closed. */
  back: () => void;
  close: () => void;
  /**
   * Conversations with news and requests waiting; null until the API has
   * said, and for good with an API older than the messages: then the app
   * shows no «Messages».
   */
  unread: ConversationsUnread | null;
  /** Something read, accepted or deleted: the numbers are asked again. */
  recount: () => void;
};

const NOTHING: MessagesDoor = {
  apiUrl: null,
  account: { state: { status: "signedOut", notice: null }, sessionEnded: () => {} },
  screen: null,
  openList: () => {},
  openConversation: () => {},
  back: () => {},
  close: () => {},
  unread: null,
  recount: () => {},
};

/** Without «Profile» around it (a test of one screen): no messages. */
export const MessagesContext = createContext<MessagesDoor>(NOTHING);

export function useMessagesDoor(): MessagesDoor {
  return useContext(MessagesContext);
}

/** How often the app asks while it is open, as the follow requests. */
export const UNREAD_EVERY_MS = 60_000;

type Options = {
  fetchFn?: typeof fetch;
  key?: string | null;
  /** The time between two questions; the tests give their own. */
  everyMs?: number;
};

/** The numbers of one account: another token's are nobody's. */
type Held = { token: string; unread: ConversationsUnread };

/**
 * The messages of the account, for «Profile» to hand to the app. The
 * numbers are asked when the account is known, every minute while the app
 * is on screen, when it comes back to it, and after `recount`. Without an
 * answer the last numbers stay: a number is never worth an error on screen.
 */
export function useMessagesOf(
  baseUrl: string | null,
  account: Pick<Account, "state" | "sessionEnded">,
  options: Options = {},
): MessagesDoor {
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const [screen, setScreen] = useState<MessagesScreen | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  // Asked again by `recount`: the effect below runs once more.
  const [asks, setAsks] = useState(0);
  const { fetchFn, key, everyMs = UNREAD_EVERY_MS } = options;
  // An API older than the messages: asked once, then never again.
  const off = useRef<string | null>(null);

  useEffect(() => {
    if (token === null || baseUrl === null || off.current === token) {
      return;
    }
    let live = true;
    let onScreen = true;
    const ask = () => {
      if (off.current === token) {
        return;
      }
      void fetchUnread(baseUrl, token, { fetchFn, key }).then((outcome) => {
        if (!live) {
          return;
        }
        if (outcome.kind === "ok") {
          setHeld({ token, unread: outcome.value });
        } else if (outcome.kind === "api_error" && outcome.code === "http_error") {
          off.current = token;
        } else if (sessionEnded(outcome)) {
          onSessionEnded(token);
        }
      });
    };
    ask();
    const timer = setInterval(() => {
      if (onScreen) {
        ask();
      }
    }, everyMs);
    const subscription = AppState.addEventListener("change", (next) => {
      const was = onScreen;
      onScreen = next === "active";
      if (onScreen && !was) {
        ask();
      }
    });
    return () => {
      live = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [asks, baseUrl, everyMs, fetchFn, key, onSessionEnded, token]);

  // Logged out, or another account: nothing of the one before stays open.
  const [openedBy, setOpenedBy] = useState(token);
  if (openedBy !== token) {
    setOpenedBy(token);
    setScreen(null);
  }

  const openList = useCallback(
    (box: ConversationBox = "inbox") => setScreen({ kind: "list", box }),
    [],
  );
  const openConversation = useCallback(
    (person: Person) =>
      setScreen((was) => ({
        kind: "conversation",
        person,
        fromList: was?.kind === "list" ? was.box : null,
      })),
    [],
  );
  const back = useCallback(
    () =>
      setScreen((was) =>
        was?.kind === "conversation" && was.fromList !== null
          ? { kind: "list", box: was.fromList }
          : was?.kind === "list" && was.box === "requests"
            ? { kind: "list", box: "inbox" }
            : null,
      ),
    [],
  );
  const close = useCallback(() => setScreen(null), []);
  const recount = useCallback(() => setAsks((n) => n + 1), []);
  const unread = held !== null && held.token === token ? held.unread : null;

  return useMemo(
    () => ({
      apiUrl: baseUrl,
      account,
      screen,
      openList,
      openConversation,
      back,
      close,
      unread,
      recount,
    }),
    [
      account,
      back,
      baseUrl,
      close,
      openConversation,
      openList,
      recount,
      screen,
      unread,
    ],
  );
}
