import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { drawingName } from "../social/DrawingsGrid";
import { t } from "../i18n";
import { color, font, MIN_TAP_SIZE, space } from "../theme/tokens";
import { CATEGORIES, type CategoryKey } from "./categories";
import { DrawingResultCard } from "./DrawingResultCard";
import { FilterChip } from "./FilterChip";
import { CrossGlyph } from "./Glyphs";
import type { Result } from "./ResultsGrid";

/** The width of a featured drawing, in the row that slides. */
const FEATURED_WIDTH = 150;

type Props = {
  recent: readonly string[];
  onRecent: (search: string) => void;
  onRemoveRecent: (search: string) => void;
  onCategory: (key: CategoryKey) => void;
  /** The drawings most liked, members' first, then the examples. */
  featured: readonly Result[];
  onPick: (result: Result) => void;
};

/**
 * The search before anything is typed (TASK-344): the last searches,
 * each with its cross; the categories as chips; the featured drawings in a
 * row that slides sideways.
 */
export function StartState({
  recent,
  onRecent,
  onRemoveRecent,
  onCategory,
  featured,
  onPick,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.start}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      testID="search-start"
    >
      {recent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {t("Recent searches")}
          </Text>
          {recent.map((search) => (
            <View key={search} style={styles.recent}>
              <Pressable
                style={styles.recentWords}
                onPress={() => onRecent(search)}
                accessibilityRole="button"
              >
                <Text style={styles.recentText} numberOfLines={1}>
                  {search}
                </Text>
              </Pressable>
              <Pressable
                style={styles.remove}
                onPress={() => onRemoveRecent(search)}
                accessibilityRole="button"
                accessibilityLabel={t("Remove {name}", { name: search })}
              >
                <CrossGlyph />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t("Categories")}
        </Text>
        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <FilterChip
              key={category.key}
              label={t(category.label)}
              selected={false}
              onPress={() => onCategory(category.key)}
              testID={`category-${category.key}`}
            />
          ))}
        </View>
      </View>
      {featured.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {t("Featured drawings")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featured}
            testID="search-featured"
          >
            {featured.map((result) => (
              <DrawingResultCard
                key={`${result.kind}-${result.post.id}`}
                title={
                  result.kind === "member"
                    ? drawingName(result.post)
                    : result.post.title
                }
                author={
                  result.kind === "member"
                    ? result.post.author.username
                    : result.post.user
                }
                distanceM={
                  result.kind === "member"
                    ? result.post.distance_m
                    : result.post.route_m
                }
                line={
                  result.kind === "member"
                    ? result.post.track_preview
                    : result.post.line
                }
                rotationDeg={result.post.rotation_deg}
                width={FEATURED_WIDTH}
                onPress={() => onPick(result)}
                testID={`featured-${result.post.id}`}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  start: {
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
  heading: {
    ...font.label,
    color: color.textMuted,
    paddingHorizontal: space.lg,
  },
  recent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
  },
  recentWords: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  recentText: {
    ...font.body,
    color: color.text,
  },
  remove: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  featured: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
});
