import type { LatLon } from "@shaperoute/shared-types";
import { useMemo, useRef, useState } from "react";
import {
  type AccessibilityActionEvent,
  Animated,
  Image,
  type ImageSourcePropType,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { t } from "../../i18n";
import { OpenSettings } from "../../permissions/OpenSettings";
import type { ImageSource } from "../../route/pickImage";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../../theme/tokens";
import { ComposedPhoto } from "./ComposedPhoto";
import { type Flattened, flattenPhoto } from "./flattenPhoto";
import {
  COMPOSED_RATIO,
  layoutName,
  POST_LAYOUTS,
  type PostLayout,
} from "./layoutFrame";
import { type PickedPhotos, pickPhotos } from "./pickPhotos";
import { dropIndex, moved, type PostItem } from "./postOrder";

/** At most 10 pages in a post, the map among them (the user's choice, «10
 * col disegno»): 9 photos and the drawing. */
export const POST_MAX_ITEMS = 10;

/** The side of a tile in the row. */
export const TILE = 72;
const STEP = TILE + space.sm;
/** The width a picture is drawn at to be made (COMPOSED_WIDTH px). */
const MADE_WIDTH = 288;

/** A photo of the post, as the composer shows it. */
export type ComposerPhoto = {
  n: number;
  /** What the tile shows: the photo as it will be published. */
  source: ImageSourcePropType;
  /** The layout it carries; null: as taken. */
  layout: PostLayout | null;
  /** The photo as taken, while a layout can still be chosen for it; null
   * once it was made with one (it is changed by removing it and adding it
   * again, the user's choice «Sì, appiattire»). */
  original: ImageSourcePropType | null;
};

export type PickMany = (source: ImageSource, limit: number) => Promise<PickedPhotos>;

type Props = {
  items: readonly PostItem[];
  photos: readonly ComposerPhoto[];
  onOrder: (items: PostItem[]) => void;
  /** Photos chosen and shrunk, JPEG in base64, in the order tapped. */
  onAdd: (photos: string[]) => void;
  onRemove: (n: number) => void;
  /** The run's line: with it, a photo can carry its drawing. */
  track?: readonly LatLon[] | null;
  rotationDeg?: number | null;
  /** A layout chosen (or taken off) for the photo `n`, the picture made. */
  onLayout?: (n: number, layout: PostLayout | null, made: Flattened | null) => void;
  disabled?: boolean;
  pick?: PickMany;
  /** The fake of the tests. */
  flatten?: typeof flattenPhoto;
};

/**
 * The pages of a post (TASK-348, ADR-0301): the map and up to 9 photos in
 * a row, in the post's order. Held, a tile follows the finger and drops
 * where it is let go; VoiceOver moves it with «Move left» and «Move
 * right». A photo tapped shows the four layouts that put the drawing in
 * it; the picture is made at once (view-shot), so «Save» sends it as any
 * photo.
 */
export function PostComposer({
  items,
  photos,
  onOrder,
  onAdd,
  onRemove,
  track,
  rotationDeg,
  onLayout,
  disabled,
  pick = pickPhotos,
  flatten = flattenPhoto,
}: Props) {
  const [choosing, setChoosing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [making, setMaking] = useState<{ n: number; layout: PostLayout } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [shift] = useState(() => new Animated.Value(0));
  const made = useRef<View>(null);

  // Held, a tile takes the finger from the row until it is let go.
  const responder = useMemo(() => {
    const drop = (dx: number) => {
      setDragging(null);
      shift.setValue(0);
      if (dragging === null) {
        return;
      }
      const to = dropIndex(dragging, dx, STEP, items.length);
      if (to !== dragging) {
        onOrder(moved(items, dragging, to));
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => dragging !== null,
      onMoveShouldSetPanResponderCapture: () => dragging !== null,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => shift.setValue(gesture.dx),
      onPanResponderRelease: (_, gesture) => drop(gesture.dx),
      onPanResponderTerminate: () => drop(0),
    });
  }, [dragging, items, onOrder, shift]);

  function moveBy(from: number, by: number) {
    const to = from + by;
    if (to >= 0 && to < items.length) {
      onOrder(moved(items, from, to));
    }
  }

  const room = POST_MAX_ITEMS - items.length;
  const busy = disabled === true || picking || making !== null;

  async function choose(source: ImageSource) {
    setChoosing(false);
    setPicking(true);
    setProblem(null);
    setDenied(false);
    const picked = await pick(source, room);
    setPicking(false);
    switch (picked.kind) {
      case "picked":
        onAdd(picked.photos.map((photo) => photo.base64));
        if (picked.tooLarge) {
          setProblem(t("This picture is too large. Choose a smaller one."));
        }
        return;
      case "cancelled":
        return;
      case "denied":
        setDenied(true);
        setProblem(
          t(
            "The camera is off for this app. Allow it in Settings, or choose a picture instead.",
          ),
        );
        return;
      case "too_large":
        setProblem(t("This picture is too large. Choose a smaller one."));
        return;
      case "pick_failed":
        setProblem(t("Could not open the picture. Try again."));
    }
  }

  function chooseLayout(photo: ComposerPhoto, layout: PostLayout) {
    setProblem(null);
    if (photo.layout === layout) {
      // Tapped again: the photo as taken.
      onLayout?.(photo.n, null, null);
      return;
    }
    setMaking({ n: photo.n, layout });
  }

  async function makePicture() {
    const now = making;
    if (now === null) {
      return;
    }
    const picture = await flatten(made);
    setMaking(null);
    if (picture === null) {
      setProblem(t("Could not prepare this photo. Try again."));
      return;
    }
    onLayout?.(now.n, now.layout, picture);
  }

  const chosen = photos.find((photo) => photo.n === selected) ?? null;
  const canLayout =
    onLayout !== undefined && track !== null && track !== undefined && track.length > 1;
  const makingFrom =
    making === null ? null : (photos.find((p) => p.n === making.n)?.original ?? null);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t("Your post")}</Text>
      <View style={styles.row} {...responder.panHandlers} testID="post-composer">
        {items.map((item, i) => {
          const photo =
            item.kind === "photo" ? photos.find((p) => p.n === item.n) : undefined;
          // Photos are counted among the photos, as the post shows them.
          const number = String(
            items.slice(0, i + 1).filter((other) => other.kind === "photo").length,
          );
          const label =
            item.kind === "drawing" ? t("Drawing") : t("Photo {n}", { n: number });
          return (
            <Animated.View
              key={item.kind === "drawing" ? "drawing" : `photo-${item.n}`}
              style={[
                styles.tile,
                dragging === i && styles.lifted,
                dragging === i && { transform: [{ translateX: shift }] },
              ]}
            >
              <Pressable
                onLongPress={() => {
                  if (!busy) {
                    setDragging(i);
                  }
                }}
                onPress={() =>
                  photo !== undefined &&
                  setSelected((was) => (was === photo.n ? null : photo.n))
                }
                delayLongPress={250}
                disabled={busy}
                accessibilityRole={photo === undefined ? undefined : "button"}
                accessibilityLabel={label}
                accessibilityHint={t("Hold and drag to reorder")}
                accessibilityState={{
                  selected: photo !== undefined && selected === photo.n,
                }}
                accessibilityActions={[
                  { name: "moveLeft", label: t("Move left") },
                  { name: "moveRight", label: t("Move right") },
                ]}
                onAccessibilityAction={(event: AccessibilityActionEvent) =>
                  moveBy(i, event.nativeEvent.actionName === "moveLeft" ? -1 : 1)
                }
                testID={
                  item.kind === "drawing" ? "tile-drawing" : `tile-photo-${item.n}`
                }
              >
                {photo === undefined ? (
                  <View style={[styles.thumb, styles.drawingTile]}>
                    <Text style={styles.drawingText}>{t("Drawing")}</Text>
                  </View>
                ) : (
                  <Image
                    source={photo.source}
                    style={[styles.thumb, selected === photo.n && styles.thumbOn]}
                  />
                )}
              </Pressable>
              {photo !== undefined && (
                <Pressable
                  style={styles.remove}
                  onPress={() => {
                    if (selected === photo.n) {
                      setSelected(null);
                    }
                    onRemove(photo.n);
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t("Remove photo {n}", { n: number })}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              )}
            </Animated.View>
          );
        })}
        {room > 0 && !choosing && (
          <Pressable
            style={[styles.add, busy && styles.busy]}
            onPress={() => setChoosing(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy: picking }}
          >
            <Text style={styles.chipText}>
              {picking ? t("Opening…") : t("Add photo")}
            </Text>
          </Pressable>
        )}
      </View>
      {items.length > 1 && (
        <Text style={styles.line}>{t("Hold and drag to reorder")}</Text>
      )}
      {room <= 0 && <Text style={styles.line}>{t("Up to 10 in a post.")}</Text>}
      {choosing && (
        <View style={styles.chips}>
          <Pressable
            style={styles.chip}
            onPress={() => void choose("library")}
            accessibilityRole="button"
          >
            <Text style={styles.chipText}>{t("Choose a picture")}</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            onPress={() => void choose("camera")}
            accessibilityRole="button"
          >
            <Text style={styles.chipText}>{t("Take a photo")}</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            onPress={() => setChoosing(false)}
            accessibilityRole="button"
          >
            <Text style={styles.chipText}>{t("Cancel")}</Text>
          </Pressable>
        </View>
      )}
      {canLayout && chosen !== null && chosen.original !== null && (
        <View style={styles.field}>
          <Text style={styles.label}>{t("Layout")}</Text>
          <View style={styles.chips}>
            {POST_LAYOUTS.map((layout) => {
              const on = chosen.layout === layout;
              return (
                <Pressable
                  key={layout}
                  style={[styles.chip, on && styles.chipOn, busy && styles.busy]}
                  onPress={() => chooseLayout(chosen, layout)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, busy: making?.layout === layout }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {layoutName(layout)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {problem !== null && (
        <>
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
          {denied && <OpenSettings />}
        </>
      )}
      {making !== null &&
        makingFrom !== null &&
        track !== null &&
        track !== undefined && (
          // Drawn out of sight, at the size of the picture to make.
          <View style={styles.offscreen} pointerEvents="none">
            <ComposedPhoto
              ref={made}
              source={makingFrom}
              layout={making.layout}
              track={track}
              rotationDeg={rotationDeg}
              width={MADE_WIDTH}
              onLoad={() => void makePicture()}
              onError={() => {
                setMaking(null);
                setProblem(t("Could not prepare this photo. Try again."));
              }}
            />
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
  },
  tile: {
    width: TILE,
    height: TILE,
  },
  lifted: {
    zIndex: 1,
    opacity: 0.85,
  },
  thumb: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
  },
  thumbOn: {
    borderWidth: 2,
    borderColor: color.borderStrong,
  },
  drawingTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.accent,
  },
  drawingText: {
    color: color.onAccent,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  remove: {
    position: "absolute",
    top: -space.xs,
    right: -space.xs,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  removeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.body + 2,
  },
  add: {
    height: TILE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  chip: {
    minHeight: MIN_TAP_SIZE - space.sm,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipOn: {
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  chipText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  chipTextOn: {
    color: color.text,
  },
  busy: {
    opacity: 0.6,
  },
  line: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  offscreen: {
    position: "absolute",
    left: -10_000,
    top: 0,
    width: MADE_WIDTH,
    height: MADE_WIDTH * COMPOSED_RATIO,
  },
});
