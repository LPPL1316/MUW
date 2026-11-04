import type { DrawingDetail } from "@shaperoute/shared-types";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import { t } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { useFollowsDoor } from "../social/followsDoor";
import { color, fontSize, space } from "../theme/tokens";
import { entryProblem, setContestEntry, themeText } from "./contestApi";
import { enteredIn, tellEntered, useContestKept } from "./contestKept";
import { enterable, SwitchRow } from "./EnterSwitch";
import { useClock } from "./useClock";

/**
 * «Enter “{theme}”» on the account's own post, opened whole (TASK-343 part
 * B): it enters or withdraws at once. Only a drawing that can take part has
 * it: for everyone, recorded by the app, published during the challenge.
 * `DrawingCard` mounts it once TASK-339 B has let that file go.
 */
export function EnterOnPost({ drawing }: { drawing: DrawingDetail }) {
  const { apiUrl, account } = useFollowsDoor();
  const kept = useContestKept();
  const language = useLanguage();
  const now = useClock();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { state } = account;
  const session = state.status === "signedIn" ? state.session : null;
  const publicId = session?.user.public_id ?? null;
  const contest = enterable(kept, now);
  if (
    contest === null ||
    apiUrl === null ||
    session === null ||
    publicId !== drawing.author.public_id ||
    drawing.visibility !== "everyone" ||
    (drawing.source !== undefined && drawing.source !== "muw") ||
    drawing.published_at === null ||
    Date.parse(drawing.published_at) < Date.parse(contest.starts_at) ||
    Date.parse(drawing.published_at) > Date.parse(contest.ends_at)
  ) {
    return null;
  }
  const { id: contestId } = contest;
  const { token } = session;
  const baseUrl = apiUrl;
  async function change(entered: boolean) {
    setBusy(true);
    setProblem(null);
    const outcome = await setContestEntry(
      baseUrl,
      token,
      contestId,
      drawing.id,
      entered,
    );
    setBusy(false);
    if (outcome.kind === "ok") {
      tellEntered(baseUrl, token, contestId, drawing.id, entered);
    } else if (sessionEnded(outcome)) {
      account.sessionEnded(token);
    } else {
      setProblem(entryProblem(outcome));
    }
  }
  return (
    <View style={styles.block}>
      <SwitchRow
        label={t("Enter “{theme}”", {
          theme: themeText(contest.theme, language).title,
        })}
        on={enteredIn(kept, publicId).includes(drawing.id)}
        onChange={(entered) => void change(entered)}
        disabled={busy}
      />
      {problem !== null && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.xs,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
});
