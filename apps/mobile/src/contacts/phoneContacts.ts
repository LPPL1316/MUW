import { requireOptionalNativeModule } from "expo";

/**
 * The phone's contacts, as «From your contacts» reads them (TASK-262 C,
 * ADR-0226): only their phone numbers, never a name, an email or a
 * picture. The permission is asked here only, when the person taps.
 *
 * expo-contacts is loaded only when it is used, and only in an app built
 * with it, as AdMob is (`ads/admob.ts`): its native module is asked for at
 * load, so a binary built before it (the store's 1.0) would fail at the
 * first import. There the search from the contacts is simply not shown.
 */

type ExpoContacts = typeof import("expo-contacts");

/** expo-contacts' native module (expo-contacts/src/ExpoContactsNext.ts). */
const NATIVE_MODULE = "ExpoContactsNext";

/** What the phone said: yes, no, or no for good (only its settings change it). */
export type ContactsAccess = "granted" | "denied" | "blocked";

/** Whether this app was built with expo-contacts: Expo Go is, the 1.0 is not. */
export function contactsAvailable(): boolean {
  return requireOptionalNativeModule(NATIVE_MODULE) !== null;
}

/** expo-contacts, loaded at its first use. */
function expoContacts(): ExpoContacts {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-contacts") as ExpoContacts;
}

/**
 * Asks the phone for the contacts: the system question the first time,
 * then the answer given. iOS 18's «limited» counts as yes: the contacts
 * chosen are read.
 */
export async function askForContacts(): Promise<ContactsAccess> {
  const { getPermissionsAsync, requestPermissionsAsync } = expoContacts();
  const now = await getPermissionsAsync();
  if (now.granted) {
    return "granted";
  }
  if (!now.canAskAgain) {
    return "blocked";
  }
  const asked = await requestPermissionsAsync();
  if (asked.granted) {
    return "granted";
  }
  return asked.canAskAgain ? "denied" : "blocked";
}

/** Every phone number of the contacts the app may read, as written there. */
export async function contactNumbers(): Promise<string[]> {
  const { Contact, ContactField } = expoContacts();
  const contacts = await Contact.getAllDetails([ContactField.PHONES]);
  const numbers: string[] = [];
  for (const contact of contacts) {
    for (const phone of contact.phones ?? []) {
      if (typeof phone.number === "string" && phone.number !== "") {
        numbers.push(phone.number);
      }
    }
  }
  return numbers;
}
