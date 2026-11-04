import type { FollowState } from "@shaperoute/shared-types";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import { askToFollow, followProblem, stopFollowing } from "../api/follows";
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

type Props = {
  apiUrl: string;
  /** The session token of who follows. */
  token: string;
  /** The member the button is about. */
  publicId: string;
  username: string;
  /** Where the account stands towards the member now. */
  follow: FollowState;
  /** The API kept a change: the profile shows it. */
  onFollow: (next: FollowState) => void;
  /** The API said the session is over. */
  onSessionEnded: (token: string) => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The button on another member's profile (TASK-211, ADR-0173): «Follow»
 * asks, and the other accepts or declines; «Requested» takes the request
 * back; «Following» stops, after asking. A request declined shows «Follow»
 * again: nothing says it was declined.
 */
export function FollowButton({
  apiUrl,
  token,
  publicId,
  username,
  follow,
  onFollow,
  onSessionEnded,
  fetchFn,
  apiKey,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const options = { fetchFn, key: apiKey };

  function change(to: "follow" | "stop") {
    setBusy(true);
    setProblem(null);
    setConfirming(false);
    const asked =
      to === "follow"
        ? askToFollow(apiUrl, token, publicId, options)
        : stopFollowing(apiUrl, token, publicId, options);
    void asked.then((outcome) => {
      setBusy(false);
      if (outcome.kind === "ok") {
        onFollow(outcome.value === null ? "none" : outcome.value.follow);
        return;
      }
      setProblem(followProblem(outcome));
      if (sessionEnded(outcome)) {
        onSessionEnded(token);
      }
    });
  }

  if (confirming) {
    return (
      <View style={styles.confirm}>
        <Text style={styles.confirmText}>
          {t("Stop following {name}?", { name: username })}
        </Text>
        <View style={styles.choices}>
          <Tap
            style={[styles.button, styles.choice]}
            onPress={() => setConfirming(false)}
            accessibilityRole="button"
          >
            <Text style={styles.text}>{t("Keep it")}</Text>
          </Tap>
          <Tap
            style={[styles.button, styles.choice]}
            onPress={() => change("stop")}
            accessibilityRole="button"
          >
            <Text style={[styles.text, styles.stop]}>{t("Unfollow")}</Text>
          </Tap>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Tap
        style={[styles.button, follow === "none" && styles.ask, busy && styles.dim]}
        onPress={() => {
          if (follow === "none") {
            change("follow");
          } else if (follow === "requested") {
            change("stop");
          } else {
            setConfirming(true);
          }
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        accessibilityHint={
          follow === "requested" ? t("Takes your request back.") : undefined
        }
      >
        <Text style={[styles.text, follow === "none" && styles.askText]}>
          {follow === "none"
            ? t("Follow")
            : follow === "requested"
              ? t("Requested")
              : t("Following")}
        </Text>
      </Tap>
      {problem !== null && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
  },
  // Neutral, as «Edit profile»: the yellow belongs to the route.
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  // «Follow» is the one thing to do here: white, as the «+» of the picture.
  ask: {
    backgroundColor: color.text,
    borderColor: color.text,
  },
  dim: {
    opacity: 0.6,
  },
  text: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  askText: {
    color: color.background,
  },
  stop: {
    color: color.error,
  },
  confirm: {
    gap: space.sm,
  },
  confirmText: {
    color: color.text,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  choices: {
    flexDirection: "row",
    gap: space.md,
  },
  choice: {
    flex: 1,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
    textAlign: "center",
  },
});
