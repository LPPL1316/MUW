import type {
  Activity,
  Direction,
  LatLon,
  Stretch,
  Walk,
} from "@shaperoute/shared-types";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Vibration } from "react-native";

import { onFootOf } from "../route/onFoot";
import { walksOf } from "../route/walks";
import { appUnits } from "../units/units";
import { endRunAudio, say, startRunAudio } from "../voice/runAudio";
import { loadVoices, speaking } from "../voice/voiceChoice";
import { wordsOf } from "../voice/words";
import { kmAnnouncement } from "./freeRun";
import { comparisonOf } from "./kmCompare";
import { type Cue, type Navigation, onFix, startNavigation } from "./navigator";
import { moveOnFoot, startOnFoot } from "./onFootVoice";
import { isPaddle, paddleAnnouncement } from "./paddle";
import { movePen, startPen } from "./penUp";
import { resumeFollowing } from "./resume";
import { announceMOf, isRide, rideAnnouncement, saidKmOf } from "./ride";
import { type RunAway, watchAway } from "./runAway";
import { controlRun, runControl, type RunSession } from "./runControl";
import { type RunWatch, watchRunPosition } from "./runPosition";
import { emptyTrack, type Track } from "./trackRecorder";
import { startRun } from "./trackStore";

/** A fix at least this often apart, in metres: a stride or two. */
export const FIX_EVERY_M = 5;
/** The vibration with each turn, in milliseconds: felt in a pocket. */
export const VIBRATE_MS = 400;

export type NavigationState =
  | { status: "starting" }
  /** `track` is the line run so far, for the numbers of the run (TASK-164). */
  | {
      status: "following";
      navigation: Navigation;
      position: LatLon | null;
      track: Track;
    }
  | { status: "denied" };

/** Says and vibrates what the navigator decided, in the language and the
 * voice chosen for it (TASK-209). With the voice off (TASK-169) a turn
 * still vibrates. */
export function play(cues: Cue[]): void {
  const { options } = speaking();
  for (const cue of cues) {
    if (cue.vibrate) {
      Vibration.vibrate(VIBRATE_MS);
    }
    if (runControl().voice) {
      // Each cue after the last one: a turn is never cut by the next.
      say(cue.say, options);
    }
  }
}

/**
 * Follows the phone's position along the route while `active`, with the
 * screen on (TASK-049), and records the track that is run in a file on the
 * phone (TASK-112). The countdown, «Pause» and the pause by standing still
 * are runControl's, and each kilometre is said as in a run without a route
 * (TASK-169). Along a word with the pen up, the recording pauses on each
 * walk and goes on at the next letter, and the voice says so (TASK-198).
 * Along a bike route the voice says each stretch with the bike on foot
 * ahead, and its end, without pausing the recording (TASK-206). A route of
 * `activity` "cycling" is followed by bike (TASK-216): turns said further
 * ahead, the kilometres every RIDE_KM_EVERY with the average speed, and the
 * way between the letters ridden. On the water (`activity` "paddling") each
 * kilometre is said with the average pace of 500 m (TASK-251). After the
 * kilometres the voice says how they went against those before (TASK-217,
 * `kmCompare`).
 * Each fix is said in the voice's language of that moment (TASK-209), so a
 * change on «Data» is heard at once, and in the units «Settings» has at
 * that moment (TASK-182): with miles each mile, on a bike every
 * RIDE_MI_EVERY, and the turns in feet. With the phone locked, or another app
 * in front, the GPS goes on where the app can (TASK-261, `runPosition`) and
 * the voice speaks, over the music (part B, `runAudio`). The position never
 * leaves the phone.
 */
export function useNavigation(
  points: LatLon[] | null,
  directions: Direction[],
  active: boolean,
  /** The route's similarity to its shape, kept with the track for the score. */
  similarity?: number,
  /** The route's walks and its word, for a word with the pen up (TASK-198),
   * its stretches with the bike on foot (TASK-206) and its activity
   * (TASK-216): none for any other route, which is followed as a run. */
  {
    walks,
    word,
    onFoot,
    activity,
    rotationDeg,
  }: {
    walks?: Walk[];
    word?: string | null;
    onFoot?: Stretch[];
    activity?: Activity;
    /** How far the route's shape is turned (TASK-232): kept with the
     * track, so the run saved shows the drawing turned back. */
    rotationDeg?: number;
  } = {},
): NavigationState {
  const [state, setState] = useState<NavigationState>({ status: "starting" });
  const navigation = useRef<Navigation | null>(null);

  useEffect(() => {
    if (!active || points === null) {
      return;
    }
    let stopped = false;
    let subscription: RunWatch | null = null;
    let run: RunSession | null = null;
    let stopRecording: (() => void) | null = null;
    let away: RunAway | null = null;
    // The phone's voices, before the first words: a chosen one is used only
    // once it is known to be there.
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
        const started = startNavigation(
          points,
          directions,
          speaking().language,
          announceMOf(activity),
        );
        navigation.current = started.navigation;
        const walked = walksOf(points, walks);
        let pen = startPen(started.navigation.along, walked, word, activity);
        let bike = startOnFoot(started.navigation.along, onFootOf(points, onFoot));
        // A route stopped lately goes on with its track (trackStore); one
        // the app was closed during, paused (TASK-272). Its directions, word
        // and stretches on foot are kept with it, to follow it so again.
        const recorder = startRun(
          points,
          Date.now(),
          similarity,
          walked,
          activity,
          rotationDeg,
          { directions, word, onFoot },
        );
        stopRecording = recorder.stop;
        // A run that goes on: the navigator, the pen and the bike on foot
        // where its track got to, without a word (TASK-253).
        const resumed = resumeFollowing(
          { navigation: started.navigation, pen, onFoot: bike },
          recorder.track().fixes,
        );
        navigation.current = resumed.navigation;
        pen = resumed.pen;
        bike = resumed.onFoot;
        // A run that goes on does not say again the kilometres it has said;
        // with miles, the miles (TASK-182).
        let saidUnits = appUnits();
        let saidKm = saidKmOf(recorder.track(), activity, saidUnits);
        let position: LatLon | null = null;
        const session = controlRun(recorder, {
          // «Pause» and «Resume» change the track between two fixes.
          onChange: () => {
            if (!stopped && navigation.current !== null) {
              setState({
                status: "following",
                navigation: navigation.current,
                position,
                track: recorder.track(),
              });
            }
          },
          say: (text) => play([{ say: text, vibrate: false }]),
        });
        run = session;
        setState({
          status: "following",
          navigation: resumed.navigation,
          position,
          track: recorder.track(),
        });
        // «Head out on …» is for a run that starts, not one that goes on.
        if (recorder.track().fixes.length === 0) {
          play(started.cues);
        }
        // With the phone locked too, where the app can (TASK-261).
        subscription = await watchRunPosition(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: FIX_EVERY_M,
          },
          ({ coords, timestamp }) => {
            if (stopped || navigation.current === null) {
              return;
            }
            away?.beforeFix();
            const fix: LatLon = [coords.latitude, coords.longitude];
            position = fix;
            const { language } = speaking();
            const next = onFix(
              navigation.current,
              fix,
              { accuracyM: coords.accuracy, timeMs: timestamp },
              language,
            );
            navigation.current = next.navigation;
            const drawing = movePen(
              pen,
              next.navigation.alongM,
              coords.accuracy,
              language,
            );
            pen = drawing.pen;
            // The fix that reaches a letter is its first; the one that ends a
            // letter is its last.
            if (drawing.move === "down") {
              session.lowerPen(timestamp);
            }
            session.onFix(
              {
                point: fix,
                timeMs: timestamp,
                accuracyM: coords.accuracy,
                altitudeM: coords.altitude,
              },
              next.navigation.arrived,
            );
            if (drawing.move === "up") {
              session.liftPen(timestamp);
            }
            const track = recorder.track();
            setState({
              status: "following",
              navigation: next.navigation,
              position: fix,
              track,
            });
            // The pen first: what the runner does next depends on it.
            play(drawing.cues);
            play(next.cues);
            // After the turn, which may be the way onto the stretch.
            const walking = moveOnFoot(
              bike,
              next.navigation.alongM,
              wordsOf(language),
              coords.accuracy,
            );
            bike = walking.onFoot;
            play(walking.cues);
            // After the turn, so a kilometre never delays one.
            const units = appUnits();
            if (units !== saidUnits) {
              // «Settings» changed the units during the run: those behind
              // are not said again, the next one is.
              saidUnits = units;
              saidKm = saidKmOf(track, activity, units);
            }
            const km = saidKmOf(track, activity, units);
            if (km > saidKm) {
              saidKm = km;
              const said = isRide(activity)
                ? rideAnnouncement(km, track, language, units)
                : isPaddle(activity)
                  ? paddleAnnouncement(km, track, language, units)
                  : kmAnnouncement(km, track, language, units);
              play([{ say: said, vibrate: false }]);
              // Then how it went against the one before (TASK-217).
              const compared = comparisonOf(km, track, activity, language, units);
              if (compared !== null) {
                play([{ say: compared, vibrate: false }]);
              }
            }
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
  }, [
    active,
    points,
    directions,
    similarity,
    walks,
    word,
    onFoot,
    activity,
    rotationDeg,
  ]);

  return state;
}

/** The track so far, or an empty one: for the screens that show it. */
export function trackOfNavigation(state: NavigationState): Track {
  return state.status === "following" ? state.track : EMPTY;
}

const EMPTY = emptyTrack();
