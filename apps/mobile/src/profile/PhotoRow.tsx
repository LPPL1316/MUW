import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import { Avatar } from "./Avatar";
import { photoBusyText, PhotoChoices } from "./PhotoChoices";
import { useProfilePhoto } from "./useProfilePhoto";

const PHOTO_SIZE = MIN_TAP_SIZE - space.xs;

/**
 * «Profile picture» in «Settings» (TASK-178, ADR-0146): the picture, or the
 * letter, at the end of the row. A tap opens the ways to change it under
 * the row, as «Delete account» opens its question: a picture from the
 * library, a photo taken now, or none.
 */
export function PhotoRow({ name }: { name: string }) {
  const photo = useProfilePhoto();
  const [open, setOpen] = useState(false);
  const busy = photo.busy !== null;
  const busyText = photoBusyText(photo.busy);
  return (
    <View style={styles.menu}>
      <Tap
        style={styles.row}
        onPress={() => {
          photo.clearProblem();
          setOpen(!open);
        }}
        disabled={busy}
        accessibilityRole="button"
        // One name for the row: the emoji and the picture are not read.
        accessibilityLabel={
          busyText !== null
            ? `${t("Profile picture")}, ${busyText}`
            : t("Profile picture")
        }
        accessibilityState={{ expanded: open, disabled: busy, busy }}
      >
        <Text style={styles.emoji}>📷</Text>
        <Text style={styles.rowText}>{t("Profile picture")}</Text>
        {busyText !== null && <Text style={styles.busyText}>{busyText}</Text>}
        <Avatar name={name} size={PHOTO_SIZE} photo={photo.uri} />
      </Tap>
      {open && (
        <View style={styles.choices}>
          <PhotoChoices photo={photo} onChosen={() => setOpen(false)} />
        </View>
      )}
      {photo.problem !== null && <Text style={styles.problem}>{photo.problem}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // As the other rows of «Settings» (SettingsPage.tsx).
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  emoji: {
    fontSize: fontSize.input + space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  busyText: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  choices: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
});
