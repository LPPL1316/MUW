/**
 * The sports of the contract (TASK-376, ADR-0320), in its order: those the
 * route engine plans, then those recorded without a shape, then those saved
 * without a track (TASK-385). A new sport is a file of this folder and a
 * line here; index.ts derives its tables.
 */
import { CYCLING } from "./cycling.ts";
import { GYM } from "./gym.ts";
import { PADDLING } from "./paddling.ts";
import { RUNNING } from "./running.ts";
import { SKIING } from "./skiing.ts";
import { SWIMMING } from "./swimming.ts";
import { WALKING } from "./walking.ts";
import { XC_SKIING } from "./xc_skiing.ts";

export {
  activitiesOf,
  type PlannedSport,
  type RecordedSport,
  type TracklessSport,
} from "./base.ts";
export { CYCLING, GYM, PADDLING, RUNNING, SKIING, SWIMMING, WALKING, XC_SKIING };

export const PLANNED_SPORTS = [RUNNING, CYCLING, PADDLING, SWIMMING, WALKING] as const;
export const RECORDED_SPORTS = [SKIING, XC_SKIING] as const;
export const TRACKLESS_SPORTS = [GYM] as const;
