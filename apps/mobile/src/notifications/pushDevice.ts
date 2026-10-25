import type { PushPlatform } from "@shaperoute/shared-types";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * The phone's side of push notifications (TASK-262, ADR-0226): its
 * permission, its Expo push token, the notifications touched. Everything
 * else (when to ask, what to send the API) is in `pushRegistration`.
 *
 * Expo Go cannot receive push notifications (since SDK 53): there the
 * token does not come, and `devicePushToken` says null. The proof is a
 * build of the app on the iPhone (`docs/tasks/TASK-262.md`).
 */

/** What the phone allows: «granted» also for iOS's quiet notifications. */
export type PushPermission = "granted" | "denied" | "undetermined";

type Permissions = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

function permissionOf(permissions: Permissions): PushPermission {
  if (permissions.granted) {
    return "granted";
  }
  return permissions.status === "denied" ? "denied" : "undetermined";
}

/** Android 8 and later show nothing without a channel; Android 13 asks
 * for the permission only once there is one. */
async function androidChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MuW",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** The permission as it is, without asking. */
export async function pushPermission(): Promise<PushPermission> {
  try {
    return permissionOf(await Notifications.getPermissionsAsync());
  } catch {
    return "denied";
  }
}

/**
 * Asks the phone, once: the question shows only while nobody answered it.
 * Called when «Push notifications» is turned on, never at the start
 * (TASK-185: the permission when there is something to send).
 */
export async function askPushPermission(): Promise<PushPermission> {
  try {
    await androidChannel();
    const now = await Notifications.getPermissionsAsync();
    if (now.granted || !now.canAskAgain) {
      return permissionOf(now);
    }
    return permissionOf(await Notifications.requestPermissionsAsync());
  } catch {
    return "denied";
  }
}

/** The EAS project of `app.json`, which Expo's push tokens belong to. */
export function easProjectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  const eas =
    typeof extra === "object" && extra !== null && "eas" in extra ? extra.eas : null;
  const id =
    typeof eas === "object" && eas !== null && "projectId" in eas
      ? eas.projectId
      : Constants.easConfig?.projectId;
  return typeof id === "string" && id !== "" ? id : null;
}

/** This phone's Expo push token; null when Expo gives none. */
export async function devicePushToken(
  projectId: string | null = easProjectId(),
): Promise<string | null> {
  if (projectId === null) {
    return null;
  }
  try {
    await androidChannel();
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return typeof data === "string" && data !== "" ? data : null;
  } catch {
    return null;
  }
}

export function pushPlatform(): PushPlatform {
  return Platform.OS === "android" ? "android" : "ios";
}

/** The kinds not shown while the app is open: a shape of the game unlocked
 * (TASK-296) has its card after «Save» already. */
const QUIET_WHILE_OPEN: readonly string[] = ["shape_unlocked"];

/** Whether a notification arriving with the app open is shown. */
export function shownWhileOpen(data: unknown): boolean {
  const kind: unknown =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>).kind
      : undefined;
  return typeof kind !== "string" || !QUIET_WHILE_OPEN.includes(kind);
}

/** A notification that arrives while the app is open shows as a banner,
 * silent, as it would with the app closed; but for the quiet kinds. */
export function showWhileOpen(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const shown = shownWhileOpen(notification.request.content.data);
      return {
        shouldShowBanner: shown,
        shouldShowList: shown,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}

/**
 * Calls `listener` with the data of each notification touched from now on,
 * and of the one that opened the app, if any; each one once. The returned
 * function stops it.
 */
export function onNotificationTapped(listener: (data: unknown) => void): () => void {
  const seen = new Set<string>();
  const touched = (response: Notifications.NotificationResponse | null) => {
    if (response === null) {
      return;
    }
    const { identifier, content } = response.notification.request;
    if (seen.has(identifier)) {
      return;
    }
    seen.add(identifier);
    listener(content.data);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(touched);
  try {
    touched(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
  } catch {
    // No notification opened the app.
  }
  return () => subscription.remove();
}
