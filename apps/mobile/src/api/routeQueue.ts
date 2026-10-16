import type { RouteOutcome } from "./routes";

/**
 * The one queue of the app's route requests (TASK-287, ADR-0248). The
 * user's go at once, always: «Draw», moving an example's shape, a themed
 * route. The others wait for their turn: the examples on the page of
 * «Explore» first (a chosen city's, the towns near), then what is drawn
 * ahead of it (the shapes on the water of the places near). None starts
 * while a request of the user is running, and together they never use
 * more of a minute than their share: the API takes 30 POSTs a minute from
 * a phone (ADR-0076), and the rest is the user's.
 */

/** A request nobody is waiting for, by how soon it is wanted. */
export type BackgroundPriority = "visible" | "prefetch";

const ORDER: readonly BackgroundPriority[] = ["visible", "prefetch"];

/**
 * The route requests of the last minute, the user's counted, below which a
 * request in the background may start: «Draw», «Start» and «Export GPX»
 * keep the last eight of the API's 30. What is drawn ahead stops at ten, so
 * the page of «Explore» always has room.
 */
export const BACKGROUND_SHARE: Readonly<Record<BackgroundPriority, number>> = {
  visible: 22,
  prefetch: 10,
};
export const MINUTE_MS = 60_000;

type Waiter = {
  priority: BackgroundPriority;
  /** true: its turn; false: it is not wanted any more. */
  settle: (turn: boolean) => void;
};

export class RouteQueue {
  private readonly now: () => number;
  // When each route request of the last minute went, the oldest first.
  private sent: number[] = [];
  private users = 0;
  private heldUntil = 0;
  private waiting: Waiter[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  // A new one after `forget`: what ends from before changes nothing.
  private generation = 0;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  /**
   * A request of the user: it goes at once, and those in the background
   * wait until it ends. Counted as a request to the API, whether or not
   * the phone draws it.
   */
  async user<T>(run: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    this.users += 1;
    this.sent.push(this.now());
    try {
      const outcome = await run();
      if (isOutcome(outcome)) {
        this.observe(outcome);
      }
      return outcome;
    } finally {
      if (generation === this.generation) {
        this.users -= 1;
        this.wake();
      }
    }
  }

  /**
   * A request in the background, in its turn: `run` starts once nothing
   * of the user is running and the minute has room for `priority`, and
   * `onTurn` is told just before. When its turn is now, both happen before
   * this returns: nothing waits for a tick. "cancelled" when `signal`
   * aborts first, and `run` never starts.
   */
  background(
    priority: BackgroundPriority,
    run: () => Promise<RouteOutcome>,
    { signal, onTurn }: { signal?: AbortSignal; onTurn?: () => void } = {},
  ): Promise<RouteOutcome> {
    const start = () => {
      onTurn?.();
      return run().then((outcome) => {
        this.observe(outcome);
        return outcome;
      });
    };
    if (signal?.aborted) {
      return Promise.resolve({ kind: "cancelled" });
    }
    if (this.mayGo(priority)) {
      this.count();
      return start();
    }
    return new Promise<boolean>((resolve) => {
      const waiter: Waiter = {
        priority,
        settle: (turn) => {
          signal?.removeEventListener("abort", drop);
          resolve(turn);
        },
      };
      const drop = () => {
        this.waiting = this.waiting.filter((w) => w !== waiter);
        resolve(false);
        this.wake();
      };
      signal?.addEventListener("abort", drop, { once: true });
      this.waiting.push(waiter);
      this.wake();
    }).then((turn) => (turn ? start() : { kind: "cancelled" }));
  }

  /** After a 429 nothing in the background for a minute: the API's
   * minute is full, whoever filled it. */
  observe(outcome: RouteOutcome): void {
    if (outcome.kind === "api_error" && outcome.code === "too_many_requests") {
      this.heldUntil = this.now() + MINUTE_MS;
      this.wake();
    }
  }

  /** For tests: an empty minute, nothing running, nobody waiting. */
  forget(): void {
    this.generation += 1;
    this.sent = [];
    this.users = 0;
    this.heldUntil = 0;
    this.clearTimer();
    const waiting = this.waiting;
    this.waiting = [];
    waiting.forEach((waiter) => waiter.settle(false));
  }

  private recent(): number {
    const now = this.now();
    while (this.sent.length > 0 && this.sent[0] <= now - MINUTE_MS) {
      this.sent.shift();
    }
    return this.sent.length;
  }

  /** Whether one of `priority` may start now, the others waiting aside. */
  private allowed(priority: BackgroundPriority): boolean {
    return (
      this.users === 0 &&
      this.now() >= this.heldUntil &&
      this.recent() < BACKGROUND_SHARE[priority]
    );
  }

  /** As `allowed`, and nobody as urgent waits before it. */
  private mayGo(priority: BackgroundPriority): boolean {
    const rank = ORDER.indexOf(priority);
    return (
      this.allowed(priority) &&
      !this.waiting.some((w) => ORDER.indexOf(w.priority) <= rank)
    );
  }

  private count(): void {
    this.sent.push(this.now());
  }

  /** Lets go whoever may, the most urgent first; the rest wait for the
   * user to end, or for the minute to make room. */
  private wake(): void {
    this.clearTimer();
    const queue = [...this.waiting].sort(
      (a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority),
    );
    for (const waiter of queue) {
      if (!this.allowed(waiter.priority)) {
        break;
      }
      this.waiting = this.waiting.filter((w) => w !== waiter);
      this.count();
      waiter.settle(true);
    }
    const first = this.waiting.reduce<Waiter | null>(
      (best, w) =>
        best === null || ORDER.indexOf(w.priority) < ORDER.indexOf(best.priority)
          ? w
          : best,
      null,
    );
    if (first === null || this.users > 0) {
      return;
    }
    const share = BACKGROUND_SHARE[first.priority];
    const room =
      this.sent.length < share ? 0 : this.sent[this.sent.length - share] + MINUTE_MS;
    const at = Math.max(room, this.heldUntil);
    this.timer = setTimeout(() => this.wake(), Math.max(at - this.now(), 0));
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** A route request's end, as requestRoute tells it. */
function isOutcome(value: unknown): value is RouteOutcome {
  return typeof value === "object" && value !== null && "kind" in value;
}

/** The app's one queue. */
export const routeQueue = new RouteQueue();
