import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { hapticsAvailable } from "../haptics/haptics";
import { t } from "../i18n";
import { askPushPermission } from "../notifications/pushDevice";
import { chime } from "../stretch/chime";
import { type Rest, SOON_MS } from "./restTimer";

/**
 * What tells the end of a rest (TASK-385 part B, ADR-0327 point 6, the
 * user's «Sì, così»): with the app open, a light touch 10 s before and a
 * buzz with a short sound at the end; with the app in the background or
 * the phone locked, a local notification with the system's sound at the
 * end, taken back if the rest changes or the app comes back first. The
 * permission is that of the push notifications, asked at the first rest if
 * nobody answered it yet; refused, the alert is only there with the app
 * open. All of it is in the 1.0.1 build: no new module.
 */

/** What rings and buzzes; the tests put their own. */
export type RestFeel = { soon: () => void; over: () => void };

/** The local notification; the tests put their own. */
export type RestNotifier = {
  ask: () => Promise<unknown>;
  /** Schedules the notice in `seconds`; its id, or null when the phone
   * would not. */
  schedule: (
    seconds: number,
    title: string,
    body: string | null,
  ) => Promise<string | null>;
  cancel: (id: string) => Promise<void>;
};

type ExpoHaptics = typeof import("expo-haptics");

function haptics(): ExpoHaptics | null {
  if (!hapticsAvailable()) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-haptics") as ExpoHaptics;
}

export const PHONE_FEEL: RestFeel = {
  soon() {
    const module = haptics();
    module?.impactAsync(module.ImpactFeedbackStyle.Light).catch(() => {});
  },
  over() {
    const module = haptics();
    module?.notificationAsync(module.NotificationFeedbackType.Success).catch(() => {});
    chime();
  },
};

/** What the notification says it is about: nothing to open. */
export const REST_NOTICE_KIND = "gym_rest";

export const PHONE_NOTIFIER: RestNotifier = {
  ask: askPushPermission,
  async schedule(seconds, title, body) {
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          ...(body === null ? {} : { body }),
          sound: true,
          data: { kind: REST_NOTICE_KIND },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(seconds)),
        },
      });
    } catch {
      return null;
    }
  },
  async cancel(id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Gone already.
    }
  },
};

/** Asked once while the app is open: at the first rest. */
let asked = false;

/** For the tests: as an app just opened. */
export function forgetRestQuestion(): void {
  asked = false;
}

/**
 * The alerts of `rest`, while it lasts. `next` is the set after it, for
 * the notification («Next: {exercise} · set {n}»); null says nothing more.
 */
export function useRestAlert(
  rest: Rest | null,
  next: string | null,
  {
    feel = PHONE_FEEL,
    notifier = PHONE_NOTIFIER,
  }: { feel?: RestFeel; notifier?: RestNotifier } = {},
): void {
  const fromMs = rest?.fromMs ?? null;
  const endsMs = rest?.endsMs ?? null;
  const said = useRef(next);
  const tools = useRef({ feel, notifier });
  // The latest of each, for the timers and the notice set before.
  useEffect(() => {
    said.current = next;
    tools.current = { feel, notifier };
  });

  useEffect(() => {
    if (fromMs === null && endsMs === null) {
      return;
    }
    if (!asked) {
      asked = true;
      void tools.current.notifier.ask();
    }
  }, [fromMs, endsMs]);

  useEffect(() => {
    if (endsMs === null) {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const left = endsMs - Date.now();
    if (left > SOON_MS) {
      timers.push(setTimeout(() => tools.current.feel.soon(), left - SOON_MS));
    }
    if (left > 0) {
      timers.push(setTimeout(() => tools.current.feel.over(), left));
    }
    // The notice waits only while the app is away.
    let notice: Promise<string | null> | null = null;
    const takeBack = () => {
      const pending = notice;
      notice = null;
      void pending?.then((id) =>
        id === null ? undefined : tools.current.notifier.cancel(id),
      );
    };
    const onState = (state: AppStateStatus) => {
      if (state === "active") {
        takeBack();
        return;
      }
      const seconds = (endsMs - Date.now()) / 1000;
      if (notice === null && seconds > 0) {
        notice = tools.current.notifier.schedule(
          seconds,
          t("Rest over — next set"),
          said.current,
        );
      }
    };
    const subscription = AppState.addEventListener("change", onState);
    return () => {
      timers.forEach(clearTimeout);
      subscription.remove();
      takeBack();
    };
  }, [endsMs]);
}
