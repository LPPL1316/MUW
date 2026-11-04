import type { Direction } from "@shaperoute/shared-types";
import * as Speech from "expo-speech";
import { useContext, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { t } from "../i18n";
import { type Language, LANGUAGES } from "../i18n/languages";
import { useLanguage } from "../i18n/useLanguage";
import { useRunControl } from "../navigation/runControl";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { say } from "./runAudio";
import {
  knownVoices,
  loadVoices,
  saveVoiceChoice,
  speaking,
  useVoiceChoice,
  type VoiceChoice,
  voicesOf,
} from "./voiceChoice";
import { wordsOf } from "./words";

/** What «Listen» says: a turn, as the run says them most. */
export const SAMPLE_TURN: Direction = {
  node: 0,
  point: [0, 0],
  distance_m: 0,
  turn: "left",
  angle_deg: -90,
  street: "Via Roma",
  road_type: "residential",
  branches: 3,
  joined: false,
  along: null,
};

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

/** The name of `language`, in itself: «Italiano». */
function nameOf(language: Language): string {
  return LANGUAGES.find((option) => option.id === language)?.name ?? language;
}

/**
 * The language and the voice of the run, on «Data» under «Voice» (TASK-209,
 * ADR-0171): a row that says who speaks and in what, which opens the
 * choice, and «Listen», which says a turn with it. The choice stays on the
 * phone (voiceChoice) and the run speaks with it from the next words on.
 * With «Voice» off the choice is still there, and nothing speaks.
 */
export function VoiceSetting() {
  const choice = useVoiceChoice();
  const app = useLanguage();
  const { voice: on } = useRunControl();
  const [voices, setVoices] = useState<readonly Speech.Voice[] | null>(knownVoices);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void loadVoices().then((read) => {
      if (live) {
        setVoices(read);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const now = speaking(choice, app, voices);
  const voiceName =
    voices?.find((each) => each.identifier === now.options.voice)?.name ?? t("Default");
  const summary = `${nameOf(now.language)} · ${voiceName}`;

  function listen() {
    // As the run speaks: during a run, the music comes back up after it.
    say(wordsOf(now.language).announcement([SAMPLE_TURN], 50), now.options);
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.choice}
        onPress={() => {
          setOpen(true);
          // A phone that was slow to list its voices may have them now.
          void loadVoices().then(setVoices);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("Voice language and voice: {language}, {voice}", {
          language: nameOf(now.language),
          voice: voiceName,
        })}
        accessibilityHint={t("Changes the language and the voice")}
      >
        <Text style={styles.choiceText} numberOfLines={1}>
          {summary}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <ListenButton on={on} onPress={listen} />
      <VoiceSheet
        open={open}
        onClose={() => setOpen(false)}
        choice={choice}
        app={app}
        voices={voices}
        on={on}
        onListen={listen}
      />
    </View>
  );
}

/** «Listen»: a play sign in a circle; with «Voice» off it is there and
 * does nothing. */
function ListenButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.listen, !on && styles.off]}
      onPress={onPress}
      disabled={!on}
      accessibilityRole="button"
      accessibilityLabel={t("Listen")}
      accessibilityHint={
        on ? t("Says a turn with this voice") : t("Turn on Voice to listen")
      }
      accessibilityState={{ disabled: !on }}
    >
      <View style={styles.play} />
    </Pressable>
  );
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  choice: VoiceChoice;
  app: Language;
  voices: readonly Speech.Voice[] | null;
  on: boolean;
  onListen: () => void;
};

/**
 * The choice, over «Data»: the language first («App language», then the
 * five), then the voices the phone has for the language that speaks, with
 * «Default», the phone's own, first. A tap keeps the choice at once.
 */
function VoiceSheet({ open, onClose, choice, app, voices, on, onListen }: SheetProps) {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const { height } = useWindowDimensions();
  const now = speaking(choice, app, voices);
  const wanted = choice.language === "app" ? app : choice.language;
  const theirs = voices === null ? [] : voicesOf(now.language, voices);

  function chooseLanguage(language: VoiceChoice["language"]) {
    saveVoiceChoice({ ...choice, language });
  }

  function chooseVoice(voice: string | null) {
    const { [now.language]: _old, ...others } = choice.voices;
    saveVoiceChoice({
      ...choice,
      voices: voice === null ? others : { ...others, [now.language]: voice },
    });
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.dim} />
      {/* A tap outside closes it: what was tapped is already kept. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("Close")}
      />
      <View
        style={[
          styles.sheet,
          { maxHeight: height * 0.8, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <ScrollView contentContainerStyle={styles.lists}>
          <Text style={styles.heading}>{t("Language")}</Text>
          <View
            style={styles.group}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("Language")}
          >
            <Option
              label={t("App language")}
              detail={nameOf(app)}
              checked={choice.language === "app"}
              onPress={() => chooseLanguage("app")}
            />
            {LANGUAGES.map((option) => (
              <Option
                key={option.id}
                divided
                label={option.name}
                checked={choice.language === option.id}
                onPress={() => chooseLanguage(option.id)}
              />
            ))}
          </View>
          <Text style={styles.heading}>{t("Voice")}</Text>
          {voices !== null && voices.length === 0 && (
            <Text style={styles.note}>
              {t("This phone did not list its voices: its own voice speaks.")}
            </Text>
          )}
          {now.language !== wanted && (
            <Text style={styles.note}>
              {t("This phone has no {language} voice: the voice speaks English.", {
                language: nameOf(wanted),
              })}
            </Text>
          )}
          <View
            style={styles.group}
            accessibilityRole="radiogroup"
            accessibilityLabel={t("Voice")}
          >
            <Option
              label={t("Default")}
              checked={now.options.voice === undefined}
              onPress={() => chooseVoice(null)}
            />
            {theirs.map((voice) => (
              <Option
                key={voice.identifier}
                divided
                label={voice.name}
                detail={
                  voice.quality === Speech.VoiceQuality.Enhanced
                    ? t("{language} · Enhanced", { language: voice.language })
                    : voice.language
                }
                checked={now.options.voice === voice.identifier}
                onPress={() => chooseVoice(voice.identifier)}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <Pressable
            style={[styles.action, !on && styles.off]}
            onPress={onListen}
            disabled={!on}
            accessibilityRole="button"
            accessibilityState={{ disabled: !on }}
            accessibilityHint={on ? undefined : t("Turn on Voice to listen")}
          >
            <Text style={styles.actionText}>{t("Listen")}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={onClose} accessibilityRole="button">
            <Text style={styles.actionText}>{t("Done")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** A row of a list; `divided` draws the line that parts it from the row
 * above. */
function Option({
  label,
  detail,
  checked,
  divided = false,
  onPress,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  divided?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.option, divided && styles.divided]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={detail === undefined ? label : `${label}, ${detail}`}
      accessibilityState={{ checked }}
    >
      <View style={styles.optionWords}>
        <Text style={styles.optionText}>{label}</Text>
        {detail !== undefined && <Text style={styles.optionDetail}>{detail}</Text>}
      </View>
      {checked && <Text style={styles.check}>✓</Text>}
    </Pressable>
  );
}

// The row as the switches beside it (`../screens/RunDashboard`), the lists
// as the sport's menu (`../settings/SportButton`).
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  choice: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
  },
  choiceText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  chevron: {
    color: color.textMuted,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  listen: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  off: {
    opacity: 0.4,
  },
  // A triangle pointing right, of borders, as «Resume» has.
  play: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: color.text,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.background,
    opacity: 0.6,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  lists: {
    gap: space.sm,
  },
  heading: {
    marginTop: space.sm,
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
  },
  option: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  optionWords: {
    flex: 1,
    paddingVertical: space.xs,
  },
  optionText: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  optionDetail: {
    color: color.textFaint,
    fontSize: fontSize.small,
  },
  // Not yellow: the yellow belongs to the route (docs/UI.md, «Il tema»).
  check: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
  },
  action: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  actionText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
