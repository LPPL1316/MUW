import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { t } from "../i18n";
import { color, font, fontSize, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { CrossGlyph, LensGlyph } from "./Glyphs";

type Props = {
  value: string;
  onChange: (text: string) => void;
  /** The keyboard's return key. */
  onSubmit: () => void;
  /** Shown while the field is empty. */
  placeholder: string;
  /** The keyboard comes up with the field (the search just opened). */
  autoFocus?: boolean;
  testID?: string;
};

/**
 * The field of a search (TASK-344): the lens, what is typed, and a cross
 * that empties it. The keyboard's key says «Search».
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus = false,
  testID,
}: Props) {
  return (
    <View style={styles.bar}>
      <LensGlyph side={13} tint={color.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityLabel={t("Search")}
        testID={testID}
      />
      {value !== "" && (
        <Pressable
          style={styles.clear}
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel={t("Clear")}
          hitSlop={space.sm}
        >
          <CrossGlyph />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
  },
  input: {
    ...font.body,
    flex: 1,
    fontSize: fontSize.input,
    color: color.text,
    paddingVertical: space.sm,
  },
  clear: {
    padding: space.xs,
  },
});
