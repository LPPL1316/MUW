/**
 * The stretching figure's poses (TASK-285 part B, ADR-0247): a person seen
 * from the side, made of twelve straight segments hanging one from the
 * other, hip first. A pose gives each segment the direction it points in,
 * in degrees: 0 is down, 90 is forward (the figure faces right), 180 is up,
 * -90 is back. Nothing here knows about React Native: `Figure.tsx` draws a
 * pose, and the tests check that each pose stands on its feet.
 */

export const SEGMENTS = [
  "torso",
  "head",
  "upperArmFar",
  "forearmFar",
  "upperArmNear",
  "forearmNear",
  "thighFar",
  "shinFar",
  "footFar",
  "thighNear",
  "shinNear",
  "footNear",
] as const;

export type Segment = (typeof SEGMENTS)[number];

/** Where each segment points, in degrees: 0 down, 90 forward, 180 up. */
export type Pose = Readonly<Record<Segment, number>>;

/** Each segment's length, as a share of the figure's height. */
export const LENGTH: Readonly<Record<Segment, number>> = {
  torso: 0.3,
  head: 0.13,
  upperArmFar: 0.16,
  forearmFar: 0.15,
  upperArmNear: 0.16,
  forearmNear: 0.15,
  thighFar: 0.24,
  shinFar: 0.23,
  footFar: 0.07,
  thighNear: 0.24,
  shinNear: 0.23,
  footNear: 0.07,
};

/** The segment each one hangs from; `null` hangs from the hip. */
export const PARENT: Readonly<Record<Segment, Segment | null>> = {
  torso: null,
  head: "torso",
  upperArmFar: "torso",
  forearmFar: "upperArmFar",
  upperArmNear: "torso",
  forearmNear: "upperArmNear",
  thighFar: null,
  shinFar: "thighFar",
  footFar: "shinFar",
  thighNear: null,
  shinNear: "thighNear",
  footNear: "shinNear",
};

/** A point in the figure's frame: the hip at (0, 0), y down, in shares of
 * the figure's height. */
export type Point = { x: number; y: number };

/** Where a segment starts and ends. */
export type Bone = { from: Point; to: Point };

function step(from: Point, degrees: number, length: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: from.x + Math.sin(radians) * length,
    y: from.y + Math.cos(radians) * length,
  };
}

/** Every segment's start and end in `pose`, hip at the origin. */
export function bones(pose: Pose): Readonly<Record<Segment, Bone>> {
  const out: Partial<Record<Segment, Bone>> = {};
  for (const segment of SEGMENTS) {
    const parent = PARENT[segment];
    // A segment hangs from the end of its parent; the hip is the root.
    const from = parent === null ? { x: 0, y: 0 } : (out[parent] as Bone).to;
    out[segment] = { from, to: step(from, pose[segment], LENGTH[segment]) };
  }
  return out as Readonly<Record<Segment, Bone>>;
}

/**
 * How far the lowest point of the figure is below the hip, in shares of the
 * height: where the floor is. Standing, the feet; kneeling, the knee.
 */
export function grounding(pose: Pose): number {
  let lowest = 0;
  for (const bone of Object.values(bones(pose))) {
    lowest = Math.max(lowest, bone.from.y, bone.to.y);
  }
  return lowest;
}

/** How wide the figure is in `pose`, back to front, in shares of the height. */
export function span(pose: Pose): { back: number; front: number } {
  let back = 0;
  let front = 0;
  for (const bone of Object.values(bones(pose))) {
    back = Math.min(back, bone.from.x, bone.to.x);
    front = Math.max(front, bone.from.x, bone.to.x);
  }
  return { back, front };
}

/** Standing, arms by the sides, feet forward: where every exercise starts. */
export const STAND: Pose = {
  torso: 180,
  head: 180,
  upperArmFar: 0,
  forearmFar: 0,
  upperArmNear: 0,
  forearmNear: 0,
  thighFar: 0,
  shinFar: 0,
  footFar: 90,
  thighNear: 0,
  shinNear: 0,
  footNear: 90,
};

/** Standing on the far leg, the near heel pulled up to the glutes, the near
 * hand holding the ankle, the far hand forward as if on a wall. */
export const QUAD: Pose = {
  ...STAND,
  thighNear: -8,
  shinNear: -160,
  footNear: -105,
  upperArmNear: -35,
  forearmNear: -30,
  upperArmFar: 110,
  forearmFar: 95,
};

/** The near heel forward on the floor, toes up, the far knee soft, the back
 * straight and leaning from the hips, hands toward the thigh. */
export const HAMSTRING: Pose = {
  torso: 140,
  head: 150,
  upperArmFar: 60,
  forearmFar: 40,
  upperArmNear: 60,
  forearmNear: 40,
  thighFar: 12,
  shinFar: -8,
  footFar: 85,
  thighNear: 45,
  shinNear: 42,
  footNear: 150,
};

/** A long step back, the far heel down, the near knee bent, both hands
 * forward on a wall. */
export const CALF: Pose = {
  torso: 160,
  head: 165,
  upperArmFar: 100,
  forearmFar: 88,
  upperArmNear: 100,
  forearmNear: 88,
  thighFar: -38,
  shinFar: -32,
  footFar: 95,
  thighNear: 62,
  shinNear: -2,
  footNear: 90,
};

/** Kneeling on the far knee, the shin flat on the floor, the near foot
 * forward, the hips pushed forward, hands on the near knee. */
export const HIP_FLEXOR: Pose = {
  torso: 178,
  head: 180,
  upperArmFar: 45,
  forearmFar: 70,
  upperArmNear: 45,
  forearmNear: 70,
  thighFar: -12,
  shinFar: -90,
  footFar: -90,
  thighNear: 85,
  shinNear: 5,
  footNear: 90,
};

/** Standing on the far leg, sat back as into a chair, the near ankle laid
 * across the far knee, hands resting on the near shin. */
export const GLUTE: Pose = {
  torso: 158,
  head: 165,
  upperArmFar: 30,
  forearmFar: 75,
  upperArmNear: 30,
  forearmNear: 75,
  thighFar: 22,
  shinFar: -16,
  footFar: 88,
  thighNear: 82,
  shinNear: -100,
  footNear: -70,
};
