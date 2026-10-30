import { reloadAppAsync } from "expo";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t, tLater } from "../i18n";
import {
  BRIGHTNESS_STEPS,
  sameTone,
  saveToneChoice,
  stepOf,
  type Tone,
  type ToneChoice,
  TONES,
  withStep,
} from "../theme/tone";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  paletteOf,
  radius,
  route,
  routeCasingOf,
  space,
  tone as shown,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { Tap } from "../ui/Tap";

// In English; shown with t() in the app's language (TASK-210).
const NAMES: Readonly<Record<Tone, string>> = {
  dark: tLater("Dark"),
  light: tLater("Light"),
};

const STEPS = Array.from({ length: BRIGHTNESS_STEPS }, (_, step) => step);

type Trouble = "not-kept" | "not-reopened" | null;

/**
 * «Tone» in «Settings» (TASK-263, ADR-0231): dark or light, and the
 * brightness of each in five steps, darkest first. A tap on the row opens
 * the choices under it, as «Units» does. The styles of the whole app take
 * their colours as they load, so a choice is tried on a preview drawn in
 * it, and «Apply» keeps it and opens the app again, in the new tone.
 */
export function ToneSetting() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ToneChoice>(shown);
  const [trouble, setTrouble] = useState<Trouble>(null);
  const changed = !sameTone(draft, shown);
  const step = stepOf(draft);

  const toggle = () => {
    // Closed without «Apply», the tone tried is forgotten.
    setDraft(shown);
    setTrouble(null);
    setOpen(!open);
  };
  const choose = (next: ToneChoice) => {
    setDraft(next);
    setTrouble(null);
  };
  const apply = () => {
    if (!saveToneChoice(draft)) {
      setTrouble("not-kept");
      return;
    }
    reloadAppAsync("New tone").catch(() => setTrouble("not-reopened"));
  };

  return (
    <View style={styles.menu}>
      <Tap
        style={styles.row}
        onPress={toggle}
        accessibilityRole="button"
        // One name for the row: the emoji is not read on its own.
        accessibilityLabel={`${t("Tone")}, ${t(NAMES[shown.tone])}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.emoji}>🌗</Text>
        <Text style={styles.rowText}>{t("Tone")}</Text>
        <Text style={styles.value}>{t(NAMES[shown.tone])}</Text>
      </Tap>
      {open && (
        <View>
          <View accessibilityRole="radiogroup">
            {TONES.map((option) => (
              <Choice
                key={option}
                name={t(NAMES[option])}
                chosen={draft.tone === option}
                onPress={() => choose({ ...draft, tone: option })}
              />
            ))}
          </View>
          <Hairline />
          <View style={styles.inside}>
            <Text style={styles.label}>{t("Brightness")}</Text>
            <View style={styles.steps} accessibilityRole="radiogroup">
              <View style={styles.track} />
              {STEPS.map((option) => (
                <Pressable
                  key={option}
                  style={styles.step}
                  onPress={() => choose(withStep(draft, option))}
                  accessibilityRole="radio"
                  accessibilityLabel={t("Brightness {step} of {count}", {
                    step: option + 1,
                    count: BRIGHTNESS_STEPS,
                  })}
                  accessibilityState={{ checked: option === step }}
                  testID={`tone-step-${option}`}
                >
                  <View style={[styles.dot, option === step && styles.dotChosen]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.ends}>
              <Text style={styles.end}>{t("Darker")}</Text>
              <Text style={styles.end}>{t("Brighter")}</Text>
            </View>
            <Preview choice={draft} />
            {changed && (
              <View style={styles.applyBox}>
                <Tap style={styles.apply} onPress={apply} accessibilityRole="button">
                  <Text style={styles.applyText}>{t("Apply")}</Text>
                </Tap>
                <Text style={styles.note}>{t("MuW opens again in the new tone.")}</Text>
              </View>
            )}
            {trouble !== null && (
              <Text style={styles.trouble} accessibilityRole="alert">
                {trouble === "not-kept"
                  ? t("The phone did not keep the tone. Try again.")
                  : t("Close MuW and open it again to see the new tone.")}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * The tone tried, before it is applied: the background, a card with its
 * texts and a control, the yellow command, and a corner of the map with
 * its water, a park, two streets and the route on them. Drawn with the
 * tone's own palette, never with the app's (`color`), which is the tone
 * applied.
 */
function Preview({ choice }: { choice: ToneChoice }) {
  const p = paletteOf(choice);
  const casing = routeCasingOf(choice.tone);
  // The edge is the line's border: inside its box, as wide as on the map.
  const line =
    casing === null
      ? {
          backgroundColor: route.color,
          borderRadius: LINE / 2,
          minWidth: LINE,
          minHeight: LINE,
        }
      : {
          backgroundColor: route.color,
          borderRadius: casing.width / 2,
          minWidth: casing.width,
          minHeight: casing.width,
          borderWidth: (casing.width - LINE) / 2,
          borderColor: casing.color,
        };
  return (
    <View
      testID="tone-preview"
      style={[styles.preview, { backgroundColor: p.background, borderColor: p.border }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("Preview of the tone")}
    >
      <View style={[styles.card, { backgroundColor: p.surface }]}>
        <Text style={[styles.sample, { color: p.text }]}>Aa</Text>
        <View style={[styles.line, { backgroundColor: p.textMuted }]} />
        <View style={[styles.line, styles.short, { backgroundColor: p.textFaint }]} />
        <View
          style={[
            styles.control,
            styles.neutral,
            { backgroundColor: p.surfaceRaised, borderColor: p.borderStrong },
          ]}
        />
        <View style={[styles.control, { backgroundColor: p.accent }]} />
      </View>
      <View style={[styles.map, { backgroundColor: p.map.background }]}>
        <View style={[styles.water, { backgroundColor: p.map.water }]} />
        <View style={[styles.park, { backgroundColor: p.map.green }]} />
        <View style={[styles.street, { backgroundColor: p.map.roadMinor }]} />
        <View style={[styles.avenue, { backgroundColor: p.map.roadMajor }]} />
        <View testID="tone-preview-route" style={[styles.along, line]} />
        <View testID="tone-preview-route" style={[styles.down, line]} />
      </View>
    </View>
  );
}

type ChoiceProps = {
  name: string;
  chosen: boolean;
  onPress: () => void;
};

function Choice({ name, chosen, onPress }: ChoiceProps) {
  return (
    <View>
      <Hairline />
      <Tap
        style={[styles.row, styles.choice]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={name}
        accessibilityState={{ checked: chosen }}
      >
        <Text style={styles.rowText}>{name}</Text>
        {chosen && <Text style={styles.check}>✓</Text>}
      </Tap>
    </View>
  );
}

const DOT = 18;
/** The route on the preview's map: as wide as on the real one. */
const LINE = route.width;

// The rows of «Settings» (`../profile/SettingsPage`), as «Units» has them
// (`./UnitsSetting`), so the row sits among the others as one of them.
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
  inside: {
    paddingTop: space.md,
    paddingBottom: space.lg,
    paddingLeft: space.md + space.xl + space.md,
    paddingRight: space.md,
    gap: space.sm,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // The line the five steps sit on, from the first dot's middle to the last's.
  track: {
    position: "absolute",
    left: MIN_TAP_SIZE / 2,
    right: MIN_TAP_SIZE / 2,
    height: 2,
    backgroundColor: color.border,
  },
  step: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  dotChosen: {
    borderColor: color.text,
    backgroundColor: color.text,
  },
  ends: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -space.xs,
  },
  end: {
    color: color.textFaint,
    fontSize: fontSize.detail,
  },
  preview: {
    flexDirection: "row",
    gap: space.sm,
    height: 112,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  card: {
    flex: 1,
    borderRadius: radius.sm,
    padding: space.sm,
    gap: space.xs,
  },
  sample: {
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  line: {
    height: 4,
    width: "80%",
    borderRadius: 2,
  },
  short: {
    width: "55%",
  },
  control: {
    height: 14,
    marginTop: space.xs,
    borderRadius: radius.pill,
  },
  neutral: {
    borderWidth: 1,
  },
  map: {
    flex: 1,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  water: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "40%",
    height: "45%",
  },
  park: {
    position: "absolute",
    left: space.sm,
    top: space.sm,
    width: "30%",
    height: "30%",
    borderRadius: radius.sm,
  },
  street: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "55%",
    height: 4,
  },
  avenue: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 6,
  },
  // The route: along the street, then down the avenue. Its width and
  // edge come with the tone (`line` in `Preview`).
  along: {
    position: "absolute",
    left: "12%",
    width: "40%",
    top: "53%",
  },
  down: {
    position: "absolute",
    left: "49%",
    top: "15%",
    height: "42%",
  },
  applyBox: {
    gap: space.xs,
    marginTop: space.xs,
  },
  // Neutral, as every control but the one that draws the route.
  apply: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  applyText: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  trouble: {
    color: color.error,
    fontSize: fontSize.small,
  },
});
