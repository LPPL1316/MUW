import {
  type Activity,
  DRAWING_DESCRIPTION_MAX_LENGTH,
  DRAWING_MAX_PHOTOS,
  DRAWING_MAX_TAGS,
  DRAWING_TITLE_MAX_LENGTH,
  type DrawingTag,
  type LatLon,
  type Person,
  VISIBILITIES,
  type Visibility,
} from "@shaperoute/shared-types";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { DrawingChoice } from "../api/drawings";
import { EnterSwitch } from "../contest/EnterSwitch";
import { t, tLater } from "../i18n";
import type { ImageSource } from "../route/pickImage";
import { activityOffered } from "../settings/sport";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import type { Flattened } from "./composer/flattenPhoto";
import type { PostLayout } from "./composer/layoutFrame";
import {
  type ComposerPhoto,
  type PickMany,
  PostComposer,
} from "./composer/PostComposer";
import type { PostItem } from "./composer/postOrder";
import type { PickedDrawingPhoto } from "./pickDrawingPhoto";
import { TagPeople } from "./TagPeople";

/**
 * The form of a run's drawing (TASK-117, TASK-208, ADR-0170), as Strava's,
 * that the end of a run and a run of «My activities» share: the photos,
 * the title, «How did it go?», the people tagged, what the run was and
 * who can see it, with the lines under them. As Strava's pieces
 * (strava/StravaParts.tsx), so the two sit together.
 */

/** Under «Who can see it» when only the owner sees a run with photos: the
 * photos are the phone's (ADR-0170; the user's choice). */
export const ONLY_ME_PHOTOS = tLater(
  "Photos of a run only you can see stay on this phone. Delete the app or change phone and they are gone.",
);
/** When a run with photos goes from «Everyone» or «Followers» to «Only me». */
export const PHOTOS_LEAVE = tLater("Its photos leave MuW and stay only on this phone.");

/** What a choice does, in words: under the chips once chosen; null for
 * «Only me», which needs none. */
export function seenText(visibility: Visibility): string | null {
  switch (visibility) {
    case "everyone":
      return t(
        "Every member sees it in your profile, without the first and last 200 m.",
      );
    case "followers":
      return t(
        "Your followers see it in your profile, without the first and last 200 m.",
      );
    case "only_me":
      return null;
  }
}

/** A choice on the phone, waiting for a network: what happens then. */
export function waitingText(visibility: Visibility): string {
  return visibility === "only_me"
    ? t("Saved on the phone. It is sent when you are back online.")
    : t("Saved on the phone. Others see it when you are back online.");
}

/** What a run was, as a word. */
export function activityName(activity: Activity): string {
  switch (activity) {
    case "running":
      return t("Run");
    case "cycling":
      return t("Bike");
    case "paddling":
      return t("Paddle");
    case "swimming":
      return t("Open water swim");
    case "walking":
      return t("Walk");
  }
}

/** The first empty place for a photo, 1 to DRAWING_MAX_PHOTOS; null when
 * every place is taken. */
export function nextPlace(photos: readonly { n: number }[]): number | null {
  for (let n = 1; n <= DRAWING_MAX_PHOTOS; n += 1) {
    if (!photos.some((photo) => photo.n === n)) {
      return n;
    }
  }
  return null;
}

export type PickPhoto = (source: ImageSource) => Promise<PickedDrawingPhoto>;

/** A picker of one photo, as the composer asks for several: the fakes of
 * the tests, and a phone that hands over one at a time. */
export function oneAtATime(pick: PickPhoto): PickMany {
  return async (source) => {
    const one = await pick(source);
    if (one.kind !== "picked") {
      return one;
    }
    const { base64, width, height } = one;
    return { kind: "picked", photos: [{ base64, width, height }], tooLarge: false };
  };
}

/** A line under the form: what the others see, or what went wrong. */
export function PublicLine({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <Text
      style={alert ? styles.problem : styles.line}
      accessibilityRole={alert ? "alert" : undefined}
    >
      {text}
    </Text>
  );
}

/** The title of the run: the drawing's, and Strava's. */
export function DrawingTitle({
  value,
  onChange,
  onDone,
  editable = true,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Typing is over (the keyboard closed): a run of «My activities» saves it. */
  onDone?: () => void;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t("Title")}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onEndEditing={onDone}
        editable={editable}
        placeholder={t("Give it a name")}
        placeholderTextColor={color.textFaint}
        maxLength={DRAWING_TITLE_MAX_LENGTH}
        returnKeyType="done"
        accessibilityLabel={t("Title")}
      />
    </View>
  );
}

/** «How did it go?»: the description, empty until written, as Strava's. */
export function DrawingDescription({
  value,
  onChange,
  onDone,
  editable = true,
}: {
  value: string;
  onChange: (text: string) => void;
  onDone?: () => void;
  editable?: boolean;
}) {
  return (
    <TextInput
      style={[styles.input, styles.description]}
      value={value}
      onChangeText={onChange}
      onEndEditing={onDone}
      editable={editable}
      placeholder={t("How did it go?")}
      placeholderTextColor={color.textFaint}
      maxLength={DRAWING_DESCRIPTION_MAX_LENGTH}
      multiline
      accessibilityLabel={t("How did it go?")}
    />
  );
}

type ChipsProps<T extends string> = {
  label: string;
  options: readonly { id: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** One of a few, in a row: the chosen one stands out. */
function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: ChipsProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map((option) => {
          const on = option.id === value;
          return (
            <Pressable
              key={option.id}
              style={[styles.chip, on && styles.chipOn, disabled && styles.busy]}
              onPress={() => onChange(option.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {option.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// A walk once «Walk» can be chosen (activityOffered, TASK-371).
const ACTIVITIES_SHOWN: readonly Activity[] = (
  ["running", "cycling", "paddling", "walking"] as const
).filter((activity) => activityOffered(activity));

/** «Activity»: what the run was, Run, Bike or Paddle. */
export function ActivityChips({
  value,
  onChange,
  disabled,
}: {
  value: Activity;
  onChange: (activity: Activity) => void;
  disabled?: boolean;
}) {
  return (
    <Chips
      label={t("Activity")}
      options={ACTIVITIES_SHOWN.map((id) => ({ id, text: activityName(id) }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function visibilityName(visibility: Visibility): string {
  switch (visibility) {
    case "everyone":
      return t("Everyone");
    case "followers":
      return t("Followers");
    case "only_me":
      return t("Only me");
  }
}

/** «Who can see it»: everyone, the followers, or only the owner. */
export function VisibilityChips({
  value,
  onChange,
  disabled,
}: {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  disabled?: boolean;
}) {
  return (
    <Chips
      label={t("Who can see it")}
      options={VISIBILITIES.map((id) => ({ id, text: visibilityName(id) }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/** «Tag people»: the members tagged, each with its ×, and the way to more. */
export function TagsField({
  tags,
  onChange,
  disabled,
  fetchFn,
  apiKey,
}: {
  tags: readonly DrawingTag[];
  onChange: (tags: DrawingTag[]) => void;
  disabled?: boolean;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
}) {
  const [choosing, setChoosing] = useState(false);
  function pick(person: Person) {
    setChoosing(false);
    if (tags.some((tag) => tag.public_id === person.public_id)) {
      return;
    }
    onChange([...tags, { public_id: person.public_id, username: person.username }]);
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t("Tag people")}</Text>
      <View style={styles.chips}>
        {tags.map((tag) => (
          <Pressable
            key={tag.public_id}
            style={[styles.chip, styles.chipOn, disabled && styles.busy]}
            onPress={() =>
              onChange(tags.filter((other) => other.public_id !== tag.public_id))
            }
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t("Remove {name}", { name: tag.username })}
          >
            <Text style={[styles.chipText, styles.chipTextOn]}>{tag.username} ×</Text>
          </Pressable>
        ))}
        {tags.length < DRAWING_MAX_TAGS && (
          <Pressable
            style={[styles.chip, disabled && styles.busy]}
            onPress={() => setChoosing(true)}
            disabled={disabled}
            accessibilityRole="button"
          >
            <Text style={styles.chipText}>{t("Tag people")}</Text>
          </Pressable>
        )}
      </View>
      <TagPeople
        visible={choosing}
        onPick={pick}
        onClose={() => setChoosing(false)}
        fetchFn={fetchFn}
        apiKey={apiKey}
      />
    </View>
  );
}

export type DrawingFormProps = {
  choice: DrawingChoice;
  onChoice: (next: DrawingChoice) => void;
  /** Typing in the title or the description is over (the keyboard closed). */
  onTextDone?: () => void;
  /** The pages of the post, the map among the photos (TASK-348). */
  items: readonly PostItem[];
  photos: readonly ComposerPhoto[];
  onOrder: (items: PostItem[]) => void;
  /** Photos chosen and shrunk, JPEG in base64, in the order tapped. */
  onAddPhotos: (photos: string[]) => void;
  onRemovePhoto: (n: number) => void;
  /** The run's line and turn: with them, a photo can carry its drawing. */
  track?: readonly LatLon[] | null;
  rotationDeg?: number | null;
  onLayout?: (n: number, layout: PostLayout | null, made: Flattened | null) => void;
  disabled?: boolean;
  /** A run from a file of another app: it cannot enter a monthly challenge. */
  imported?: boolean;
  /** The fakes of the tests. */
  pick?: PickPhoto;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The whole form, in the user's order (2026-10-03): the photos by the map,
 * the title, «How did it go?», the people tagged, the activity and who can
 * see it, and under that the switch that enters a monthly challenge, while
 * one is open (TASK-343 part B). The title and the description are written
 * as typed; the rest changes the choice at once.
 */
export function DrawingForm({
  choice,
  onChoice,
  onTextDone,
  items,
  photos,
  onOrder,
  onAddPhotos,
  onRemovePhoto,
  track,
  rotationDeg,
  onLayout,
  disabled,
  imported = false,
  pick,
  fetchFn,
  apiKey,
}: DrawingFormProps) {
  // What is typed, with its spaces: the choice holds it trimmed.
  const [title, setTitle] = useState(choice.title ?? "");
  const [description, setDescription] = useState(choice.description ?? "");
  const seen = seenText(choice.visibility);
  return (
    <View style={styles.form}>
      <PostComposer
        items={items}
        photos={photos}
        onOrder={onOrder}
        onAdd={onAddPhotos}
        onRemove={onRemovePhoto}
        track={track}
        rotationDeg={rotationDeg}
        onLayout={onLayout}
        disabled={disabled}
        pick={pick === undefined ? undefined : oneAtATime(pick)}
      />
      <DrawingTitle
        value={title}
        onChange={(text) => {
          setTitle(text);
          onChoice({ ...choice, title: text.trim() === "" ? null : text.trim() });
        }}
        onDone={onTextDone}
        editable={!disabled}
      />
      <DrawingDescription
        value={description}
        onChange={(text) => {
          setDescription(text);
          onChoice({ ...choice, description: text.trim() === "" ? null : text.trim() });
        }}
        onDone={onTextDone}
        editable={!disabled}
      />
      <TagsField
        tags={choice.tags}
        onChange={(tags) => onChoice({ ...choice, tags })}
        disabled={disabled}
        fetchFn={fetchFn}
        apiKey={apiKey}
      />
      <ActivityChips
        value={choice.activity}
        onChange={(activity) => onChoice({ ...choice, activity })}
        disabled={disabled}
      />
      <VisibilityChips
        value={choice.visibility}
        onChange={(visibility) => onChoice({ ...choice, visibility })}
        disabled={disabled}
      />
      {choice.visibility === "everyone" && !imported && (
        <EnterSwitch
          entry={choice.entry}
          onEntry={(entry) => onChoice({ ...choice, entry })}
          disabled={disabled}
        />
      )}
      {seen !== null && <PublicLine text={seen} />}
      {choice.visibility === "only_me" && photos.length > 0 && (
        <PublicLine text={t(ONLY_ME_PHOTOS)} />
      )}
    </View>
  );
}

/** The form in a box that scrolls: under the map there is no room for all
 * of it, and the buttons under it must stay in sight. */
export function FormScroll({
  children,
  maxHeight,
}: {
  children: ReactNode;
  maxHeight: number;
}) {
  return (
    <ScrollView
      style={{ maxHeight }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.sm,
  },
  field: {
    gap: space.xs,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  input: {
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.surface,
  },
  description: {
    minHeight: MIN_TAP_SIZE * 1.6,
    textAlignVertical: "top",
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
  // The chosen one, as a switch on: a stronger border, not the yellow.
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
});
