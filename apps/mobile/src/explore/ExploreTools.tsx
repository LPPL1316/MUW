import type { CityChosenSignal, Signal } from "@shaperoute/shared-types/src/signals";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { t } from "../i18n";

import { sendSignal } from "../api/signals";
import { featuredPlace, keepFeaturedPlace } from "../engine/aheadZones";
import type { Place } from "../places/photon";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { searchCities, suggestCities } from "./cities";
import { cityShort, FEATURED_CITIES, isSpot, suggestionDetail } from "./presets";

/** A pause in typing before the suggestions are asked (as TASK-089). */
export const SUGGEST_DELAY_MS = 250;
/** The position mark of "Near me": as tall as a capital letter. */
const MARK_SIZE = 12;

type CityProps = {
  apiUrl: string | null;
  city: Place | null;
  onCity: (city: Place | null) => void;
  /** The cities chosen last, first among the chips (TASK-134). */
  recent?: Place[];
  /** Injected in tests. */
  fetchFn?: typeof fetch;
  suggestDelayMs?: number;
  /** Tells the API the city chosen, and how (TASK-142); POST /signals. */
  onSignal?: (signal: Signal) => void;
  /** The featured cities the phone has as GET /cities gave them
   * (TASK-287): read before asking, kept after. Injected in tests. */
  featured?: {
    read: (name: string) => Place | null;
    keep: (name: string, place: Place) => void;
  };
};

const FEATURED_ON_PHONE = { read: featuredPlace, keep: keepFeaturedPlace };

/**
 * "City" (TASK-129, TASK-134): "Near me" first, on until a city is chosen
 * and the way back from one (TASK-176); then cities to tap, the recent
 * first, then cities from around the world; or "Type a city or a place",
 * with cities and places suggested while typing (TASK-138). The list below
 * and the requests then start from the city's centre, or from the place.
 */
export function CityPicker({
  apiUrl,
  city,
  onCity,
  recent = [],
  fetchFn = fetch,
  suggestDelayMs = SUGGEST_DELAY_MS,
  onSignal = (signal) => void sendSignal(signal, { baseUrl: apiUrl, fetchFn }),
  featured: featuredOnPhone = FEATURED_ON_PHONE,
}: CityProps) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; places: Place[] | null } | null>(
    null,
  );
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The cities asked by name are numbered (TASK-254): only the answer to
  // the last one counts. A choice, «Near me» and the unmount end them all.
  const asked = useRef(0);
  useEffect(
    () => () => {
      asked.current += 1;
    },
    [],
  );

  // Suggestions while typing, after a short pause; the last query wins.
  useEffect(() => {
    const text = query.trim();
    if (apiUrl === null || text.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void suggestCities(apiUrl, text, { fetchFn, signal: controller.signal }).then(
        (places) => {
          if (!controller.signal.aborted) {
            setFound({ query: text, places });
          }
        },
      );
    }, suggestDelayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiUrl, query, fetchFn, suggestDelayMs]);

  /** A city or a place chosen, and how: a suggestion picked never calls
   * /cities, so the API hears of it only from the signal (TASK-142). */
  function choose(place: Place, via: CityChosenSignal["via"]) {
    asked.current += 1;
    setOpening(null);
    Keyboard.dismiss();
    setQuery("");
    setFound(null);
    setFailed(false);
    onCity(place);
    onSignal({
      kind: "city_chosen",
      label: place.label,
      point: place.point,
      ...(isSpot(place) ? { place: true } : {}),
      via,
    });
  }

  /** Back to the routes near the start: no city, nothing typed. */
  function nearMe() {
    asked.current += 1;
    setOpening(null);
    Keyboard.dismiss();
    setQuery("");
    setFound(null);
    setFailed(false);
    onCity(null);
  }

  /** A city by name (a chip, or Enter): its centre from the API. A featured
   * city the phone has already opens at once, without asking (TASK-287). */
  async function open(name: string, via: "featured" | "typed") {
    const kept = via === "featured" ? featuredOnPhone.read(name) : null;
    if (kept !== null) {
      choose(kept, via);
      return;
    }
    if (apiUrl === null) {
      setFailed(true);
      return;
    }
    const mine = ++asked.current;
    setOpening(name);
    setFailed(false);
    const cities = await searchCities(apiUrl, name, { fetchFn });
    if (mine !== asked.current) {
      // Another city was asked, or chosen, in the meantime: it wins.
      return;
    }
    setOpening(null);
    if (cities !== null && cities.length > 0) {
      if (via === "featured") {
        featuredOnPhone.keep(name, cities[0]);
      }
      choose(cities[0], via);
    } else {
      setFailed(true);
    }
  }

  const typed = query.trim();
  const suggestions = typed.length >= 2 && found?.query === typed ? found.places : null;

  /** Enter takes the first suggestion, as a tap on it; else the city by name. */
  function submit() {
    if (suggestions !== null && suggestions.length > 0) {
      choose(suggestions[0], "suggestion");
    } else if (typed !== "") {
      void open(typed, "typed");
    }
  }
  const recentNames = new Set(recent.map((p) => cityShort(p.label)));
  const featured = FEATURED_CITIES.filter((name) => !recentNames.has(name));

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("CITY")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          <Chip label={t("Near me")} on={city === null} here onPress={nearMe} />
          {recent.map((place) => (
            <Chip
              key={`recent-${place.label}`}
              label={cityShort(place.label)}
              on={city?.label === place.label}
              recent
              onPress={() => choose(place, "recent")}
            />
          ))}
          {featured.map((name) => (
            <Chip
              key={name}
              label={opening === name ? `${name} …` : name}
              on={city !== null && cityShort(city.label) === name}
              onPress={() => void open(name, "featured")}
            />
          ))}
        </View>
      </ScrollView>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setFailed(false);
        }}
        placeholder={t("Type a city or a place")}
        placeholderTextColor={color.textFaint}
        returnKeyType="search"
        onSubmitEditing={submit}
        keyboardAppearance="dark"
        autoCorrect={false}
        accessibilityLabel={t("Type a city or a place")}
      />
      {suggestions?.map((place) => (
        <Pressable
          key={place.label}
          style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
          onPress={() => choose(place, "suggestion")}
          accessibilityRole="button"
          accessibilityLabel={place.label}
        >
          <Text style={styles.choiceText} numberOfLines={1}>
            {cityShort(place.label)}
          </Text>
          <Text style={styles.choiceDetail} numberOfLines={1}>
            {suggestionDetail(place)}
          </Text>
        </Pressable>
      ))}
      {suggestions !== null && suggestions.length === 0 && (
        <Text style={styles.note}>
          {t("No city or place matches “{typed}”.", { typed })}
        </Text>
      )}
      {(failed || (suggestions === null && found?.query === typed && typed !== "")) && (
        <Text style={styles.error}>{t("The search did not answer. Try again.")}</Text>
      )}
    </View>
  );
}

function Chip({
  label,
  on,
  recent = false,
  here = false,
  onPress,
}: {
  label: string;
  on: boolean;
  recent?: boolean;
  /** The start, not a city: a position mark before the name. */
  here?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityHint={
        recent
          ? t("A city you chose before")
          : here
            ? t("The routes near your start")
            : undefined
      }
    >
      {here && (
        <View style={[styles.mark, on && styles.markOn]} testID="near-me-mark">
          <View style={[styles.markDot, on && styles.markDotOn]} />
        </View>
      )}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>
        {recent ? `↺ ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  chips: {
    flexDirection: "row",
    gap: space.sm,
  },
  chip: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  chipOn: {
    backgroundColor: color.text,
    borderColor: color.text,
  },
  chipText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  chipTextOn: {
    color: color.background,
    fontWeight: fontWeight.semibold,
  },
  // "You are here", drawn: a ring and its centre, in the text's colour.
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2,
    borderColor: color.text,
    alignItems: "center",
    justifyContent: "center",
  },
  markOn: {
    borderColor: color.background,
  },
  markDot: {
    width: MARK_SIZE / 3,
    height: MARK_SIZE / 3,
    borderRadius: MARK_SIZE / 6,
    backgroundColor: color.text,
  },
  markDotOn: {
    backgroundColor: color.background,
  },
  // A light touch: what is pressed dims, nothing moves.
  pressed: {
    opacity: 0.6,
  },
  input: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    color: color.text,
    fontSize: fontSize.input,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  error: {
    color: color.error,
    fontSize: fontSize.small,
  },
  choice: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
  },
  choiceText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  choiceDetail: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
});
