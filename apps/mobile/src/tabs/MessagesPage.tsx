import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { t } from "../i18n";
import { ConversationList } from "../messages/ConversationList";
import { useMessagesDoor } from "../messages/messagesDoor";
import { color, font, space } from "../theme/tokens";
import { useScrollToTopOnReselect } from "./tabReselect";

type Props = {
  /** The tab on screen. */
  active: boolean;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Messages» as a tab (TASK-367, ADR-0311): the conversations and, at the
 * top, the message requests (TASK-319). A conversation, or the requests,
 * open over the app as before, and «←» comes back here. Read again each
 * time it comes on screen, as «Messages» was each time it opened: in place,
 * the list on screen stays until the new one comes, so a swipe that lands
 * here never shows «Loading…» over what it slid in.
 */
export function MessagesPage({ active, fetchFn, apiKey }: Props) {
  const { screen, openConversation, recount } = useMessagesDoor();
  const scroll = useScrollToTopOnReselect<ScrollView>();
  const shown = active && screen === null;
  const [visit, setVisit] = useState(0);
  const [wasShown, setWasShown] = useState(shown);
  if (shown !== wasShown) {
    setWasShown(shown);
    if (shown) {
      setVisit(visit + 1);
    }
  }
  // The red numbers too: what was read is no news any more.
  useEffect(() => {
    if (shown) {
      recount();
    }
  }, [recount, shown]);
  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        {t("Messages")}
      </Text>
      <ConversationList
        visit={visit}
        box="inbox"
        onOpen={openConversation}
        fetchFn={fetchFn}
        apiKey={apiKey}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  title: {
    ...font.title,
    color: color.text,
  },
});
