import { loadSession } from "../account/sessionStore";
import { appBody, type BodyProfile, NO_BODY } from "../body/bodyProfile";
import { activeKcal } from "../body/energy";
import { isOnSnow, isTrackless } from "../activities/snow";
import type { SamplePost } from "./sampleFeed";

/**
 * "355 kcal": about how much energy the activity of a post took (TASK-345,
 * ADR-0298), with each sport's own formula (TASK-374, ADR-0318). The body
 * stays on the phone: one's own posts are counted with it, everyone else's
 * as a body with no data (70 kg). An activity with no metres has none, and
 * neither has a ride or a paddle with no time.
 */
export function postEnergy(
  post: SamplePost,
  body: BodyProfile = bodyFor(post),
  year: number = new Date().getFullYear(),
): string | null {
  // A day on the snow has no estimate yet (TASK-375 part C), nor a workout
  // at the gym (TASK-385 part C).
  const activity =
    isOnSnow(post.activity) || isTrackless(post.activity)
      ? null
      : (post.activity ?? "running");
  if (activity === null) {
    return null;
  }
  const energy = activeKcal(
    {
      activity,
      metres: post.route_m,
      seconds: post.minutes > 0 ? post.minutes * 60 : null,
      climbM: null,
    },
    body,
    year,
  );
  return energy > 0 ? `${energy} kcal` : null;
}

/** The phone's body for a post of whoever is signed in; none for another's. */
function bodyFor(post: SamplePost): BodyProfile {
  return loadSession()?.user.username === post.user ? appBody() : NO_BODY;
}
