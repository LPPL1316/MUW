import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { ConversationList } from "./ConversationList";
import { ConversationScreen } from "./ConversationScreen";
import { useMessagesDoor } from "./messagesDoor";

type Props = {
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Messages» over the app (TASK-305, ADR-0265), as «Find friends» is: the
 * list of the conversations, the message requests, or one conversation.
 * «←» goes back to the list a conversation was opened from, and from the
 * requests to «Messages»; else it closes, and the app is as it was left.
 * Nothing while the door has no screen open.
 */
export function MessagesOverlay({ fetchFn, apiKey }: Props) {
  const insets = useSafeAreaInsets();
  const { screen, back, openConversation } = useMessagesDoor();
  if (screen === null) {
    return null;
  }
  const padding = { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom };
  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, styles.screen]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {screen.kind === "conversation" ? (
        <View style={[styles.conversation, padding]}>
          <ConversationScreen
            // Another member, another conversation from the start.
            key={screen.person.public_id}
            person={screen.person}
            onBack={back}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { ...padding, paddingBottom: insets.bottom + space.xl },
          ]}
        >
          <View style={styles.titleRow}>
            <Pressable
              style={styles.back}
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={t("Back")}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              {screen.box === "inbox" ? t("Messages") : t("Message requests")}
            </Text>
          </View>
          <ConversationList
            key={screen.box}
            box={screen.box}
            onOpen={openConversation}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  conversation: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  // As the title of «Find friends» (PeopleScreen.tsx).
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
});
