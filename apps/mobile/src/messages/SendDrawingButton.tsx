import type { MessageDrawing } from "@shaperoute/shared-types";
import { useState } from "react";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { t } from "../i18n";
import { color, fontSize, MIN_TAP_SIZE, radius } from "../theme/tokens";
import { useMessagesDoor } from "./messagesDoor";
import { SendToFriend } from "./SendToFriend";

/** An envelope as text, not as an emoji: the app has no icons. */
export const ENVELOPE = "✉︎";

type Props = {
  /** The drawing to send, made when the button is touched; null: none. */
  drawing: () => MessageDrawing | null;
  /** Round, beside the heart on the map; else a row of a card, with its
   * card's look. */
  round?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Send to a friend» (TASK-333, the user's choice 5): on the map beside the
 * heart, and on the cards of «My activities» and of a drawing. Only with an
 * account and an API that has the messages (TASK-319): their numbers say it.
 */
export function SendDrawingButton({
  drawing,
  round = false,
  style,
  textStyle,
  fetchFn,
  apiKey,
}: Props) {
  const { account, unread } = useMessagesDoor();
  const [sending, setSending] = useState<MessageDrawing | null>(null);
  if (account.state.status !== "signedIn" || unread === null) {
    return null;
  }

  function open() {
    const made = drawing();
    if (made !== null) {
      setSending(made);
    }
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          round ? styles.round : style,
          pressed && styles.pressed,
        ]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t("Send to a friend")}
      >
        <Text style={round ? styles.envelope : textStyle}>
          {round ? ENVELOPE : t("Send to a friend")}
        </Text>
      </Pressable>
      {sending !== null && (
        <SendToFriend
          drawing={sending}
          onClose={() => setSending(null)}
          fetchFn={fetchFn}
          apiKey={apiKey}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // As the heart beside it (FavoriteHeart.tsx).
  round: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  envelope: {
    color: color.text,
    fontSize: fontSize.title,
  },
  pressed: {
    opacity: 0.6,
  },
});
