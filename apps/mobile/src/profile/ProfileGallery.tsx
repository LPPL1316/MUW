import type { UserPhoto, UserPhotosPage } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { accountProblem, sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { drawingPhotoSource } from "../api/drawings";
import { fetchUserPhotos } from "../api/userPhotos";
import { t } from "../i18n";
import { useDrawingsDoor } from "../social/drawingsDoor";
import { drawingName, DrawingsGrid } from "../social/DrawingsGrid";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

/** Three photos a row, as the drawings. */
const COLUMNS = 3;
/** The side of a photo before the grid knows its width. */
const FIRST_CELL = 96;

export type GalleryTab = "drawings" | "photos";

/** What the gallery has of the profile's photos. */
type Shown =
  | { kind: "loading" }
  | { kind: "ready"; photos: UserPhoto[]; next: string | null }
  | { kind: "failed"; problem: string };

type Props = {
  /** The profile's `public_id`; null from an API older than profiles. */
  publicId: string | null;
  /** The account's own profile: its empty grids say how to fill them. */
  own: boolean;
  /** The API has the photos of a profile (TASK-324): it answered the
   * totals. False: the drawings alone, as before. */
  photos: boolean;
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  /** The session's; null with nobody signed in: the drawings alone. */
  token: string | null;
  onSessionEnded: (token: string) => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * What a profile made (TASK-324, ADR-0284): «Drawings» and «Photos», one
 * at a time. «Drawings» is the grid of TASK-117; «Photos» the photos of
 * the drawings the one who looks sees, the latest run first, three a row,
 * a page at a time, and a tap opens the drawing of one on the map. The
 * photos are asked for the first time «Photos» is touched, not before.
 * With an API older than TASK-324, the drawings alone, as before.
 */
export function ProfileGallery({
  publicId,
  own,
  photos,
  apiUrl,
  token,
  onSessionEnded,
  fetchFn,
  apiKey,
}: Props) {
  const { open, opening, openProblem } = useDrawingsDoor();
  const asked = `${token ?? ""} ${publicId ?? ""}`;
  // The answer for one profile and one token: another's is not this one's.
  const [answer, setAnswer] = useState<{ asked: string; shown: Shown } | null>(null);
  const [tab, setTab] = useState<GalleryTab>("drawings");
  // «Photos» was touched once: from then on its photos are there.
  const [wanted, setWanted] = useState(false);
  // «Try again» asks once more.
  const [tries, setTries] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!wanted || token === null || apiUrl === null || publicId === null) {
      return;
    }
    let live = true;
    void fetchUserPhotos(apiUrl, token, publicId, null, { fetchFn, key: apiKey }).then(
      (outcome) => {
        if (!live) {
          return;
        }
        setAnswer({ asked, shown: shownOf(outcome) });
        if (sessionEnded(outcome)) {
          onSessionEnded(token);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, asked, fetchFn, onSessionEnded, publicId, token, tries, wanted]);

  const shown: Shown =
    answer !== null && answer.asked === asked ? answer.shown : { kind: "loading" };
  // Without photos on the API, or nobody to ask them for, the drawings as
  // they always were, with their title.
  const tabs = photos && token !== null && apiUrl !== null && publicId !== null;
  const showing: GalleryTab = tabs ? tab : "drawings";

  function loadMore() {
    if (shown.kind !== "ready" || shown.next === null) {
      return;
    }
    if (token === null || apiUrl === null || publicId === null) {
      return;
    }
    const was = asked;
    setLoadingMore(true);
    void fetchUserPhotos(apiUrl, token, publicId, shown.next, {
      fetchFn,
      key: apiKey,
    }).then((outcome) => {
      setLoadingMore(false);
      if (outcome.kind !== "ok") {
        return;
      }
      setAnswer((before) => {
        if (before === null || before.asked !== was || before.shown.kind !== "ready") {
          return before;
        }
        // A photo already shown is not shown twice.
        const seen = new Set(before.shown.photos.map(photoKey));
        return {
          asked: was,
          shown: {
            kind: "ready",
            photos: [
              ...before.shown.photos,
              ...outcome.value.photos.filter((p) => !seen.has(photoKey(p))),
            ],
            next: outcome.value.next,
          },
        };
      });
    });
  }

  const cell =
    width > 0 ? Math.floor((width - space.sm * (COLUMNS - 1)) / COLUMNS) : FIRST_CELL;
  return (
    <View style={styles.section} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {tabs && (
        <View style={styles.tabs} accessibilityRole="tablist">
          <Tab
            name={t("Drawings")}
            selected={showing === "drawings"}
            onPress={() => setTab("drawings")}
          />
          <Tab
            name={t("Photos")}
            selected={showing === "photos"}
            onPress={() => {
              setTab("photos");
              setWanted(true);
            }}
          />
        </View>
      )}
      {showing === "drawings" ? (
        <DrawingsGrid publicId={publicId} own={own} titled={!tabs} />
      ) : (
        <View style={styles.photos}>
          {openProblem !== null && (
            <Text style={styles.problem} accessibilityRole="alert">
              {openProblem}
            </Text>
          )}
          {shown.kind === "failed" ? (
            <>
              <Text style={styles.problem}>{shown.problem}</Text>
              <Pressable
                style={styles.button}
                onPress={() => {
                  setAnswer(null);
                  setTries((n) => n + 1);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{t("Try again")}</Text>
              </Pressable>
            </>
          ) : shown.kind === "loading" ? (
            <Text style={styles.message}>{t("Loading…")}</Text>
          ) : shown.photos.length === 0 ? (
            <Text style={styles.message}>
              {t(
                own
                  ? "No photos yet. Add some to a public drawing in My activities."
                  : "No photos yet.",
              )}
            </Text>
          ) : apiUrl !== null && token !== null ? (
            <>
              <View style={styles.grid}>
                {shown.photos.map((photo) => (
                  <Pressable
                    key={photoKey(photo)}
                    style={({ pressed }) => [
                      { width: cell, height: cell },
                      (pressed || opening === photo.drawing_id) && styles.pressed,
                    ]}
                    onPress={() => open({ id: photo.drawing_id })}
                    disabled={opening !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t("{title}, open on the map", {
                      title: drawingName(photo),
                    })}
                    testID="photo-cell"
                  >
                    <Image
                      source={drawingPhotoSource(apiUrl, token, photo)}
                      style={[styles.photo, { width: cell, height: cell }]}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                      testID="photo-image"
                    />
                  </Pressable>
                ))}
              </View>
              {shown.next !== null && (
                <Pressable
                  style={[styles.button, loadingMore && styles.pressed]}
                  onPress={loadMore}
                  disabled={loadingMore}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                >
                  <Text style={styles.buttonText}>
                    {t(loadingMore ? "Loading…" : "Show more")}
                  </Text>
                </Pressable>
              )}
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** What the first page said: the photos, or why not. */
function shownOf(outcome: AccountOutcome<UserPhotosPage>): Shown {
  return outcome.kind === "ok"
    ? { kind: "ready", ...outcome.value }
    : { kind: "failed", problem: accountProblem(outcome) };
}

/** A photo is one place of one drawing. */
function photoKey(photo: Pick<UserPhoto, "drawing_id" | "n">): string {
  return `${photo.drawing_id}/${photo.n}`;
}

function Tab({
  name,
  selected,
  onPress,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tab, selected && styles.tabSelected]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  // Neutral, as the rest of «Profile»: the yellow belongs to the route.
  tab: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabSelected: {
    borderBottomColor: color.text,
  },
  tabText: {
    color: color.textMuted,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  tabTextSelected: {
    color: color.text,
  },
  photos: {
    gap: space.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  photo: {
    borderRadius: radius.sm,
    backgroundColor: color.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
