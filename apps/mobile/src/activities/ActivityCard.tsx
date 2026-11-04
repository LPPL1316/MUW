import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ActivityDetail, isImported } from "../api/activities";
import { t } from "../i18n";
import { ImportedMark } from "../imports/ImportedMark";
import { drawingOfRun } from "../messages/messageDrawing";
import { SendDrawingButton } from "../messages/SendDrawingButton";
import { postOfActivity } from "../share/postRun";
import { SharePostButton } from "../share/SharePost";
import { PublicRow } from "../social/PublicRow";
import { StravaActivityRow } from "../strava/StravaActivityRow";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useUnits } from "../units/useUnits";
import { runFacts, startedLabel, whereAndWhat } from "./activityText";

type Props = {
  activity: ActivityDetail;
  /** Back to «My activities» in «Profile». */
  onList: () => void;
  /** The run goes, for good: asked for after a yes on the card. */
  onDelete: () => void;
};

/**
 * A run of «My activities» on the map (TASK-172), under it: when and where
 * it was, how far and how fast; never its score (TASK-241). The map shows it
 * as the end of a run does: the route yellow, what was run light. «Public»
 * and its title make it a drawing in the profile (TASK-117). With Strava
 * connected, «Send to Strava» or «View on Strava» (TASK-187). «Share» makes
 * its post, for Instagram and Strava (TASK-231). A run added from a file of
 * another app says «Imported», and has no «Send to Strava» (TASK-312): it
 * often comes from Strava itself. «Send to a friend» puts it in a message
 * (TASK-333), cut at its ends as the Feed shows it.
 */
export function ActivityCard({ activity, onList, onDelete }: Props) {
  // «Delete» asks first, on the card itself.
  const [confirming, setConfirming] = useState(false);
  // The facts are written again when «Settings» changes the units (TASK-182).
  useUnits();
  const withRoute = activity.points !== null;
  const imported = isImported(activity);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.words}>
          <Text style={styles.when}>{startedLabel(activity.started_at)}</Text>
          <Text style={styles.message}>{whereAndWhat(activity, withRoute)}</Text>
          {imported && <ImportedMark />}
        </View>
      </View>
      <Text style={styles.facts}>{runFacts(activity)}</Text>
      <Text style={styles.message}>
        {t(
          withRoute
            ? "Yellow: the route. White: what you ran."
            : "White: what you ran.",
        )}
      </Text>
      {!confirming && <SharePostButton makeRun={() => postOfActivity(activity)} />}
      {!confirming && <PublicRow activityKey={activity.id} imported={imported} />}
      {!confirming && !imported && <StravaActivityRow activity={activity} />}
      {!confirming && (
        <SendDrawingButton
          drawing={() => drawingOfRun(activity)}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      )}
      {confirming ? (
        <>
          <Text style={styles.confirmText}>
            {t("Delete this run? It cannot be undone.")}
          </Text>
          <View style={styles.buttons}>
            <Pressable
              style={styles.button}
              onPress={() => setConfirming(false)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{t("Keep it")}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.danger]}
              onPress={onDelete}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, styles.dangerText]}>
                {t("Delete run")}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.buttons}>
          <Pressable
            style={styles.button}
            onPress={() => setConfirming(true)}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.dangerText]}>{t("Delete")}</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={onList} accessibilityRole="button">
            <Text style={styles.buttonText}>{t("Back to the list")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  words: {
    flex: 1,
    gap: 2,
  },
  when: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  facts: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  confirmText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space.sm,
    paddingTop: space.xs,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  danger: {
    borderColor: color.error,
  },
  dangerText: {
    color: color.error,
  },
});
