import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useActivitiesDoor } from "../activities/activitiesDoor";
import { startedLabel } from "../activities/activityText";
import { RunDrawing } from "../activities/RunDrawing";
import { RunEnd } from "../activities/RunEnd";
import { t } from "../i18n";
import type { PickPhoto } from "../social/PublicParts";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import {
  type ImportedRun,
  importedRun,
  type ImportProblem,
  importProblemText,
} from "./importFile";
import {
  filePickerAvailable,
  type PickFile,
  pickActivityFile,
} from "./pickActivityFile";

/** The side of the drawing of the file's track over the form. */
const DRAWING = 160;

type Stage =
  | { kind: "closed" }
  | { kind: "choosing"; problem: string | null }
  | { kind: "reading" }
  | { kind: "form"; imported: ImportedRun };

type Props = {
  /** The fakes of the tests: whether the app was built with the file
   * picker, the picker, and what RunEnd takes. */
  available?: boolean;
  pickFile?: PickFile;
  pick?: PickPhoto;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Add past activity» at the top of «My activities» (TASK-312, ADR-0272;
 * docs/IMPORTAZIONI.md §2–3): «From a file» opens «Files» for a GPX, TCX or
 * FIT of another app. The file is read on the phone; a file that is not an
 * activity says why, and one already kept says so. Then the form of the end
 * of a run, under the drawing of its track, marked «Imported»: nothing
 * leaves the phone before «Save», and the file never. In an app built
 * without the picker (the store's 1.0) there is nothing to add yet, and the
 * button is not there; «Photos only» comes with part C.
 */
export function AddPastActivity({
  available = filePickerAvailable(),
  pickFile = pickActivityFile,
  pick,
  fetchFn,
  apiKey,
}: Props) {
  const { recordImported, alreadyKept } = useActivitiesDoor();
  const [stage, setStage] = useState<Stage>({ kind: "closed" });

  if (!available) {
    return null;
  }

  async function fromFile() {
    setStage({ kind: "reading" });
    const problem = (kind: ImportProblem | "unreadable") =>
      setStage({
        kind: "choosing",
        problem:
          kind === "unreadable" ? t("Something went wrong.") : importProblemText(kind),
      });
    const picked = await pickFile();
    if (picked.kind === "canceled") {
      setStage({ kind: "choosing", problem: null });
      return;
    }
    if (picked.kind !== "picked") {
      problem(picked.kind);
      return;
    }
    const outcome = importedRun(picked.bytes);
    if (outcome.kind === "problem") {
      problem(outcome.problem);
      return;
    }
    // Before the form: a run kept already would only have its drawing
    // written over by «Save».
    if (await alreadyKept(outcome.imported.id)) {
      problem("already_saved");
      return;
    }
    setStage({ kind: "form", imported: outcome.imported });
  }

  if (stage.kind === "form") {
    const { imported } = stage;
    const started = new Date(imported.request.track[0].time_ms).toISOString();
    return (
      <View style={styles.card} testID="imported-form">
        <Text style={styles.when}>{startedLabel(started)}</Text>
        <View style={styles.drawing}>
          <RunDrawing
            route={null}
            track={imported.line}
            width={DRAWING}
            height={DRAWING}
          />
        </View>
        <RunEnd
          imported={{ sport: imported.sport }}
          onSave={() => {
            const kept = recordImported(imported);
            if (kept) {
              setStage({ kind: "closed" });
            }
            return kept;
          }}
          onDiscard={() => setStage({ kind: "closed" })}
          pick={pick}
          fetchFn={fetchFn}
          apiKey={apiKey}
          health={null}
        />
      </View>
    );
  }

  const open = stage.kind !== "closed";
  const reading = stage.kind === "reading";
  return (
    <View style={styles.add}>
      <Pressable
        style={styles.button}
        onPress={() =>
          setStage(open ? { kind: "closed" } : { kind: "choosing", problem: null })
        }
        disabled={reading}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: reading }}
      >
        <Text style={styles.buttonText}>{t("Add past activity")}</Text>
      </Pressable>
      {open && (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.choice,
              (pressed || reading) && styles.pressed,
            ]}
            onPress={() => void fromFile()}
            disabled={reading}
            accessibilityRole="button"
            accessibilityState={{ disabled: reading, busy: reading }}
          >
            <Text style={styles.choiceTitle}>
              {reading ? t("Loading…") : t("From a file")}
            </Text>
            <Text style={styles.choiceDetail}>
              {t("GPX, TCX or FIT from Strava, Garmin, Komoot…")}
            </Text>
          </Pressable>
          <Text style={styles.help}>
            {t(
              "Export the activity as a file from the other app or its website, save it in Files, then pick it here.",
            )}
          </Text>
          {stage.kind === "choosing" && stage.problem !== null && (
            <Text style={styles.problem} accessibilityRole="alert">
              {stage.problem}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    gap: space.sm,
  },
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  when: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  drawing: {
    alignItems: "center",
  },
  // Neutral, as every button of «My activities»: the yellow is the route's.
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  choice: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    gap: 2,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  choiceTitle: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  choiceDetail: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  help: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
});
