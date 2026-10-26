import type { Person } from "@shaperoute/shared-types";
import { Pressable, StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, MIN_TAP_SIZE, radius } from "../theme/tokens";
import { useMessagesDoor } from "./messagesDoor";

type Props = {
  person: Person;
};

/**
 * «Message» on another member's profile (TASK-310, ADR-0270): it opens the
 * conversation with them over the app. Nothing with an API older than the
 * messages, as «Messages» in «Profile».
 */
export function MessageButton({ person }: Props) {
  const { unread, openConversation } = useMessagesDoor();
  if (unread === null) {
    return null;
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={() => openConversation(person)}
      accessibilityRole="button"
      accessibilityLabel={t("Message {name}", { name: person.username })}
    >
      <Text style={styles.text}>{t("Message")}</Text>
    </Pressable>
  );
}

// Neutral, as «Edit profile»: the yellow belongs to the route.
const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
