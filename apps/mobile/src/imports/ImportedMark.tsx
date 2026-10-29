import { StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";

/** The word every activity added from another app carries (TASK-312,
 * ADR-0272): on its row and its card in «My activities», over the form of
 * «Save», on its drawing opened. Neutral, as «Public»: the yellow is the
 * route's. */
export function ImportedMark() {
  return (
    <Text style={styles.mark} testID="imported-mark">
      {t("Imported")}
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
});
