import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from "react-native";

import type { AnyRouteRequest } from "../api/routes";
import { phoneFirst } from "../engine/onPhone";
import { cityName } from "../explore/recommendedRoutes";
import { RouteThumb } from "../explore/RouteThumb";
import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { t } from "../i18n";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { GuessShape } from "./GuessShape";
import {
  LIGHT_TICK_MS,
  PEN_MS,
  PEN_TICK_MS,
  PenDrawing,
  penShare,
  usePenClock,
} from "./PenDrawing";
import type { WaitingPhase } from "./progress";
import { drawnLines, LINE_MS, lineAt, shuffled } from "./waitingLines";

/** How long the wait goes on before the card comes (TASK-317). */
export const CARD_AFTER_MS = 3000;
/** A drawing traced by the pen stays this long before the next. */
export const PEN_HOLD_MS = 2000;
/** The row of drawings moves on by one this often. */
export const ROW_STEP_MS = 2500;

/** What the card shows, one drawn at random for each wait. */
export type WaitingKind = "pen" | "drawings" | "game";
export const KINDS: readonly WaitingKind[] = ["pen", "drawings", "game"];

const PEN_SIZE = 120;
const THUMB_SIZE = 96;

/**
 * The drawings of «Feed» the card shows: those drawn north up and in one
 * piece, as a thumbnail draws them.
 */
export const WAITING_POSTS: readonly SamplePost[] = SAMPLE_FEED.filter(
  (post) => !post.rotation_deg && !post.gaps?.length && post.line.length >= 2,
);

/** One of the three, from a number in [0, 1). */
export function pickKind(random: () => number): WaitingKind {
  return KINDS[Math.min(KINDS.length - 1, Math.floor(random() * KINDS.length))];
}

type LineProps = {
  /** The phase's own line, or null for one that has none. */
  own: string | null;
  /** The word asked for, for its own line. */
  word: string | null;
  phase: WaitingPhase;
  style?: StyleProp<TextStyle>;
  random?: () => number;
};

/**
 * The line of the wait (TASK-317): a new one every LINE_MS, the phase's own
 * first and again at every third, the others drawn once for this wait.
 */
export function WaitingLine({
  own,
  word,
  phase,
  style,
  random = Math.random,
}: LineProps) {
  const [drawn] = useState(() => drawnLines(word, random));
  const [at, setAt] = useState({ phase, slot: 0 });
  if (at.phase !== phase) {
    setAt({ phase, slot: 0 });
  }
  useEffect(() => {
    const id = setInterval(
      () => setAt((now) => ({ ...now, slot: now.slot + 1 })),
      LINE_MS,
    );
    return () => clearInterval(id);
  }, []);
  const slot = at.phase === phase ? at.slot : 0;
  return (
    <Text style={style} numberOfLines={2} testID="waiting-line">
      {lineAt(own, drawn, slot)}
    </Text>
  );
}

/** The user, the city and the distance of a drawing. */
function WhoLine({ post }: { post: SamplePost }) {
  const units = useUnits();
  return (
    <Text style={styles.who} numberOfLines={1}>
      {`${post.user} · ${cityName(post.city)} · ${distanceLabel(post.route_m, units)}`}
    </Text>
  );
}

/** The pen tracing one drawing after the other, as a time-lapse. */
function PenShow({ posts, tickMs }: { posts: readonly SamplePost[]; tickMs: number }) {
  // One clock for the whole show: each drawing has its turn, traced and held.
  const total = usePenClock("show", true, tickMs);
  const turn = PEN_MS + PEN_HOLD_MS;
  const post = posts[Math.floor(total / turn) % posts.length];
  const ms = total % turn;
  return (
    <View style={styles.section} testID="waiting-pen">
      <Text style={styles.label}>{t("MEANWHILE, FROM THE FEED")}</Text>
      <View style={styles.penRow}>
        <PenDrawing line={post.line} size={PEN_SIZE} share={penShare(ms)} />
        <View style={styles.caption}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          <WhoLine post={post} />
        </View>
      </View>
    </View>
  );
}

/**
 * The drawings of «Feed» in a row that moves on by itself until touched.
 * The row scrolls natively: moving on draws nothing again.
 */
function DrawingsRow({ posts }: { posts: readonly SamplePost[] }) {
  const scroll = useRef<ScrollView>(null);
  const held = useRef(false);
  const at = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (held.current) {
        return;
      }
      at.current = (at.current + 1) % posts.length;
      scroll.current?.scrollTo?.({
        x: at.current * (THUMB_SIZE + space.sm),
        animated: true,
      });
    }, ROW_STEP_MS);
    return () => clearInterval(id);
  }, [posts.length]);
  return (
    <View style={styles.section} testID="waiting-drawings">
      <Text style={styles.label}>{t("MEANWHILE, FROM THE FEED")}</Text>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          held.current = true;
        }}
        contentContainerStyle={styles.drawings}
      >
        {posts.map((post) => (
          <View key={post.id} style={styles.drawing}>
            <RouteThumb line={post.line} width={THUMB_SIZE} height={THUMB_SIZE} />
            <Text style={styles.thumbTitle} numberOfLines={1}>
              {post.title}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type CardProps = {
  /** The route being drawn: the engine may draw it on the phone. */
  request: AnyRouteRequest;
  /** When the wait began, as `Date.now()`. */
  startedAt: number;
  random?: () => number;
};

/**
 * Something to do while the route is drawn (TASK-317), from CARD_AFTER_MS
 * into the wait: the pen tracing drawings of «Feed», those drawings in a
 * row, or «Guess the shape», one of the three at random. It goes with the
 * wait: the route, when it comes, takes its place. The drawings are those
 * already in the app: the card asks nothing of the network. While the
 * engine may be drawing on the phone the pen moves on less often.
 */
export function WaitingCard({ request, startedAt, random = Math.random }: CardProps) {
  const tickMs = phoneFirst(request) ? LIGHT_TICK_MS : PEN_TICK_MS;
  const [kind] = useState(() => pickKind(random));
  const [posts] = useState(() => shuffled(WAITING_POSTS, random));
  const [shown, setShown] = useState(() => Date.now() - startedAt >= CARD_AFTER_MS);
  useEffect(() => {
    if (shown) {
      return;
    }
    const id = setTimeout(
      () => setShown(true),
      Math.max(0, CARD_AFTER_MS - (Date.now() - startedAt)),
    );
    return () => clearTimeout(id);
  }, [shown, startedAt]);
  if (!shown || posts.length === 0) {
    return null;
  }
  switch (kind) {
    case "pen":
      return <PenShow posts={posts} tickMs={tickMs} />;
    case "drawings":
      return <DrawingsRow posts={posts} />;
    case "game":
      return <GuessShape posts={posts} tickMs={tickMs} random={random} />;
  }
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  penRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  caption: {
    flex: 1,
    gap: space.xs,
  },
  title: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  who: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  drawings: {
    gap: space.sm,
  },
  drawing: {
    width: THUMB_SIZE,
    gap: space.xs,
  },
  thumbTitle: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
});
