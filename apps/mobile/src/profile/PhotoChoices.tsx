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
import type { PhotoBusy, ProfilePhotoState } from "./useProfilePhoto";

/** What a change of the picture says while it is on its way. */
export function photoBusyText(busy: PhotoBusy): string | null {
  switch (busy) {
    case "saving":
      return t("Saving…");
    case "removing":
      return t("Removing…");
    default:
      return null;
  }
}

type Props = {
  photo: ProfilePhotoState;
  /** Called on every choice, before it starts: the choices close. */
  onChosen: () => void;
};

/**
 * The ways to change the profile picture (TASK-178, TASK-207): one from
 * the library, a photo taken now, or none when there is one. The same
 * under the row of «Settings» and under the circle of «Profile».
 */
export function PhotoChoices({ photo, onChosen }: Props) {
  const then = (choice: () => void) => () => {
    onChosen();
    choice();
  };
  return (
    <View style={styles.choices}>
      <Choice
        text={t("Choose a picture")}
        onPress={then(() => photo.choose("library"))}
      />
      <Choice text={t("Take a photo")} onPress={then(() => photo.choose("camera"))} />
      {photo.uri !== null && (
        <Choice text={t("Remove picture")} onPress={then(photo.remove)} />
      )}
    </View>
  );
}

function Choice({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Tap style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{text}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: space.sm,
  },
  // Neutral: the yellow belongs to the route (docs/UI.md, «Il tema»).
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
