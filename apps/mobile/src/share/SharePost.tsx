import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useActivitiesDoor } from "../activities/activitiesDoor";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { MusicRow } from "./MusicRow";
import { PostButton } from "./PostButton";
import { POST_RATIO, PostImage } from "./PostImage";
import {
  type PostResult,
  type PostRun,
  postCaption,
  postRequestOf,
  resultName,
  resultsOf,
} from "./postRun";
import { RunVideo } from "./RunVideo";
import { pictureProblem, sharePicture } from "./sharePicture";
import {
  addSticker,
  MAX_STICKERS,
  moveSticker,
  placedOf,
  POST_EMOJI,
  removeSticker,
  type Sticker,
  stickersOf,
} from "./stickers";
import { StravaPostRow } from "./StravaPostRow";
import { type VideoOutcome, videoProblem } from "./videoFile";
import { hearMusic, type Music } from "./videoMusic";
import { type VideoScene, videoScene } from "./videoScene";

/** The share of the screen's height the post takes: the choices fit under it. */
const POST_HEIGHT_SHARE = 0.5;

type Props = {
  run: PostRun;
  onClose: () => void;
};

/**
 * The post of a run, to make and share (TASK-231, ADR-0194): the picture
 * on top, then which results it shows, the emoji to lay on it, «Instagram»
 * (the share sheet, where Instagram has Story, Feed and Messages) and
 * Strava, where the emoji and the results go as the activity's text. Once
 * shared, the post goes to the API with its saved run (TASK-258), and
 * opens as it was the next time. «Export video» shares the same post as a
 * short video of the run drawing itself over the map of the run (TASK-295,
 * TASK-351), with the track chosen in «Music» (TASK-301).
 */
export function SharePost({ run, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const postWidth = Math.min(
    window.width - 2 * space.lg,
    (window.height * POST_HEIGHT_SHARE) / POST_RATIO,
  );
  const results = useMemo(() => resultsOf(run), [run]);
  const { keepPost } = useActivitiesDoor();
  const kept = run.post ?? null;
  // Every result the run has, on: the runner turns off what they keep. A
  // post shared before opens as it was (TASK-258).
  const [shown, setShown] = useState<PostResult[]>(() =>
    kept === null ? results : results.filter((r) => kept.results.includes(r)),
  );
  const [stickers, setStickers] = useState<Sticker[]>(() =>
    kept === null ? [] : stickersOf(kept.emoji),
  );
  const [sharing, setSharing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The video's music, none when the post opens (TASK-301).
  const [music, setMusic] = useState<Music | null>(null);
  // The video being made, with its music, and how much of it is (TASK-295);
  // the map under it, and the post on yellow for when the map does not
  // come (TASK-351).
  const [video, setVideo] = useState<{
    scene: VideoScene;
    fallback: VideoScene;
    music: Music | null;
  } | null>(null);
  const [made, setMade] = useState(0);
  const post = useRef<View>(null);
  const caption = postCaption(
    run,
    shown,
    stickers.map((s) => s.emoji),
  );

  function toggle(result: PostResult) {
    setShown((now) =>
      now.includes(result) ? now.filter((r) => r !== result) : [...now, result],
    );
  }

  /** The post as it is now, to the API with its run; nothing before «Save». */
  function keep() {
    if (run.key !== null) {
      keepPost(run.key, postRequestOf(run, shown, placedOf(stickers)));
    }
  }

  async function share() {
    setProblem(null);
    setSharing(true);
    const outcome = await sharePicture(post);
    setSharing(false);
    setProblem(pictureProblem(outcome));
    if (outcome === "shared") {
      keep();
    }
  }

  /** The post as it is now, as a video: made, then shared (TASK-295). */
  async function exportVideo() {
    setProblem(null);
    if (!(await Sharing.isAvailableAsync())) {
      setProblem(videoProblem("no_sharing"));
      return;
    }
    hearMusic(null);
    setMade(0);
    setVideo({
      scene: videoScene(run, shown, stickers, "night"),
      fallback: videoScene(run, shown, stickers, "paper"),
      music,
    });
  }

  function videoEnded(outcome: VideoOutcome) {
    setVideo(null);
    setProblem(videoProblem(outcome));
    if (outcome === "shared") {
      keep();
    }
  }

  const busy = sharing || video !== null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
            <Text style={styles.link}>{t("Close")}</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {t("Share your run")}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + space.xxl },
          ]}
        >
          <View style={styles.center}>
            <PostImage
              ref={post}
              run={run}
              shown={shown}
              stickers={stickers}
              width={postWidth}
              onMoveSticker={(id, x, y) =>
                setStickers((now) => moveSticker(now, id, x, y))
              }
              onRemoveSticker={(id) => setStickers((now) => removeSticker(now, id))}
            />
          </View>
          {stickers.length > 0 && (
            <Text style={styles.hint}>
              {t("Drag the emoji to move them. Tap one to take it off.")}
            </Text>
          )}

          {results.length > 0 && (
            <>
              <Text style={styles.label}>{t("Results")}</Text>
              <View style={styles.chips}>
                {results.map((result) => {
                  const on = shown.includes(result);
                  return (
                    <Pressable
                      key={result}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggle(result)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {resultName(result)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>{t("Add emoji")}</Text>
          <View style={styles.emojiRow}>
            {POST_EMOJI.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.emoji}
                onPress={() => setStickers((now) => addSticker(now, emoji))}
                accessibilityRole="button"
                accessibilityLabel={t("Add {emoji}", { emoji })}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          {stickers.length >= MAX_STICKERS && (
            <Text style={styles.hint}>
              {t("Up to {count} emoji: tap one on the post to take it off.", {
                count: MAX_STICKERS,
              })}
            </Text>
          )}

          <MusicRow music={music} onChange={setMusic} />

          <View style={styles.actions}>
            <View style={styles.buttons}>
              <PostButton
                text={sharing ? t("Making the picture…") : "Instagram"}
                onPress={() => void share()}
                busy={busy}
                main
              />
              <PostButton
                text={
                  video === null
                    ? t("Export video")
                    : t("Making the video… {percent}%", {
                        percent: Math.round(made * 100),
                      })
                }
                onPress={() => void exportVideo()}
                busy={busy}
              />
            </View>
            <Text style={styles.hint}>
              {t("Pick Instagram in the list: Story, Feed or Messages.")}
            </Text>
            {problem !== null && (
              <Text style={styles.problem} accessibilityRole="alert">
                {problem}
              </Text>
            )}
            <StravaPostRow runKey={run.key} caption={caption} onSent={keep} />
          </View>
        </ScrollView>
        {video !== null && (
          <RunVideo
            scene={video.scene}
            fallback={video.fallback}
            music={video.music}
            onProgress={setMade}
            onEnd={videoEnded}
          />
        )}
      </View>
    </Modal>
  );
}

type ButtonProps = {
  /** The run as the post shows it, made when the button is pressed. */
  makeRun: () => PostRun;
};

/** «Share» on a run's card (TASK-231): opens the post of the run. */
export function SharePostButton({ makeRun }: ButtonProps) {
  const [run, setRun] = useState<PostRun | null>(null);
  return (
    <>
      <Pressable
        style={styles.shareButton}
        onPress={() => setRun(makeRun())}
        accessibilityRole="button"
      >
        <Text style={styles.shareText}>{t("Share")}</Text>
      </Pressable>
      {run !== null && <SharePost run={run} onClose={() => setRun(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  header: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  close: {
    position: "absolute",
    left: space.lg,
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  link: {
    color: color.accent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  content: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  center: {
    alignItems: "center",
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  hint: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  chipOn: {
    borderColor: color.text,
    backgroundColor: color.surfaceRaised,
  },
  chipText: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  chipTextOn: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  emoji: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  emojiText: {
    fontSize: fontSize.title,
  },
  actions: {
    gap: space.sm,
    paddingTop: space.sm,
  },
  buttons: {
    flexDirection: "row",
    gap: space.sm,
  },
  shareButton: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  shareText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
