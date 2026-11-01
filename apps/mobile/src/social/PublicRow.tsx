import type { DrawingPhoto } from "@shaperoute/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import {
  choiceOf as choiceOfDrawing,
  type DrawingChoice,
  isSeen,
  sameChoice,
} from "../api/drawings";
import { t } from "../i18n";
import { space } from "../theme/tokens";
import { type ChoiceShown, type PhotoShown, useDrawingsDoor } from "./drawingsDoor";
import {
  DrawingForm,
  FormScroll,
  nextPlace,
  PHOTOS_LEAVE,
  type PickPhoto,
  PublicLine,
  waitingText,
} from "./PublicParts";

type Line = { text: string; alert: boolean };

/** How much of the screen the form may take on the card. */
export const CARD_FORM_SHARE = 0.4;

type Props = {
  activityKey: string;
  /** A run from a file of another app: it cannot enter a monthly challenge. */
  imported?: boolean;
  /** The fakes of the tests. */
  pick?: PickPhoto;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The form of the drawing on a run of «My activities» (TASK-117, TASK-208),
 * on its card: to open the run to the others after the end of the run,
 * change its title, its description, its photos, the people tagged, what
 * it was, or take it back. Nothing until the API says what was chosen;
 * nothing at all from an API without drawings. The title and the
 * description go when typing is over; the rest at once. Without a network
 * the choice waits on the phone, and says so. The photos are the phone's:
 * they go to the API while others see the run, and come back here when
 * only the owner does (ADR-0170).
 */
export function PublicRow({ activityKey, imported, pick, fetchFn, apiKey }: Props) {
  const { choiceOf, choose, photosOf, keepPhotoOf, removePhotoOf } = useDrawingsDoor();
  const { height } = useWindowDimensions();
  const [shown, setShown] = useState<ChoiceShown | null>(null);
  // As the form has it, and as the API last had it.
  const [choice, setChoice] = useState<DrawingChoice | null>(null);
  const [kept, setKeptState] = useState<DrawingChoice | null>(null);
  // As the API last had it, for the queue too: a refused change goes back to it.
  const keptRef = useRef<DrawingChoice | null>(null);
  function setKept(next: DrawingChoice) {
    keptRef.current = next;
    setKeptState(next);
  }
  const [apiPhotos, setApiPhotos] = useState<DrawingPhoto[]>([]);
  // Counted up to show the photos of the phone again after a change.
  const [changed, setChanged] = useState(0);
  const [busy, setBusy] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  // One choice at a time, in the order made: the last one is the run's.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const live = useRef(true);
  // Read from the phone's files once per change, not at every letter typed.
  const loaded = choice !== null;
  const photos: PhotoShown[] = useMemo(
    () => (loaded ? photosOf(activityKey, apiPhotos) : []),
    // `changed` says the files changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activityKey, apiPhotos, changed, loaded, photosOf],
  );

  useEffect(() => {
    live.current = true;
    void choiceOf(activityKey).then((answer) => {
      if (!live.current || answer === null) {
        return;
      }
      setShown(answer);
      if (answer.kind === "known") {
        setChoice(answer.choice);
        setKept(answer.choice);
        setApiPhotos(answer.photos);
        setLine(
          answer.waiting
            ? { text: waitingText(answer.choice.visibility), alert: false }
            : null,
        );
      }
    });
    return () => {
      live.current = false;
    };
  }, [activityKey, choiceOf]);

  if (shown === null || shown.kind === "off" || choice === null || kept === null) {
    return null;
  }
  if (shown.kind === "failed") {
    return (
      <View style={styles.block}>
        <PublicLine text={shown.problem} alert />
      </View>
    );
  }

  function apply(next: DrawingChoice, photosLeave = false) {
    setBusy((n) => n + 1);
    setLine(null);
    queue.current = queue.current.then(async () => {
      const chosen = await choose(activityKey, next);
      if (!live.current) {
        return;
      }
      setBusy((n) => n - 1);
      setChanged((n) => n + 1);
      if (chosen === null) {
        return;
      }
      switch (chosen.kind) {
        case "saved": {
          const now = choiceOfDrawing(chosen.drawing);
          // The API's answer says nothing of the challenge. An entry refused
          // goes back to what it was, in the form too.
          const entry =
            chosen.entryProblem === undefined ? next.entry : keptRef.current?.entry;
          setKept({ ...now, ...(entry === undefined ? {} : { entry }) });
          setApiPhotos(chosen.drawing.photos ?? []);
          if (chosen.entryProblem !== undefined) {
            setChoice((was) => (was === null ? was : { ...was, entry }));
            setLine({ text: chosen.entryProblem, alert: true });
          } else if (photosLeave) {
            setLine({ text: t(PHOTOS_LEAVE), alert: false });
          }
          return;
        }
        case "waiting":
          setKept(next);
          setLine({ text: waitingText(next.visibility), alert: false });
          return;
        case "failed":
          setLine({ text: chosen.problem, alert: true });
          // The form shows what the API kept, not what it refused.
          if (keptRef.current !== null) {
            setChoice(keptRef.current);
          }
      }
    });
  }

  const current = choice;
  const last = kept;

  /** A change of the chips or the tags goes at once; the text when typing
   * is over. */
  function onChoice(next: DrawingChoice) {
    setChoice(next);
    const typed =
      next.title !== current.title || next.description !== current.description;
    if (!typed && !sameChoice(next, last)) {
      // From seen to «Only me» with photos: the API drops them (ADR-0170).
      apply(
        next,
        isSeen(last.visibility) && !isSeen(next.visibility) && photos.length > 0,
      );
    }
  }

  function onTextDone() {
    if (!sameChoice(current, last)) {
      apply(current);
    }
  }

  return (
    <View style={styles.block}>
      <FormScroll maxHeight={Math.round(height * CARD_FORM_SHARE)}>
        <DrawingForm
          choice={current}
          onChoice={onChoice}
          onTextDone={onTextDone}
          photos={photos}
          onAddPhoto={(base64) => {
            const n = nextPlace(photos);
            if (n === null || !keepPhotoOf(activityKey, n, base64)) {
              setLine({
                text: t("This photo could not be kept on the phone. Try again."),
                alert: true,
              });
              return;
            }
            // While others see the run, the photo goes to the API now.
            if (isSeen(last.visibility)) {
              apply(last);
            } else {
              setChanged((count) => count + 1);
            }
          }}
          onRemovePhoto={(photo) => {
            removePhotoOf(activityKey, photo.n, !photo.onPhone);
            setApiPhotos((was) => was.filter((other) => other.n !== photo.n));
            if (isSeen(last.visibility)) {
              apply(last);
            } else {
              setChanged((count) => count + 1);
            }
          }}
          disabled={busy > 0}
          imported={imported}
          pick={pick}
          fetchFn={fetchFn}
          apiKey={apiKey}
        />
      </FormScroll>
      {line !== null && <PublicLine text={line.text} alert={line.alert} />}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.sm,
    paddingTop: space.xs,
  },
});
