import type { Person } from "@shaperoute/shared-types";
import { useEffect, useRef } from "react";

import type { Account } from "../account/useAccount";
import { sessionEnded } from "../account/messages";
import { forgetPushToken, keepPushToken } from "../api/pushToken";
import { useLanguage } from "../i18n/useLanguage";
import { tapTarget } from "./notificationTap";
import {
  devicePushToken,
  onNotificationTapped,
  pushPermission,
  pushPlatform,
  showWhileOpen,
} from "./pushDevice";
import { type PushDeps, sendPushToken, takeBackPushToken } from "./pushRegistration";
import { forgetPushSent, loadPushSent, savePushSent } from "./pushSent";

type Opens = {
  /** Shows the drawing `id` on the map, fetched whole. */
  openDrawing: (id: string) => void;
  /** Shows the profile of `person`. */
  openProfile: (person: Person) => void;
  /** Shows the «Play» page: a shape of the game unlocked (TASK-296). */
  openPlay: () => void;
  /** Shows the challenge `id` of the game (TASK-296 part D): a piece done,
   * a shape completed, a day left. */
  openChallenge: (id: string) => void;
  /** Shows the conversation with `person`: a message, a message request
   * (TASK-319). Without it, their profile. */
  openConversation?: (person: Person) => void;
  /** Shows the page of the monthly challenge `id` (TASK-343 part B): a new
   * one, its last days, its results. */
  openContest?: (id: string) => void;
};

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * Push notifications on this phone (TASK-262, ADR-0226), for «Profile»,
 * which holds the account:
 *
 * - with «Push notifications» on and the phone allowing them, this phone's
 *   token goes to the API, once (again for another account, token or
 *   language); turned off, it comes back. Never asks the phone: only the
 *   switch in «Settings» does;
 * - a notification touched opens its drawing or the profile of who acted,
 *   while somebody is signed in.
 */
export function usePushNotifications(
  baseUrl: string | null,
  account: Pick<Account, "state" | "sessionEnded">,
  opens: Opens,
  options: Options = {},
): void {
  const language = useLanguage();
  const session = account.state.status === "signedIn" ? account.state.session : null;
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;
  const pushOn = session?.user.notifications?.push ?? false;
  const { fetchFn, key } = options;
  // One change of the token at a time, in the order asked.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // The latest of what the answers and the touches need.
  const ended = useRef(account.sessionEnded);
  const latest = useRef({ opens, signedIn: token !== null });
  useEffect(() => {
    ended.current = account.sessionEnded;
    latest.current = { opens, signedIn: token !== null };
  });

  useEffect(() => {
    if (baseUrl === null || token === null || userId === null) {
      return;
    }
    const deps: PushDeps = {
      permission: pushPermission,
      deviceToken: () => devicePushToken(),
      platform: pushPlatform(),
      keep: (request) => keepPushToken(baseUrl, token, request, { fetchFn, key }),
      forget: (pushToken) =>
        forgetPushToken(baseUrl, token, pushToken, { fetchFn, key }),
      sent: loadPushSent,
      save: savePushSent,
      clear: forgetPushSent,
    };
    queue.current = queue.current.then(async () => {
      if (!pushOn) {
        await takeBackPushToken(userId, deps);
        return;
      }
      const sending = await sendPushToken(userId, language, deps);
      if (sending.kind === "failed" && sessionEnded(sending.outcome)) {
        ended.current(token);
      }
    });
  }, [baseUrl, fetchFn, key, language, pushOn, token, userId]);

  // What a touch opens: the latest doors, and only with an account.
  useEffect(() => {
    showWhileOpen();
    return onNotificationTapped((data) => {
      const target = tapTarget(data);
      if (target === null || !latest.current.signedIn) {
        return;
      }
      if (target.kind === "drawing") {
        latest.current.opens.openDrawing(target.id);
      } else if (target.kind === "profile") {
        latest.current.opens.openProfile(target.person);
      } else if (target.kind === "conversation") {
        const { openConversation, openProfile } = latest.current.opens;
        (openConversation ?? openProfile)(target.person);
      } else if (target.kind === "challenge") {
        latest.current.opens.openChallenge(target.id);
      } else if (target.kind === "contest") {
        latest.current.opens.openContest?.(target.id);
      } else {
        latest.current.opens.openPlay();
      }
    });
  }, []);
}
