import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { t } from "../i18n";

import type { Place } from "../places/photon";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { CATEGORIES, exampleFor, requestFor, whereFor } from "./presets";

/** The longest request the API reads (themed.py). */
export const MAX_REQUEST_LENGTH = 200;
/** The categories always shown: Famous Places, Best Views, Hidden Gems and
 * Photography (the user's choice of 2026-10-29). */
export const QUICK_CATEGORIES = 4;

type Props = {
  /** The city the requests are for, or null for the start. */
  city?: Place | null;
  /** Where the request starts from, in words: the city or "your start". */
  where: string;
  onAsk: (text: string) => void;
  /** Our ideas, above the categories: what to take a route from. */
  ideas?: ReactNode;
};

/**
 * "Ask for a route" (TASK-129, TASK-134, TASK-143): our ideas first, then
 * four categories, one tap each ("Famous Places in Rome"), the others behind
 * "More…"; or a request in words.
 */
export function AskForRoute({ city = null, where, onAsk, ideas }: Props) {
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const ready = text.trim() !== "";
  const place = whereFor(city);
  const shown = all ? CATEGORIES : CATEGORIES.slice(0, QUICK_CATEGORIES);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("ASK FOR A ROUTE")}</Text>
      {ideas}
      <Text style={styles.note}>
        {t("A shape through real places {place}. Tap one to make it.", { place })}
      </Text>
      <View style={styles.grid}>
        {shown.map((category) => (
          <Pressable
            key={category}
            style={({ pressed }) => [styles.category, pressed && styles.pressed]}
            onPress={() => onAsk(requestFor(category, city))}
            accessibilityRole="button"
            accessibilityLabel={requestFor(category, city)}
          >
            <Text style={styles.categoryText}>{t(category)}</Text>
            <Text style={styles.categoryWhere} numberOfLines={1}>
              {place}
            </Text>
          </Pressable>
        ))}
        {!all && (
          <Pressable
            style={({ pressed }) => [styles.category, pressed && styles.pressed]}
            onPress={() => setAll(true)}
            accessibilityRole="button"
            accessibilityLabel={t("More categories")}
          >
            <Text style={styles.categoryText}>{t("More…")}</Text>
            <Text style={styles.categoryWhere} numberOfLines={1}>
              {t("{count} more", { count: CATEGORIES.length - QUICK_CATEGORIES })}
            </Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.label}>{t("OR IN YOUR WORDS")}</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        maxLength={MAX_REQUEST_LENGTH}
        placeholder={exampleFor(city)}
        placeholderTextColor={color.textFaint}
        returnKeyType="go"
        onSubmitEditing={() => ready && onAsk(text.trim())}
        keyboardAppearance="dark"
      />
      <Text style={styles.note}>
        {t("From {where}. Name a city in the words to go elsewhere.", { where })}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.make,
          !ready && styles.makeOff,
          pressed && styles.pressed,
        ]}
        onPress={() => onAsk(text.trim())}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
      >
        <Text style={styles.makeText}>{t("Make my route")}</Text>
      </Pressable>
    </View>
  );
}

// As in ExploreTools.tsx, where "Ask for a route" was until TASK-143.
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
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  // A light touch: what is pressed dims, nothing moves.
  pressed: {
    opacity: 0.6,
  },
  // Two columns on a phone, more where there is room.
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  category: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  categoryText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  categoryWhere: {
    color: color.textMuted,
    fontSize: fontSize.detail,
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
  // Yellow: it produces a route, like "Draw route" (UI.md, Il tema).
  make: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.accent,
  },
  makeOff: {
    opacity: 0.4,
  },
  makeText: {
    color: color.onAccent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
});
