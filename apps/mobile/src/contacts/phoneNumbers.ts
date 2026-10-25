import { I18nManager, Platform, Settings } from "react-native";

/**
 * A number of the phone's contacts written as the API keeps `users.phone`
 * (TASK-183): E.164, "+", the country code and the number (TASK-262 C,
 * ADR-0226). A number written without its country code takes the one of
 * the phone's region. Written here, without libphonenumber: the user said
 * yes to one new dependency only, expo-contacts.
 */

/** The API's rule for a kept number (contact.py, PHONE_PATTERN). */
const E164 = /^\+[1-9][0-9]{7,14}$/;

type Country = {
  /** The country code, without "+". */
  code: string;
  /**
   * The prefixes dialled inside the country and left out from abroad:
   * "0" in most of Europe, "1" in North America; none where the first 0
   * is part of the number (Italy) or there is no such prefix (Spain).
   */
  trunk: readonly string[];
  /** The prefix for calling abroad, when it is not "00". */
  abroad?: string;
};

const ZERO = ["0"];
const NONE: readonly string[] = [];

/**
 * The regions a number without its country code is read for, by their
 * ISO 3166 code. A region not here: only the numbers written with "+" or
 * "00" are read.
 */
export const COUNTRIES: Readonly<Record<string, Country>> = {
  // Europe
  IT: { code: "39", trunk: NONE },
  SM: { code: "378", trunk: NONE },
  VA: { code: "39", trunk: NONE },
  CH: { code: "41", trunk: ZERO },
  LI: { code: "423", trunk: NONE },
  AT: { code: "43", trunk: ZERO },
  DE: { code: "49", trunk: ZERO },
  FR: { code: "33", trunk: ZERO },
  MC: { code: "377", trunk: NONE },
  ES: { code: "34", trunk: NONE },
  AD: { code: "376", trunk: NONE },
  PT: { code: "351", trunk: NONE },
  GB: { code: "44", trunk: ZERO },
  IE: { code: "353", trunk: ZERO },
  NL: { code: "31", trunk: ZERO },
  BE: { code: "32", trunk: ZERO },
  LU: { code: "352", trunk: NONE },
  DK: { code: "45", trunk: NONE },
  NO: { code: "47", trunk: NONE },
  SE: { code: "46", trunk: ZERO },
  FI: { code: "358", trunk: ZERO },
  IS: { code: "354", trunk: NONE },
  PL: { code: "48", trunk: NONE },
  CZ: { code: "420", trunk: NONE },
  SK: { code: "421", trunk: ZERO },
  SI: { code: "386", trunk: ZERO },
  HR: { code: "385", trunk: ZERO },
  HU: { code: "36", trunk: ["06"] },
  RO: { code: "40", trunk: ZERO },
  BG: { code: "359", trunk: ZERO },
  GR: { code: "30", trunk: NONE },
  CY: { code: "357", trunk: NONE },
  MT: { code: "356", trunk: NONE },
  EE: { code: "372", trunk: NONE },
  LV: { code: "371", trunk: NONE },
  LT: { code: "370", trunk: ["0", "8"] },
  RS: { code: "381", trunk: ZERO },
  BA: { code: "387", trunk: ZERO },
  ME: { code: "382", trunk: ZERO },
  MK: { code: "389", trunk: ZERO },
  AL: { code: "355", trunk: ZERO },
  UA: { code: "380", trunk: ZERO },
  RU: { code: "7", trunk: ["8"], abroad: "810" },
  TR: { code: "90", trunk: ZERO },
  IL: { code: "972", trunk: ZERO },
  // The Americas
  US: { code: "1", trunk: ["1"], abroad: "011" },
  CA: { code: "1", trunk: ["1"], abroad: "011" },
  MX: { code: "52", trunk: NONE },
  BR: { code: "55", trunk: ZERO },
  AR: { code: "54", trunk: ZERO },
  CL: { code: "56", trunk: NONE },
  CO: { code: "57", trunk: NONE },
  // The rest of the world
  AU: { code: "61", trunk: ZERO, abroad: "0011" },
  NZ: { code: "64", trunk: ZERO },
  JP: { code: "81", trunk: ZERO, abroad: "010" },
  KR: { code: "82", trunk: ZERO },
  CN: { code: "86", trunk: ZERO },
  IN: { code: "91", trunk: ZERO },
  SG: { code: "65", trunk: NONE },
  HK: { code: "852", trunk: NONE },
  AE: { code: "971", trunk: ZERO },
  ZA: { code: "27", trunk: ZERO },
  EG: { code: "20", trunk: ZERO },
  MA: { code: "212", trunk: ZERO },
};

/**
 * What ends the number in a contact: a pause, an extension, a letter.
 * The digits after it are not part of the number.
 */
const NUMBER_END = /[,;#*a-zA-Z]/;

/**
 * The number written in a contact, as the API keeps one; null when it
 * cannot be read as a number: too short, too long, a code of a service,
 * or written without its country code in a region not in COUNTRIES.
 * Spaces, dashes, dots, brackets and every other sign between the digits
 * are let go, as the API does with a number it keeps.
 */
export function toE164(written: string, region: string | null): string | null {
  const cut = (written.split(NUMBER_END)[0] ?? "").replace(/[^0-9+]/g, "");
  // Marks of writing direction and other signs may stand before the "+".
  const plus = cut.startsWith("+");
  const digits = cut.replace(/\+/g, "");
  const country = region === null ? undefined : COUNTRIES[region];
  let number: string | null = null;
  if (plus) {
    number = digits;
  } else if (country?.abroad !== undefined && digits.startsWith(country.abroad)) {
    number = digits.slice(country.abroad.length);
  } else if (digits.startsWith("00")) {
    number = digits.slice(2);
  } else if (country !== undefined) {
    const trunk = country.trunk.find((prefix) => digits.startsWith(prefix));
    number = country.code + (trunk === undefined ? digits : digits.slice(trunk.length));
  }
  if (number === null) {
    return null;
  }
  const e164 = `+${number}`;
  return E164.test(e164) ? e164 : null;
}

/**
 * The phone's region from its locale ("it_IT", "en-US"), as an ISO 3166
 * code; null when the locale has none.
 */
export function regionOfLocale(locale: string): string | null {
  // The last part of two capital letters: "zh_Hans_CN" is CN.
  const parts = locale.split(/[-_@.]/);
  for (let i = parts.length - 1; i > 0; i--) {
    const part = parts[i] ?? "";
    if (/^[A-Z]{2}$/.test(part)) {
      return part;
    }
  }
  return null;
}

/**
 * The phone's region: on iOS from «Region» in the phone's settings,
 * elsewhere from its locale. Null when the phone does not say (in tests).
 */
export function phoneRegion(): string | null {
  const locales: string[] = [];
  if (Platform.OS === "ios") {
    try {
      const locale: unknown = Settings.get("AppleLocale");
      if (typeof locale === "string") {
        locales.push(locale);
      }
    } catch {
      // No settings to read: the locale below, if any.
    }
  }
  try {
    const locale: unknown = I18nManager.getConstants().localeIdentifier;
    if (typeof locale === "string") {
      locales.push(locale);
    }
  } catch {
    // Nothing more to read.
  }
  for (const locale of locales) {
    const region = regionOfLocale(locale);
    if (region !== null) {
      return region;
    }
  }
  return null;
}
