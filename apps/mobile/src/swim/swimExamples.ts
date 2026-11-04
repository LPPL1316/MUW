import { type ExampleSet, MORE_SHAPES } from "../explore/exampleRoutes";
import { SWIMMING_START_KM } from "../route/distance";

/**
 * The examples of «Explore» with «Open water swim» (TASK-323 C4): the lakes
 * and the beaches of the paddle (waterSpots.ts), the shapes of the run, a
 * swim of SWIMMING_START_KM from each place's point, the laps the engine
 * chooses. None come with the app: the API draws them, and keeps them
 * (`draw_examples --swim` on the server draws them all once). Kept apart
 * from the paddle's of the same point by their `prefix`.
 */
export const SWIM_EXAMPLES: ExampleSet = {
  activity: "swimming",
  distance_m: SWIMMING_START_KM * 1000,
  more: MORE_SHAPES,
  prefix: "swimming:",
};
