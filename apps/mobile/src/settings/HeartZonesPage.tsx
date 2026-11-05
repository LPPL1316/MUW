import { useRef, useState, useSyncExternalStore } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { readNumber } from "../body/bodyUnits";
import {
  appHeart,
  calculatedAgain,
  hasHandLimits,
  type HeartSettings,
  MAX_BPM,
  maxHeartRate,
  REST_BPM,
  saveHeart,
  subscribeHeart,
  withLimit,
  type Zone,
  zonesOf,
} from "../body/heartZones";
import { useBody } from "../body/useBody";
import { t, tLater } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";

// In English; shown with t() in the app's language (TASK-210).
const ZONE_NAMES: readonly string[] = [
  tLater("Zone 1 Recovery"),
  tLater("Zone 2 Endurance"),
  tLater("Zone 3 Tempo"),
  tLater("Zone 4 Threshold"),
  tLater("Zone 5 Max"),
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * «Heart rate zones» (TASK-374 part B, ADR-0318 §6), opened from the bottom
 * of «Body»: the max heart rate, from the age or typed by hand, the resting
 * heart rate, and the five zones. The top of zones 1 to 4 can be typed; it
 * stays until «Back to calculated zones», and the next zone starts there.
 * All of it is kept on this phone as soon as it is typed.
 */
export function HeartZonesPage({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Its own edges, as «Body» has them (TASK-366). */}
      {visible && (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Page onClose={onClose} />
        </SafeAreaProvider>
      )}
    </Modal>
  );
}

function useHeart(): HeartSettings {
  return useSyncExternalStore(subscribeHeart, appHeart);
}

/** Keeps `change` on top of the settings as they are now. */
function keep(change: Partial<HeartSettings>) {
  saveHeart({ ...appHeart(), ...change });
}

type Typed = { kind: "empty" } | { kind: "value"; value: number } | { kind: "wrong" };

/** A heart rate typed in a field, in beats a minute. */
function readBpm(text: string, range: { min: number; max: number }): Typed {
  if (text.trim() === "") {
    return { kind: "empty" };
  }
  const typed = readNumber(text);
  if (typed === null || typed < range.min || typed > range.max) {
    return { kind: "wrong" };
  }
  return { kind: "value", value: Math.round(typed) };
}

function Page({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const body = useBody();
  const heart = useHeart();
  const max = maxHeartRate(heart, body, new Date().getFullYear());
  const zones = max === null ? null : zonesOf(max.bpm, heart);
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Tap style={styles.back} onPress={onClose} accessibilityRole="button">
          <Text style={styles.backText}>{t("Back")}</Text>
        </Tap>
        <Text style={styles.title} accessibilityRole="header">
          {t("Heart rate zones")}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <BpmField
          label={t("Max heart rate")}
          shown={max?.bpm ?? null}
          range={MAX_BPM}
          byHand={heart.maxBpm !== null}
          caption={
            max === null
              ? null
              : max.from === "hand"
                ? t("Set by you")
                : t("Estimated from your age")
          }
          onKeep={(maxBpm) => keep({ maxBpm })}
        />
        <BpmField
          label={t("Resting heart rate")}
          shown={heart.restBpm}
          range={REST_BPM}
          byHand={heart.restBpm !== null}
          caption={null}
          onKeep={(restBpm) => keep({ restBpm })}
        />
        {zones === null ? (
          <Text style={styles.intro}>
            {t("Add your year of birth or your max heart rate to see your zones.")}
          </Text>
        ) : (
          <View style={styles.table}>
            {zones.map((zone) => (
              <ZoneRow key={zone.number} zone={zone} zones={zones} heart={heart} />
            ))}
          </View>
        )}
        {zones !== null && hasHandLimits(heart) && (
          <Tap
            style={styles.again}
            onPress={() => saveHeart(calculatedAgain(appHeart()))}
            accessibilityRole="button"
          >
            <Text style={styles.againText}>{t("Back to calculated zones")}</Text>
          </Tap>
        )}
      </ScrollView>
    </View>
  );
}

type BpmFieldProps = {
  label: string;
  /** What the field shows while it is not being typed in. */
  shown: number | null;
  range: { min: number; max: number };
  /** Whether the value was typed: «Clear» then takes it away. */
  byHand: boolean;
  caption: string | null;
  onKeep: (bpm: number | null) => void;
};

/** A heart rate under its name, «Clear» beside the name when it was typed,
 * and why a value is not kept under it. */
function BpmField({ label, shown, range, byHand, caption, onKeep }: BpmFieldProps) {
  const [text, setText] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const done = () => {
    if (text === null) {
      return;
    }
    const typed = readBpm(text, range);
    if (typed.kind === "wrong") {
      setProblem(
        t("Enter a heart rate between {min} and {max} bpm.", {
          min: range.min,
          max: range.max,
        }),
      );
      return;
    }
    setProblem(null);
    setText(null);
    onKeep(typed.kind === "value" ? typed.value : null);
  };
  const clear = () => {
    setText(null);
    setProblem(null);
    onKeep(null);
  };
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {byHand && (
          <Tap
            style={styles.clear}
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={`${t("Clear")}, ${label}`}
          >
            <Text style={styles.clearText}>{t("Clear")}</Text>
          </Tap>
        )}
      </View>
      {/* In a row, so the box is as wide as what it holds. */}
      <View style={styles.boxRow}>
        <BpmInput
          value={text ?? (shown === null ? "" : String(shown))}
          onChangeText={setText}
          onEndEditing={done}
          accessibilityLabel={label}
        />
      </View>
      {caption !== null && <Text style={styles.caption}>{caption}</Text>}
      {problem !== null && (
        <Text style={styles.problem} accessibilityLiveRegion="polite">
          {problem}
        </Text>
      )}
    </View>
  );
}

/** A box for beats a minute, with «bpm» inside it after the number
 * (TASK-386, as «Body» has it since TASK-383): a tap anywhere in the box,
 * «bpm» too, types in it. */
function BpmInput(input: TextInputProps) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable
      style={styles.box}
      onPress={() => ref.current?.focus()}
      accessible={false}
    >
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor={color.textFaint}
        keyboardAppearance="dark"
        returnKeyType="done"
        keyboardType="number-pad"
        maxLength={3}
        {...input}
      />
      <Text style={styles.unit}>bpm</Text>
    </Pressable>
  );
}

type ZoneRowProps = { zone: Zone; zones: readonly Zone[]; heart: HeartSettings };

/** A zone: its name, where it starts, and where it ends. The end of zones 1
 * to 4 is typed; the end of zone 5 is the max heart rate. */
function ZoneRow({ zone, zones, heart }: ZoneRowProps) {
  const name = t(ZONE_NAMES[zone.number - 1]);
  const last = zone.number === zones.length;
  const [text, setText] = useState<string | null>(null);
  const done = () => {
    if (text === null) {
      return;
    }
    setText(null);
    const typed = readBpm(text, { min: REST_BPM.min, max: MAX_BPM.max });
    if (typed.kind === "wrong") {
      // Back to what it was: the limit stays between its neighbours anyway.
      return;
    }
    if (typed.kind === "empty") {
      saveHeart({
        ...heart,
        limits: heart.limits.map((value, i) => (i === zone.number ? null : value)),
      });
      return;
    }
    saveHeart(withLimit(heart, zones, zone.number, typed.value));
  };
  return (
    <View style={styles.zone}>
      <Text style={styles.zoneName}>{name}</Text>
      <Text style={styles.zoneFrom}>{`${zone.fromBpm} –`}</Text>
      {last ? (
        // Not typed: no frame, but the number and «bpm» where the boxes
        // above have them.
        <View style={styles.fixedBox}>
          <Text style={styles.zoneTop}>{zone.toBpm}</Text>
          <Text style={styles.unit}>bpm</Text>
        </View>
      ) : (
        <BpmInput
          value={text ?? String(zone.toBpm)}
          onChangeText={setText}
          onEndEditing={done}
          accessibilityLabel={name}
        />
      )}
    </View>
  );
}

/** The boxes' border, which the frameless top of zone 5 makes up for. */
const BOX_BORDER = 1;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.background,
  },
  header: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    gap: space.md,
  },
  back: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  backText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  content: {
    gap: space.lg,
    padding: space.md,
  },
  intro: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  field: {
    gap: space.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  clear: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  clearText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  boxRow: {
    flexDirection: "row",
  },
  box: {
    minWidth: 120,
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: BOX_BORDER,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: color.surface,
  },
  fixedBox: {
    minWidth: 120,
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md + BOX_BORDER,
  },
  input: {
    flexGrow: 1,
    minWidth: 48,
    minHeight: MIN_TAP_SIZE,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
  },
  unit: {
    color: color.textMuted,
    fontSize: fontSize.input,
  },
  caption: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
  table: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
  },
  zone: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xs,
  },
  zoneName: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
  zoneFrom: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  zoneTop: {
    flexGrow: 1,
    minWidth: 48,
    color: color.text,
    fontSize: fontSize.input,
  },
  again: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  againText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
