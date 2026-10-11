import {
  type Comment,
  type ReportReason,
  REPORT_REASONS,
} from "@shaperoute/shared-types";
import { useMemo } from "react";
import { Alert } from "react-native";

import { sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { blockMember, report } from "../api/moderation";
import { t } from "../i18n";
import { markBlocked } from "./blockedNow";
import { useFollowsDoor } from "./followsDoor";
import {
  BLOCK_EXPLAINED,
  moderationProblem,
  REASON_TEXTS,
  REPORTED,
} from "./ReportMenu";

/** What a comment of another member offers, besides «Delete». */
export type CommentChoices = {
  /** The public id of the account signed in: its own comments are not reported. */
  me: string;
  /** Asks why, from the short list of the «…», reports the comment and says thanks. */
  report: (comment: Comment) => void;
  /** Asks first, saying what it does; then blocks the author and calls `onBlocked`. */
  block: (comment: Comment, onBlocked: () => void) => void;
};

/**
 * «Report» and «Block» on another member's comment (TASK-275, ADR-0228):
 * the same reasons, questions and words as the «…» of a post, in native
 * alerts, as «Delete this comment?» in the same sheet: the comments are a
 * sheet already, and a second one would sit on it. The report is kept for
 * whoever runs the app; a block takes the author's cards out of «Feed» at
 * once. Null with nobody signed in, without the API, or with a session
 * kept before the public id (one's own comments would not be told apart):
 * then a comment offers only «Delete», as before.
 */
export function useCommentChoices(): CommentChoices | null {
  const { apiUrl, account } = useFollowsDoor();
  const { state, sessionEnded: endSession } = account;
  const session = state.status === "signedIn" ? state.session : null;
  return useMemo(() => {
    const me = session?.user.public_id;
    if (apiUrl === null || session === null || me === undefined) {
      return null;
    }
    const { token } = session;

    function answered(outcome: AccountOutcome<null>, done: () => void) {
      if (outcome.kind === "ok") {
        done();
        return;
      }
      Alert.alert(moderationProblem(outcome));
      if (sessionEnded(outcome)) {
        endSession(token);
      }
    }

    return {
      me,
      report: (comment) => {
        const send = (reason: ReportReason) => {
          void report(apiUrl, token, "comment", comment.id, reason).then((outcome) =>
            answered(outcome, () => Alert.alert(t(REPORTED))),
          );
        };
        Alert.alert(t("Why are you reporting this?"), undefined, [
          ...REPORT_REASONS.map((reason) => ({
            text: t(REASON_TEXTS[reason]),
            onPress: () => send(reason),
          })),
          { text: t("Cancel"), style: "cancel" },
        ]);
      },
      block: (comment, onBlocked) => {
        const { public_id: publicId, username } = comment.author;
        const send = () => {
          void blockMember(apiUrl, token, publicId).then((outcome) =>
            answered(outcome, () => {
              markBlocked(publicId);
              onBlocked();
            }),
          );
        };
        Alert.alert(t("Block {user}?", { user: username }), t(BLOCK_EXPLAINED), [
          { text: t("Cancel"), style: "cancel" },
          { text: t("Block"), style: "destructive", onPress: send },
        ]);
      },
    };
  }, [apiUrl, endSession, session]);
}
