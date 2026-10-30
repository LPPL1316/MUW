import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import type { LatLon } from "@shaperoute/shared-types";

import type { Place } from "./photon";
import { type FindPlaces, placeFinder } from "./placeFinder";

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; places: Place[] }
  | { status: "none" }
  | { status: "failed" };

/** Places known without a search, for a text being typed. */
export type SuggestPlaces = (query: string, near: LatLon | null) => Place[];

type Props = {
  onSelect: (place: Place) => void;
  /** Where the user is, when known: places around it come first. */
  near?: LatLon | null;
  /** Where places come from: the API, else Photon (TASK-123). */
  find?: FindPlaces;
  /** Places the app knows by itself, shown at once and above the ones
   * found: the lakes and beaches of «Paddle» (TASK-240). */
  suggest?: SuggestPlaces;
  /** What the empty field says when not «City or street»: an English
   * text, shown with `t`. */
  placeholder?: string;
};

/** Suggestions start at this many letters, this long after the last one
 * (TASK-085, ADR-0080): Photon asks for fair use, not a request per letter.
 * Photon itself takes 2-3 s, so the pause is kept short (TASK-089). */
export const MIN_SUGGEST_LENGTH = 3;
export const SUGGEST_DELAY_MS = 300;

/**
 * A city or street to start from, when the position is not shared. Places
 * are suggested while typing, once the typing pauses; "Search" and the
 * keyboard's return key search at once.
 */
export function PlaceSearch({
  onSelect,
  near = null,
  find,
  suggest,
  placeholder,
}: Props) {
  // One finder per field: it remembers an API without the key.
  const [ownFind] = useState(() => placeFinder());
  const findPlaces = find ?? ownFind;
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  // Searches are numbered. An answer is shown unless a later one already
  // is: Photon is slow, and places for "via bel" are better than nothing
  // while "via bele" is on its way (TASK-089).
  const asked = useRef(0);
  const shown = useRef(0);
  // The text of that search: the pause after "Search" does not ask it twice.
  const askedText = useRef("");
  // The field shows the place just chosen: nothing is suggested for it.
  const [chosen, setChosen] = useState(false);
  const known = useMemo(
    () =>
      suggest && !chosen && query.trim().length >= MIN_SUGGEST_LENGTH
        ? suggest(query, near)
        : [],
    [suggest, chosen, query, near],
  );
  // A place known and found is shown once, where the known ones are.
  const found =
    search.status === "found"
      ? search.places.filter(
          (place) => !known.some((other) => other.label === place.label),
        )
      : [];
  const places = [...known, ...found];

  const searchFor = useCallback(
    async (text: string) => {
      const mine = ++asked.current;
      askedText.current = text.trim();
      // The places already suggested stay until the new ones come.
      setSearch((now) => (now.status === "found" ? now : { status: "searching" }));
      try {
        const places = await findPlaces(text, near);
        if (mine <= shown.current) {
          return;
        }
        if (places.length) {
          shown.current = mine;
          setSearch({ status: "found", places });
        } else if (mine === asked.current) {
          shown.current = mine;
          setSearch({ status: "none" });
        }
      } catch {
        if (mine === asked.current) {
          shown.current = mine;
          setSearch({ status: "failed" });
        }
      }
    },
    [near, findPlaces],
  );

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_SUGGEST_LENGTH) {
      return;
    }
    const timer = setTimeout(() => {
      if (text !== askedText.current) {
        void searchFor(query);
      }
    }, SUGGEST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, searchFor]);

  /** No answer still on its way is shown. */
  function forget() {
    asked.current += 1;
    shown.current = asked.current;
    setSearch({ status: "idle" });
  }

  function onText(text: string) {
    setQuery(text);
    setChosen(false);
    if (text.trim().length < MIN_SUGGEST_LENGTH) {
      // Too short to suggest: what was found for a longer text goes.
      forget();
      askedText.current = "";
    }
  }

  function choose(place: Place) {
    forget();
    // The field shows what was chosen, and the pause does not search for it.
    askedText.current = place.label;
    setQuery(place.label);
    setChosen(true);
    Keyboard.dismiss();
    onSelect(place);
  }

  function submit() {
    if (query.trim()) {
      void searchFor(query);
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder={placeholder ? t(placeholder) : t("City or street")}
          placeholderTextColor={color.textFaint}
          keyboardAppearance="dark"
          value={query}
          onChangeText={onText}
          onSubmitEditing={submit}
          returnKeyType="search"
          autoCorrect={false}
        />
        <Pressable style={styles.button} onPress={submit} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("Search")}</Text>
        </Pressable>
      </View>
      {places.length > 0 && (
        <View>
          {places.map((place) => (
            <Tap
              key={place.label}
              style={styles.place}
              accessibilityRole="button"
              onPress={() => choose(place)}
            >
              <Text style={styles.placeText}>{place.label}</Text>
            </Tap>
          ))}
          <Text style={styles.credit}>{t("© OpenStreetMap contributors")}</Text>
        </View>
      )}
      {search.status === "searching" && (
        <Text style={styles.note}>{t("Searching…")}</Text>
      )}
      {search.status === "none" && known.length === 0 && (
        <Text style={styles.note}>{t("No place found. Try adding the city.")}</Text>
      )}
      {search.status === "failed" && (
        <Text style={styles.note}>
          {t("The search failed. Check the connection and try again.")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.sm,
  },
  input: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.surface,
  },
  // A secondary control: the yellow belongs to "Draw route" alone.
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
  note: {
    marginTop: space.sm,
    color: color.textMuted,
  },
  place: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  placeText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  credit: {
    marginTop: space.xs,
    fontSize: fontSize.detail,
    color: color.textFaint,
  },
});
