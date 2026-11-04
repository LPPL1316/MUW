import { DRAWING_COMPLEXITIES, DRAWING_SORTS } from "@shaperoute/shared-types";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../i18n";
import { Tap } from "../ui/Tap";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { wholeDistanceLabel } from "../units/format";
import { FilterChip } from "./FilterChip";
import {
  ACTIVITY_LABELS,
  activeCount,
  COMPLEXITY_LABELS,
  DISTANCE_BANDS,
  type DistanceBand,
  NO_FILTERS,
  SEARCH_ACTIVITIES,
  type SearchFilters,
  SORT_LABELS,
  toggled,
} from "./searchFilters";

type Props = {
  visible: boolean;
  /** The filters applied now: the sheet starts from them. */
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
};

/** "Up to 10 km", "10–30 km", "Over 50 km", in the app's units. */
export function bandLabel(band: DistanceBand): string {
  if (band.min === 0 && band.max !== null) {
    return t("Up to {distance}", { distance: wholeDistanceLabel(band.max) });
  }
  if (band.max === null) {
    return t("Over {distance}", { distance: wholeDistanceLabel(band.min) });
  }
  const to = wholeDistanceLabel(band.max);
  const from = wholeDistanceLabel(band.min).replace(/\s.*$/, "");
  return `${from}–${to}`;
}

/**
 * The filters of the search in a sheet from the bottom (TASK-344):
 * distance, sport, place, how complex, the order. What is touched here
 * waits for «Apply»; «Reset» takes every filter off. The category stays
 * the chips' own.
 */
export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Mounted with the sheet: each opening starts from what is applied. */}
      <SheetBody filters={filters} onApply={onApply} onClose={onClose} />
    </Modal>
  );
}

function SheetBody({ filters, onApply, onClose }: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);
  const change = (part: Partial<SearchFilters>) =>
    setDraft((was) => ({ ...was, ...part }));
  const count = activeCount(draft);
  return (
    <View style={styles.layer}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("Close")}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grip} />
        <Text style={styles.title} accessibilityRole="header">
          {t("Filters")}
        </Text>
        <ScrollView
          contentContainerStyle={styles.sections}
          keyboardShouldPersistTaps="handled"
        >
          <Section title={t("Distance")}>
            {DISTANCE_BANDS.map((band) => (
              <FilterChip
                key={band.key}
                label={bandLabel(band)}
                selected={draft.distance === band.key}
                onPress={() =>
                  change({ distance: draft.distance === band.key ? null : band.key })
                }
                testID={`filter-distance-${band.key}`}
              />
            ))}
          </Section>
          <Section title={t("Sport")}>
            {SEARCH_ACTIVITIES.map((activity) => (
              <FilterChip
                key={activity}
                label={t(ACTIVITY_LABELS[activity])}
                selected={draft.activities.includes(activity)}
                onPress={() =>
                  change({ activities: toggled(draft.activities, activity) })
                }
                testID={`filter-activity-${activity}`}
              />
            ))}
          </Section>
          <Section title={t("Place")}>
            <TextInput
              style={styles.place}
              value={draft.place}
              onChangeText={(place) => change({ place })}
              placeholder={t("Town or region")}
              placeholderTextColor={color.textFaint}
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel={t("Place")}
              testID="filter-place"
            />
          </Section>
          <Section title={t("Complexity")}>
            {DRAWING_COMPLEXITIES.map((complexity) => (
              <FilterChip
                key={complexity}
                label={t(COMPLEXITY_LABELS[complexity])}
                selected={draft.complexities.includes(complexity)}
                onPress={() =>
                  change({ complexities: toggled(draft.complexities, complexity) })
                }
                testID={`filter-complexity-${complexity}`}
              />
            ))}
          </Section>
          <Section title={t("Sort by")}>
            {DRAWING_SORTS.map((sort) => (
              <FilterChip
                key={sort}
                label={t(SORT_LABELS[sort])}
                selected={draft.sort === sort}
                onPress={() => change({ sort })}
                testID={`filter-sort-${sort}`}
              />
            ))}
          </Section>
        </ScrollView>
        <View style={styles.buttons}>
          <Tap
            style={[styles.button, styles.reset]}
            onPress={() => setDraft({ ...NO_FILTERS, category: draft.category })}
            accessibilityRole="button"
            testID="filter-reset"
          >
            <Text style={styles.resetText}>{t("Reset")}</Text>
          </Tap>
          <Tap
            style={[styles.button, styles.apply]}
            onPress={() => onApply(draft)}
            accessibilityRole="button"
            testID="filter-apply"
          >
            <Text style={styles.applyText}>
              {count > 0 ? `${t("Apply")} (${count})` : t("Apply")}
            </Text>
          </Tap>
        </View>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.scrim,
    opacity: 0.5,
  },
  sheet: {
    maxHeight: "88%",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  grip: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.borderStrong,
  },
  title: {
    ...font.heading,
    color: color.text,
  },
  sections: {
    gap: space.lg,
    paddingBottom: space.sm,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...font.label,
    color: color.textMuted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  place: {
    ...font.body,
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    fontSize: fontSize.input,
    color: color.text,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttons: {
    flexDirection: "row",
    gap: space.md,
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  reset: {
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  apply: {
    backgroundColor: color.accent,
  },
  resetText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  applyText: {
    color: color.onAccent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
