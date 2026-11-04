import type { Activity } from "@shaperoute/shared-types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { type DrawingChoice, isChosen, isSeen, NOT_CHOSEN } from "../api/drawings";
import { loadHealthOn } from "../health/healthChoice";
import { healthPhone } from "../health/healthModules";
import type { HealthPhone } from "../health/healthPhone";
import { HealthRunEnd } from "../health/HealthRunEnd";
import { saveToHealth, useHealth } from "../health/useHealth";
import { t } from "../i18n";
import { ImportedMark } from "../imports/ImportedMark";
import { showSavedLogo } from "../intro/SavedLogo";
import { loadRun } from "../navigation/trackStore";
import { activityOf } from "../settings/sport";
import { useSport } from "../settings/useSport";
import { phonePhotoUri } from "../social/drawingPhotos";
import type { PhotoShown } from "../social/drawingsDoor";
import {
  DrawingForm,
  FormScroll,
  nextPlace,
  type PickPhoto,
  seenText,
} from "../social/PublicParts";
import { loadVisibility, saveVisibility } from "../social/visibilityChoice";
import { loadSendToStrava, saveSendToStrava } from "../strava/stravaChoice";
import { StravaRunEnd } from "../strava/StravaRunEnd";
import { useStrava } from "../strava/useStrava";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { SIGN_IN_TO_KEEP_RUNS, useActivitiesDoor } from "./activitiesDoor";

type Props = {
  /** «Save»: the run goes to «My activities». False when it could not even
   * be kept on the phone, or the phone holds too many runs not sent yet
   * (TASK-257): the screen stays, and says so. */
  onSave: () => boolean;
  /** «Discard», after a yes: the run is gone for good. */
  onDiscard: () => void;
  /** The fakes of the tests: the photo picker, the fetch of the tag search,
   * the phone's health data. */
  pick?: PickPhoto;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
  health?: HealthPhone | null;
  /**
   * An activity added from a file of another app (TASK-312, ADR-0272), with
   * the sport the file says (null: the one of «Settings»): «Imported» over
   * the form, and a line that it does not count for Play or the contests.
   * Neither «Send to Strava» (it often comes from Strava itself) nor the
   * phone's health data (the other app wrote it there already).
   */
  imported?: { sport: Activity | null };
};

/** How much of the screen the form may take: the map and the buttons
 * keep the rest. */
export const FORM_SHARE = 0.5;

/** A photo chosen at the end of the run, on the phone until «Save». */
type Chosen = { n: number; base64: string };

/**
 * The way out of a run that ended, under its card (TASK-172): with an
 * account, «Save» keeps it in «My activities» and «Discard» throws it
 * away, after asking. Nothing is saved without «Save». Without an account
 * the card keeps its «Done», and a line here says how to keep the next
 * runs. Over the buttons the form of the drawing, as Strava's (TASK-208,
 * ADR-0170): up to three photos, the title, «How did it go?», the people
 * tagged, what the run was (from the sport of «Settings») and who can see
 * it («Only me» until the account saves another choice, then the last one
 * saved, the user's choice, ADR-0304); then «Send to Strava»
 * with Strava connected (TASK-187), and «Save to Apple Health» (or to
 * Health Connect) where the phone's build has it (TASK-321). With «Save»
 * the choice and the photos go with the run: to the API once it has the
 * run, the photos only while others see it; and the run to the phone's
 * health data, after the user's yes. An activity added from a file has the
 * same form, marked «Imported» (TASK-312).
 */
export function RunEnd({
  onSave,
  onDiscard,
  pick,
  fetchFn,
  apiKey,
  health: phoneHealth = healthPhone(),
  imported,
}: Props) {
  const {
    signedIn,
    owner,
    signIn,
    toStrava,
    toDrawing,
    toPhotos,
    full,
    waiting,
    refused,
  } = useActivitiesDoor();
  const strava = useStrava();
  const health = imported === undefined ? phoneHealth : null;
  const healthState = useHealth(health);
  const sport = useSport();
  const { height } = useWindowDimensions();
  // «Discard» asks first, here: a run thrown away does not come back.
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  // As it was left at the end of the last run (the user's choice).
  const [send, setSend] = useState(loadSendToStrava);
  // «Only me» until the account saves another choice, then the last one
  // saved (the user's choice, ADR-0304): nobody is public without having
  // chosen it. An activity added from a file is an old one: always «Only me».
  // The activity is the sport chosen in «Settings», or the one the file says.
  const [choice, setChoice] = useState<DrawingChoice>(() => ({
    ...NOT_CHOSEN,
    activity: imported?.sport ?? activityOf(sport),
    visibility: imported === undefined ? loadVisibility(owner) : "only_me",
  }));
  // Started from a remembered «Everyone» or «Followers»: the form scrolls, so
  // its words stay over «Save» too, seen before the run goes public.
  const [startedSeen] = useState(() => isSeen(choice.visibility));
  const [photos, setPhotos] = useState<Chosen[]>([]);

  function save() {
    const sending =
      imported === undefined &&
      strava.status.available &&
      strava.status.connected &&
      send;
    toStrava(sending ? { name: choice.title } : null);
    toDrawing(isChosen(choice) ? choice : null);
    toPhotos([...photos].sort((a, b) => a.n - b.n).map((photo) => photo.base64));
    // The run as the phone keeps it, read before «Save» lets the file go:
    // only after the user's yes to the phone's health data.
    const run = health !== null && loadHealthOn() ? loadRun() : null;
    const kept = onSave();
    setFailed(!kept);
    if (kept) {
      if (imported === undefined && owner !== null) {
        saveVisibility(owner, choice.visibility);
      }
      // The Sgrava logo, over the app, says the run is kept (TASK-212).
      showSavedLogo();
      if (run !== null) {
        // To the phone's health data, as the form says the run was
        // (TASK-321): written there, on the phone, with no network.
        void saveToHealth(health, run.track, choice.activity);
      }
    }
  }

  if (!signedIn) {
    return (
      <Pressable style={styles.tap} onPress={signIn} accessibilityRole="button">
        <Text style={[styles.line, styles.link]}>{t(SIGN_IN_TO_KEEP_RUNS)}</Text>
      </Pressable>
    );
  }
  if (confirming) {
    return (
      <View style={styles.end}>
        <Text style={styles.question}>
          {t("Discard this run? It will not be saved.")}
        </Text>
        <View style={styles.buttons}>
          <Pressable
            style={styles.button}
            onPress={() => setConfirming(false)}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t("Keep it")}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.danger]}
            onPress={onDiscard}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.dangerText]}>
              {t("Discard run")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const shown: PhotoShown[] = [...photos]
    .sort((a, b) => a.n - b.n)
    .map((photo) => ({
      n: photo.n,
      source: { uri: phonePhotoUri(photo.base64) },
      onPhone: true,
    }));
  return (
    <View style={styles.end}>
      <FormScroll maxHeight={Math.round(height * FORM_SHARE)}>
        <View style={styles.form}>
          {imported !== undefined && (
            <View style={styles.imported}>
              <ImportedMark />
              <Text style={styles.note}>
                {t("Imported activities don't count for Play or contests.")}
              </Text>
            </View>
          )}
          <DrawingForm
            choice={choice}
            onChoice={setChoice}
            photos={shown}
            onAddPhoto={(base64) => {
              const n = nextPlace(photos);
              if (n !== null) {
                setPhotos((was) => [...was, { n, base64 }]);
              }
            }}
            onRemovePhoto={(photo) =>
              setPhotos((was) => was.filter((other) => other.n !== photo.n))
            }
            imported={imported !== undefined}
            pick={pick}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
          {imported === undefined && (
            <StravaRunEnd
              strava={strava}
              send={send}
              onSend={(on) => {
                setSend(on);
                saveSendToStrava(on);
              }}
            />
          )}
          {health !== null && (
            <HealthRunEnd store={health.store} health={healthState} />
          )}
        </View>
      </FormScroll>
      {startedSeen && isSeen(choice.visibility) && (
        <Text style={styles.note}>{seenText(choice.visibility)}</Text>
      )}
      {failed && (
        <Text style={styles.problem} accessibilityRole="alert">
          {!full
            ? t("This run could not be kept on the phone. Try again.")
            : // Nothing is let go to make room (TASK-257): only a run the
              // API refused can be discarded, in «My activities».
              t(
                refused.length > 0
                  ? "The phone holds {count} runs not sent yet. Discard one in My activities first."
                  : "The phone holds {count} runs not sent yet. They go when there is a connection; then save this one.",
                { count: String(waiting) },
              )}
        </Text>
      )}
      <View style={styles.buttons}>
        <Pressable
          style={styles.button}
          onPress={() => setConfirming(true)}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, styles.dangerText]}>{t("Discard")}</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={save}
          accessibilityRole="button"
          accessibilityLabel={t("Save to My activities")}
        >
          <Text style={styles.buttonText}>{t("Save")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  end: {
    gap: space.sm,
    paddingTop: space.md,
  },
  form: {
    gap: space.sm,
    paddingBottom: space.xs,
  },
  imported: {
    gap: space.xs,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  buttons: {
    flexDirection: "row",
    gap: space.sm,
  },
  // Neutral, as every button of the end of a run: the yellow is the
  // route's (docs/UI.md, «Il tema»).
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  danger: {
    borderColor: color.error,
  },
  dangerText: {
    color: color.error,
  },
  question: {
    color: color.text,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  tap: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  line: {
    paddingTop: space.sm,
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  link: {
    color: color.text,
    textDecorationLine: "underline",
  },
});
