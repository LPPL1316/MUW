import type { Activity, LatLon } from "@shaperoute/shared-types";
import { useEffect, useRef, useState } from "react";

import type { PositionState } from "../location/useCurrentPosition";
import { drawShapesAhead } from "../paddle/aheadExamples";
import { activityOf, loadSport } from "../settings/sport";
import { downloadAhead } from "./aheadZones";
import { keepPlaces } from "./keptPlaces";
import { type PhoneEngine, phoneEngine } from "./phoneEngine";
import {
  AROUND_MARGIN_M,
  coveringZone,
  downloadZone,
  NETWORKS,
  type Network,
  savedZones,
  zonesForEngine,
} from "./zones";

/** The activity whose routes a network's zone is read ahead for. */
const ACTIVITIES: Readonly<Record<Network, Activity>> = {
  foot: "running",
  bike: "cycling",
};

/** Smaller than any zone, larger than an error the server sends: what is
 * told under it is not a map. */
export const NOTICE_MIN_BYTES = 100_000;

/**
 * At each opening of the app, once the position is known, the zones of the
 * phone around it: first the network of the sport of «Settings», then the
 * other (TASK-214, choice 4). Without asking, on any network, also on mobile
 * data (the user's choice of 2026-10-03); a zone the phone has costs a 304.
 * With a zone around the phone, Python starts ahead of the first route: at
 * once with one saved before, else with the first downloaded (TASK-287).
 * The zones around are asked with AROUND_MARGIN_M of room (part E), and
 * once they are there, the one of the sport is read into Python's memory.
 * Then, slowly, the zones of the cities ahead (part B2, `aheadZones.ts`),
 * when the server gave a zone around the phone at this opening; and, beside
 * them, the shapes on the water of the places near the phone (TASK-246,
 * `aheadExamples.ts`): routes asked of the API when it answers, whatever it
 * has of zones. Before the cities ahead, the places the user keeps that are
 * not on the phone yet (TASK-334, `keptPlaces.ts`), from a server that
 * answers.
 *
 * Gives the bytes of the first maps of the phone while they download, for
 * the notice over «Draw route» (part C), else null. Only the first: when
 * the phone has no zone as the app opens, after the install or «Delete»
 * in «Settings»; never for the zones after them (the user's choice).
 */
export function usePhoneZones(
  position: PositionState,
  baseUrl: string | null,
  {
    engine = phoneEngine,
    download = downloadZone,
    ahead = downloadAhead,
    shapes = drawShapesAhead,
    places = keepPlaces,
  }: {
    engine?: PhoneEngine;
    download?: typeof downloadZone;
    ahead?: typeof downloadAhead;
    shapes?: (apiUrl: string, here: LatLon) => Promise<unknown>;
    places?: (
      apiUrl: string,
      options: { download: typeof downloadZone },
    ) => Promise<void>;
  } = {},
): number | null {
  const done = useRef(false);
  const [firstBytes, setFirstBytes] = useState<number | null>(null);

  useEffect(() => {
    if (done.current || baseUrl === null || position.status !== "ok") {
      return;
    }
    done.current = true;
    const point = position.point;
    const first = savedZones().length === 0;
    // The maps of both networks, told as one size as each starts.
    let told = 0;
    const onSize = (bytes: number) => {
      if (bytes >= NOTICE_MIN_BYTES) {
        told += bytes;
        setFirstBytes(told);
      }
    };
    void (async () => {
      let served = false;
      let answered = false;
      const networks = networksInOrder();
      // Python starts as soon as a zone is around the phone (TASK-287): one
      // saved before, while the zones are brought up to date; else the
      // first downloaded, without waiting for the other network's.
      let warm = false;
      const warmUp = () => {
        if (!warm) {
          warm = true;
          engine.warmUp();
        }
      };
      const saved = savedZones();
      if (networks.some((network) => coveringZone(saved, network, point) !== null)) {
        warmUp();
      }
      for (const network of networks) {
        const answer = await download(baseUrl, network, point, {
          ...(first ? { onSize } : {}),
          marginM: AROUND_MARGIN_M,
        });
        served ||= answer.kind === "saved" || answer.kind === "unchanged";
        answered ||= answer.kind !== "failed";
        // Offline at the opening: the zone saved before still counts.
        if (served || coveringZone(savedZones(), network, point) !== null) {
          warmUp();
        }
      }
      setFirstBytes(null);
      // The zone of the first route read ahead, of the sport's network
      // (part E); offline, the one saved before.
      const activity = ACTIVITIES[networks[0]];
      engine.prepare(zonesForEngine(savedZones(), networks[0], point), activity, point);
      // After the maps around the phone, not with them: the first route
      // of the user is not behind these. From a server that answers now,
      // with a zone or without: the shapes are routes it draws.
      if (answered) {
        void shapes(baseUrl, point);
        // The places the user keeps (TASK-334), before the zones ahead:
        // the user chose them.
        await places(baseUrl, { download });
      }
      // Only from a server that gives zones and answers now: else every
      // city ahead would be a request for nothing.
      if (served) {
        await ahead(baseUrl, point, networks[0], { download });
      }
    })();
  }, [position, baseUrl, engine, download, ahead, shapes, places]);

  return firstBytes;
}

/** The networks the phone draws on, that of the chosen sport first. */
export function networksInOrder(
  first: Network | undefined = NETWORKS[activityOf(loadSport())],
) {
  const all = [...new Set(Object.values(NETWORKS))];
  return first === undefined
    ? all
    : [first, ...all.filter((network) => network !== first)];
}
