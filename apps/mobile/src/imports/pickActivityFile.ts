import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";

import { MAX_FILE_BYTES } from "./importFile";

/**
 * The file of an activity, as the person picks it in «Files» (TASK-312,
 * ADR-0272): its bytes, read on the phone. Nothing is sent: the run made
 * from it goes only with «Save», and the file itself never.
 *
 * expo-document-picker is loaded only when it is used, and only in an app
 * built with it, as expo-contacts is (`contacts/phoneContacts.ts`): its
 * native module is asked for at load, so a binary built before it (the
 * store's 1.0, until the native build 1.0.1) would fail at the first
 * import. There «From a file» is not shown.
 */

type ExpoDocumentPicker = typeof import("expo-document-picker");

/** expo-document-picker's native module (its src/ExpoDocumentPicker.ts). */
const NATIVE_MODULE = "ExpoDocumentPicker";

/** Whether this app was built with expo-document-picker: Expo Go is, the
 * 1.0 is not. */
export function filePickerAvailable(): boolean {
  return requireOptionalNativeModule(NATIVE_MODULE) !== null;
}

/** expo-document-picker, loaded at its first use. */
function documentPicker(): ExpoDocumentPicker {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-document-picker") as ExpoDocumentPicker;
}

/** What came of the picking: the bytes; nothing chosen; a file over the
 * limit, not read; or a file the phone would not read. */
export type Picked =
  | { kind: "picked"; bytes: Uint8Array }
  | { kind: "canceled" }
  | { kind: "too_big" }
  | { kind: "unreadable" };

/** A function that picks a file, the phone's or a test's. */
export type PickFile = () => Promise<Picked>;

/**
 * Opens «Files» for one file of any kind: GPX, TCX and FIT have no type
 * every phone knows, and the content says which it is. The copy the picker
 * makes in the app's cache is deleted once read.
 */
export const pickActivityFile: PickFile = async () => {
  try {
    const result = await documentPicker().getDocumentAsync({
      type: "*/*",
      multiple: false,
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) {
      return { kind: "canceled" };
    }
    const file = new File(asset.uri);
    try {
      if ((asset.size ?? file.size) > MAX_FILE_BYTES) {
        return { kind: "too_big" };
      }
      return { kind: "picked", bytes: await file.bytes() };
    } finally {
      try {
        file.delete();
      } catch {
        // The cache is the system's to empty too.
      }
    }
  } catch {
    return { kind: "unreadable" };
  }
};
