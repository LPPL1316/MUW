/**
 * Plane geometry for the figures of «Draw on the map» (TASK-281): lines as
 * lists of [x, y], in metres or in units of a figure, never in degrees.
 */
export type P = [x: number, y: number];

export function dist(a: P, b: P): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** The length of a line, through its points in order. */
export function lineLength(line: readonly P[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) {
    total += dist(line[i - 1], line[i]);
  }
  return total;
}

/** The larger side of the box around `lines`, and the box's middle. */
export function boxOf(lines: readonly (readonly P[])[]): { size: number; middle: P } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    for (const [x, y] of line) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    size: Math.max(maxX - minX, maxY - minY),
    middle: [(minX + maxX) / 2, (minY + maxY) / 2],
  };
}

/** The point of the segment a-b nearest to p. */
export function nearestOnSegment(p: P, a: P, b: P): P {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const squared = dx * dx + dy * dy;
  if (squared === 0) {
    return a;
  }
  const t = Math.min(
    1,
    Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / squared),
  );
  return [a[0] + t * dx, a[1] + t * dy];
}

/**
 * Douglas–Peucker: the fewest points of `line` that keep it within
 * `tolerance` of where it was. The first and last points stay.
 */
export function simplify(line: readonly P[], tolerance: number): P[] {
  if (line.length <= 2) {
    return [...line];
  }
  const keep = new Array<boolean>(line.length).fill(false);
  keep[0] = true;
  keep[line.length - 1] = true;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let farthest = -1;
    let away = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const d = dist(line[i], nearestOnSegment(line[i], line[first], line[last]));
      if (d > away) {
        away = d;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

function cross(o: P, a: P, b: P): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Where the segments a-b and c-d cross, or null. Touching at an end counts
 * when `ends` is true; segments that lie on one line overlap, and count as
 * crossing at the start of the overlap.
 */
export function crossing(a: P, b: P, c: P, d: P, ends = true): P | null {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  const strictly =
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  if (strictly) {
    const t = d1 / (d1 - d2);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }
  if (!ends) {
    return null;
  }
  const on = (p: P, q: P, r: P) =>
    Math.min(p[0], q[0]) <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) &&
    Math.min(p[1], q[1]) <= r[1] &&
    r[1] <= Math.max(p[1], q[1]);
  if (d1 === 0 && on(c, d, a)) return a;
  if (d2 === 0 && on(c, d, b)) return b;
  if (d3 === 0 && on(a, b, c)) return c;
  if (d4 === 0 && on(a, b, d)) return d;
  return null;
}

/**
 * Whether the closed line `ring` (its last point repeats the first) never
 * crosses nor touches itself: what the engine asks of an outline
 * (`parse_outline`). Sides next to each other share only their corner.
 */
export function isSimpleRing(ring: readonly P[]): boolean {
  const sides = ring.length - 1;
  if (sides < 3) {
    return false;
  }
  for (let i = 0; i < sides; i += 1) {
    if (dist(ring[i], ring[i + 1]) === 0) {
      return false;
    }
    for (let j = i + 1; j < sides; j += 1) {
      // Sides next to each other: through their corner `o`, from `p` to `q`.
      const corner =
        j === i + 1
          ? [ring[i + 1], ring[i], ring[j + 1]]
          : i === 0 && j === sides - 1
            ? [ring[0], ring[1], ring[j]]
            : null;
      if (corner === null) {
        if (crossing(ring[i], ring[i + 1], ring[j], ring[j + 1]) !== null) {
          return false;
        }
      } else if (folded(corner[0], corner[1], corner[2])) {
        return false;
      }
    }
  }
  return true;
}

/** Two sides out of corner `o`, to `p` and to `q`, going back along each
 * other. */
function folded(o: P, p: P, q: P): boolean {
  return (
    cross(o, p, q) === 0 &&
    (p[0] - o[0]) * (q[0] - o[0]) + (p[1] - o[1]) * (q[1] - o[1]) > 0
  );
}

/** The area inside a closed line, positive counterclockwise. */
export function signedArea(ring: readonly P[]): number {
  let twice = 0;
  for (let i = 1; i < ring.length; i += 1) {
    twice += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  }
  return twice / 2;
}
