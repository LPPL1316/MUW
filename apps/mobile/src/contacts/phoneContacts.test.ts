import { contactsAvailable } from "./phoneContacts";

let mockNativeThere = true;

jest.mock("expo", () => ({
  requireOptionalNativeModule: (name: string) =>
    name === "ExpoContactsNext" && mockNativeThere ? {} : null,
}));

// Loading expo-contacts in a binary without its native module throws: the
// module must not be loaded until a look in the contacts.
jest.mock("expo-contacts", () => {
  throw new Error("expo-contacts loaded");
});

test("the contacts are offered only in an app built with expo-contacts", () => {
  mockNativeThere = true;
  expect(contactsAvailable()).toBe(true);
  mockNativeThere = false;
  expect(contactsAvailable()).toBe(false);
});

test("expo-contacts is not loaded with the module, only at a look", () => {
  // Importing phoneContacts above did not throw: expo-contacts stayed unloaded.
  expect(contactsAvailable).toBeDefined();
});
