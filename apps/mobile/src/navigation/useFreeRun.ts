import type { LatLon } from "@shaperoute/shared-types";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useEffect, useState } from "react";

import { activityOf, loadSport } from "../settings/sport";
import { appUnits } from "../units/units";
import { endRunAudio, startRunAudio } from "../voice/runAudio";
import { loadVoices, speaking } from "../voice/voiceChoice";
import { FREE_ROUTE, kmAnnouncement, wholeUnits } from "./freeRun";
import { freeRunActivity } from "./freeSport";
import { kmComparison } from "./kmCompare";
import { isPaddle, paddleAnnouncement } from "./paddle";
import { type RunAway, watchAway } from "./runAway";
import { controlRun, type RunSession } from "./runControl";
import { type RunWatch, watchRunPosition } from "./runPosition";
import { isSwim, SWIM_AUTO_PAUSE_AFTER_MS } from "./swim";
import { emptyTrack, type Track } from "./trackRecorder";
import { startRun } from "./trackStore";
import { FIX_EVERY_M, play } from "./useNavigation";

export type FreeRunState =
  | { status: "starting" }
  /** `position` is null until the GPS gives the first fix. */
  | { status: "running"; track: Track; position: LatLon | null }
  | { status: "denied" };

/**
 * Records a run without a route while `active` (TASK-149): the phone's
 * position, with the screen on or in pocket mode, into the run file of
 * TASK-112. No directions: the voice says each kilometre, with the time
 * and the pace, and from the second how it went against the one before
 * (TASK-217); with miles each mile, in the units «Settings» has when the
 * voice speaks (TASK-182). With «Paddle» in «Settings» the pace said is of
 * 500 m (TASK-251). The countdown, «Pause» and the pause by standing still are
 * runControl's (TASK-169). With the phone locked, or another app in front,
 * the GPS goes on where the app can (TASK-261, `runPosition`) and the voice
 * speaks, over the music (part B, `runAudio`). The position never leaves the
 * phone.
 */
export function useFreeRun(active: boolean): FreeRunState {
  const [state, setState] = useState<FreeRunState>({ status: "starting" });

  useEffect(() => {
    if (!active) {
      return;
    }
    let stopped = false;
    let subscription: RunWatch | null = null;
    let run: RunSession | null = null;
    let stopRecording: (() => void) | null = null;
    let away: RunAway | null = null;
    // The phone's voices, before the first kilometre (TASK-209).
    void loadVoices();
    // The voice with the phone locked, and over the music (TASK-261 B).
    startRunAudio();
    // The phone refusing the position altogether (its services off) is a
    // rejection, not a denial: it is one all the same (TASK-253).
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (stopped) {
          return;
        }
        if (!permission.granted) {
          setState({ status: "denied" });
          return;
        }
        // A free run stopped lately goes on with its track (trackStore).
        // On the water the pace is a paddler's (TASK-251), on a bike the
        // numbers are speeds (TASK-251 C): the sport is the one «Settings»
        // has when the outing starts, kept in the run's file.
        const activity = freeRunActivity(activityOf(loadSport()));
        const recorder = startRun(FREE_ROUTE, Date.now(), undefined, [], activity);
        stopRecording = recorder.stop;
        // A run that goes on does not say again the kilometres it has said;
        // with miles, the miles (TASK-182).
        let saidUnits = appUnits();
        let saidKm = wholeUnits(recorder.track(), saidUnits);
        let position: LatLon | null = null;
        // A swim says nothing: with the head in the water nobody hears it
        // (TASK-323 D); standing still waits longer before the pause.
        const swim = isSwim(activity);
        const session = controlRun(recorder, {
          // «Pause» and «Resume» change the track between two fixes.
          onChange: () => {
            if (!stopped) {
              setState({ status: "running", track: recorder.track(), position });
            }
          },
          say: (text) => {
            if (!swim) {
              play([{ say: text, vibrate: false }]);
            }
          },
          ...(swim ? { stillMs: SWIM_AUTO_PAUSE_AFTER_MS } : {}),
        });
        run = session;
        setState({ status: "running", track: recorder.track(), position });
        // With the phone locked too, where the app can (TASK-261).
        subscription = await watchRunPosition(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: FIX_EVERY_M,
          },
          ({ coords, timestamp }) => {
            if (stopped) {
              return;
            }
            away?.beforeFix();
            const fix: LatLon = [coords.latitude, coords.longitude];
            position = fix;
            session.onFix(
              {
                point: fix,
                timeMs: timestamp,
                accuracyM: coords.accuracy,
                altitudeM: coords.altitude,
              },
              false,
            );
            const track = recorder.track();
            const units = appUnits();
            if (units !== saidUnits) {
              // «Settings» changed the units during the run: those behind
              // are not said again, the next one is.
              saidUnits = units;
              saidKm = wholeUnits(track, units);
            }
            const km = wholeUnits(track, units);
            if (km > saidKm && !swim) {
              saidKm = km;
              const { language } = speaking();
              const said = isPaddle(activity)
                ? paddleAnnouncement(km, track, language, units)
                : kmAnnouncement(km, track, language, units);
              play([{ say: said, vibrate: false }]);
              // Then how it went against the one before (TASK-217).
              const compared = kmComparison(km, track, language, units);
              if (compared !== null) {
                play([{ say: compared, vibrate: false }]);
              }
            }
            setState({ status: "running", track, position: fix });
          },
        );
        if (stopped) {
          subscription.remove();
          return;
        }
        // The app behind another, or the phone locked: where the GPS stops
        // with it, a long absence is a pause of the phone's (TASK-255,
        // TASK-261).
        away = watchAway(recorder, { background: subscription.background });
      } catch {
        if (!stopped) {
          setState({ status: "denied" });
        }
      }
    })();
    return () => {
      stopped = true;
      subscription?.remove();
      away?.remove();
      run?.end();
      stopRecording?.();
      void Speech.stop();
      endRunAudio();
      setState({ status: "starting" });
    };
  }, [active]);

  return state;
}

/** The track so far, or an empty one: for the screens that show it. */
export function trackOf(state: FreeRunState): Track {
  return state.status === "running" ? state.track : EMPTY;
}

const EMPTY = emptyTrack();
