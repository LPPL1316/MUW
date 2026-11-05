import type { Person } from "@shaperoute/shared-types";
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
import { SheetModal } from "../ui/SheetModal";
import { useFollowsDoor } from "./followsDoor";
import { PeopleSearch } from "./PeopleSearch";

type Props = {
  visible: boolean;
  /** A member was touched: tagged, and the sheet closes. */
  onPick: (person: Person) => void;
  onClose: () => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The members to tag in a run (TASK-208), over the end of the run or a run
 * of «My activities»: the search by name of «Find friends» (TASK-215) in a
 * sheet, with the API and the account «Profile» knows (followsDoor.ts).
 * One touch on a name tags it.
 */
export function TagPeople({ visible, onPick, onClose, fetchFn, apiKey }: Props) {
  return (
    <SheetModal visible={visible} onRequestClose={onClose}>
      {/* Mounted with the sheet: each opening starts from an empty field. */}
      <SheetBody onPick={onPick} onClose={onClose} fetchFn={fetchFn} apiKey={apiKey} />
    </SheetModal>
  );
}

function SheetBody({ onPick, onClose, fetchFn, apiKey }: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const { apiUrl, account } = useFollowsDoor();
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* A tap over the sheet closes it, as its «Close». */}
      <Pressable
        style={[styles.backdrop, { minHeight: insets.top + space.xl }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("Close")}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Tag people")}
          </Text>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t("Close")}</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <PeopleSearch
            apiUrl={apiUrl}
            account={account}
            onPick={onPick}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// As the sheet of the comments (DrawingComments.tsx).
const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  backdrop: {
    flexGrow: 1,
  },
  sheet: {
    flexShrink: 1,
    maxHeight: "70%",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  close: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  closeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  list: {
    flexShrink: 1,
  },
});
