import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  type LanguageChoice,
  loadLanguageChoice,
  saveLanguageChoice,
} from "../i18n/language";
import { LANGUAGES, languageOption } from "../i18n/languages";
import { phoneLanguage } from "../i18n/phoneLanguage";
import { useLanguage } from "../i18n/useLanguage";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { Tap } from "../ui/Tap";

/**
 * «Language» in «Settings» (TASK-210, ADR-0172): the language the app is
 * shown in, at the end of the row. A tap opens the choices under it, as
 * «Profile picture» does: the phone's language first, which is what the
 * app follows until one is chosen, then the five, each in its own name.
 * The choice stays on the phone and the app turns to it at once.
 */
export function LanguageSetting() {
  const language = useLanguage();
  const [choice, setChoice] = useState<LanguageChoice>(loadLanguageChoice);
  const [open, setOpen] = useState(false);
  const shown = languageOption(language).name;
  const choose = (next: LanguageChoice) => {
    setChoice(next);
    setOpen(false);
    saveLanguageChoice(next);
  };
  return (
    <View style={styles.menu}>
      <Tap
        style={styles.row}
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={`${t("Language")}, ${shown}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.emoji}>🌐</Text>
        <Text style={styles.rowText}>{t("Language")}</Text>
        <Text style={styles.value}>{shown}</Text>
      </Tap>
      {open && (
        <View accessibilityRole="radiogroup">
          <Choice
            name={t("Phone language")}
            detail={languageOption(phoneLanguage()).name}
            chosen={choice === "phone"}
            onPress={() => choose("phone")}
          />
          {LANGUAGES.map((option) => (
            <Choice
              key={option.id}
              name={option.name}
              speech={option.speech}
              chosen={choice === option.id}
              onPress={() => choose(option.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type ChoiceProps = {
  name: string;
  /** Said after the name, quieter: the language the phone is in. */
  detail?: string;
  /** The name's own language, so VoiceOver says «Deutsch» as Germans do. */
  speech?: string;
  chosen: boolean;
  onPress: () => void;
};

function Choice({ name, detail, speech, chosen, onPress }: ChoiceProps) {
  return (
    <View>
      <Hairline />
      <Tap
        style={[styles.row, styles.choice]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={detail === undefined ? name : `${name}, ${detail}`}
        accessibilityLanguage={speech}
        accessibilityState={{ checked: chosen }}
      >
        <Text style={styles.rowText}>{name}</Text>
        {detail !== undefined && <Text style={styles.value}>{detail}</Text>}
        {chosen && <Text style={styles.check}>✓</Text>}
      </Tap>
    </View>
  );
}

// The rows of «Settings» (`../profile/SettingsPage`), so the row sits among
// the others as one of them.
const styles = StyleSheet.create({
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  // The choices start where the row's name does, under it.
  choice: {
    paddingLeft: space.md + space.xl + space.md,
  },
  emoji: {
    fontSize: fontSize.input + space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  value: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  // Not yellow: the yellow belongs to the route (docs/UI.md, «Il tema»).
  check: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
});
