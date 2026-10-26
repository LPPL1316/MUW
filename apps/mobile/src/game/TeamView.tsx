import type {
  ChallengeRequest,
  GameCatalog,
  GameChallenge,
  GameTeam,
} from "@shaperoute/shared-types";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import { personPhotoUri } from "../api/people";
import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import { Avatar } from "../profile/Avatar";
import { useFollowsDoor } from "../social/followsDoor";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import type { Units } from "../units/units";
import { ChallengeView } from "./ChallengeView";
import { NewChallenge } from "./NewChallenge";
import { shareTeamCode } from "./shareCode";
import { createChallenge, teamProblem } from "./teamsApi";
import { keepChallenge, useChallenge } from "./useChallenge";
import type { Done } from "./useTeams";

type Props = {
  /** The team as the list has it; null while the list has not got it. */
  team: GameTeam | null;
  /** The challenge to show: the team's newest, or the one a notification
   * named; null for a team without one. */
  challengeId: string | null;
  /** The account's public_id; null if the API did not say it. */
  me: string | null;
  catalog: GameCatalog | null;
  units: Units;
  language: Language;
  onBack: () => void;
  /** Out of the team, or a member out. */
  onRemove: (teamId: string, publicId: string) => Promise<Done<null>>;
  /** The team changed (a challenge started, a member gone): the list is
   * read again. */
  onChanged: () => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
  now?: () => number;
};

const PHOTO_SIDE = 36;

/**
 * One team (TASK-296 part D, docs/GIOCO.md §6 and §9): its name and code,
 * «Share code», its challenge (going, complete or expired) or «New
 * challenge», its members with «Remove» for the owner, and «Leave team».
 */
export function TeamView({
  team,
  challengeId,
  me,
  catalog,
  units,
  language,
  onBack,
  onRemove,
  onChanged,
  fetchFn,
  apiKey,
  now,
}: Props) {
  const { apiUrl, account } = useFollowsDoor();
  const token =
    account.state.status === "signedIn" ? account.state.session.token : null;
  // A challenge just started here, newer than the list's.
  const [started, setStarted] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [sending, setSending] = useState(false);
  const [newProblem, setNewProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pieceProblem, setPieceProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [teamProblemText, setTeamProblemText] = useState<string | null>(null);
  const shownId = started ?? challengeId;
  const { shown, refresh, hold, release } = useChallenge(shownId, {
    fetchFn,
    key: apiKey,
  });
  const challenge: GameChallenge | null =
    shown.status === "ready" ? shown.challenge : null;
  const over = challenge !== null && challenge.status !== "active";
  const shape = catalog?.shapes.find((each) => each.id === challenge?.shape_id) ?? null;
  const owner = team !== null && me !== null && team.owner === me;

  async function start(request: ChallengeRequest) {
    if (team === null || apiUrl === null || token === null) {
      return;
    }
    setSending(true);
    setNewProblem(null);
    const outcome = await createChallenge(apiUrl, token, team.id, request, {
      fetchFn,
      key: apiKey,
    });
    setSending(false);
    if (outcome.kind === "ok") {
      keepChallenge(outcome.value);
      setStarted(outcome.value.id);
      setMaking(false);
      onChanged();
      return;
    }
    if (sessionEnded(outcome)) {
      account.sessionEnded(token);
    }
    setNewProblem(teamProblem(outcome));
  }

  async function piece(act: (idx: number) => Promise<string | null>, idx: number) {
    setBusy(true);
    setPieceProblem(null);
    const problem = await act(idx);
    setBusy(false);
    setPieceProblem(problem);
  }

  async function leave() {
    if (team === null || me === null) {
      return;
    }
    setBusy(true);
    const done = await onRemove(team.id, me);
    setBusy(false);
    if (done.ok) {
      onBack();
    } else {
      setLeaving(false);
      setTeamProblemText(done.problem);
    }
  }

  async function remove(publicId: string) {
    if (team === null) {
      return;
    }
    setBusy(true);
    const done = await onRemove(team.id, publicId);
    setBusy(false);
    setTeamProblemText(done.ok ? null : done.problem);
  }

  return (
    <View style={styles.view} testID="team-view">
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("Back")}
          testID="team-back"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>
          {team?.name ?? t("Challenges")}
        </Text>
      </View>
      {team !== null && (
        <View style={styles.codeRow}>
          <Text style={styles.code} selectable testID="team-code">
            {t("Code {code}", { code: team.code })}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => void shareTeamCode(team)}
            accessibilityRole="button"
            testID="team-share"
          >
            <Text style={styles.buttonText}>{t("Share code")}</Text>
          </Pressable>
        </View>
      )}

      {making && catalog !== null && team !== null ? (
        <NewChallenge
          catalog={catalog}
          members={team.members.length}
          units={units}
          language={language}
          sending={sending}
          problem={newProblem}
          onStart={(request) => void start(request)}
          onCancel={() => {
            setMaking(false);
            setNewProblem(null);
          }}
        />
      ) : (
        <>
          {shownId !== null && shown.status === "loading" && (
            <ActivityIndicator color={color.textMuted} style={styles.wait} />
          )}
          {shown.status === "failed" && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{shown.problem}</Text>
              <Pressable
                style={styles.button}
                onPress={refresh}
                accessibilityRole="button"
                testID="challenge-retry"
              >
                <Text style={styles.buttonText}>{t("Try again")}</Text>
              </Pressable>
            </View>
          )}
          {challenge !== null && (
            <ChallengeView
              challenge={challenge}
              shape={shape}
              members={team?.members ?? []}
              me={me}
              busy={busy}
              problem={pieceProblem}
              onHold={(idx) => void piece(hold, idx)}
              onRelease={(idx) => void piece(release, idx)}
              units={units}
              language={language}
              now={now}
            />
          )}
          {shownId === null && (
            <Text style={styles.muted} testID="team-no-challenge">
              {t("No challenge yet")}
            </Text>
          )}
          {team !== null && catalog !== null && (shownId === null || over) && (
            <Pressable
              style={styles.primary}
              onPress={() => setMaking(true)}
              accessibilityRole="button"
              testID="team-new-challenge"
            >
              <Text style={styles.primaryText}>{t("New challenge")}</Text>
            </Pressable>
          )}
        </>
      )}

      {team !== null && (
        <>
          <Text style={styles.heading}>{t("MEMBERS")}</Text>
          {team.members.map((member) => (
            <View
              key={member.public_id}
              style={styles.member}
              accessible
              accessibilityLabel={
                member.public_id === team.owner
                  ? `${member.username}, ${t("Owner")}`
                  : member.username
              }
              testID={`member-${member.public_id}`}
            >
              <Avatar
                name={member.username}
                size={PHOTO_SIDE}
                photo={personPhotoUri(member)}
              />
              <Text style={styles.memberName} numberOfLines={1}>
                {member.username}
              </Text>
              {member.public_id === team.owner && (
                <Text style={styles.ownerTag}>{t("Owner")}</Text>
              )}
              {owner && member.public_id !== me && (
                <Pressable
                  style={[styles.button, busy && styles.off]}
                  onPress={() => void remove(member.public_id)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("Remove")} ${member.username}`}
                  testID={`remove-${member.public_id}`}
                >
                  <Text style={styles.buttonText}>{t("Remove")}</Text>
                </Pressable>
              )}
            </View>
          ))}
          {teamProblemText !== null && (
            <Text style={styles.problem} accessibilityLiveRegion="polite">
              {teamProblemText}
            </Text>
          )}
          {me !== null &&
            (leaving ? (
              <View style={styles.leaveRow}>
                <Text style={styles.noticeText}>{t("Leave this team?")}</Text>
                <Pressable
                  style={[styles.button, busy && styles.off]}
                  onPress={() => void leave()}
                  disabled={busy}
                  accessibilityRole="button"
                  testID="team-leave-confirm"
                >
                  <Text style={styles.buttonText}>{t("Leave team")}</Text>
                </Pressable>
                <Pressable
                  style={styles.button}
                  onPress={() => setLeaving(false)}
                  accessibilityRole="button"
                  testID="team-leave-cancel"
                >
                  <Text style={styles.buttonText}>{t("Cancel")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.leave}
                onPress={() => setLeaving(true)}
                accessibilityRole="button"
                testID="team-leave"
              >
                <Text style={styles.leaveText}>{t("Leave team")}</Text>
              </Pressable>
            ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  view: {
    gap: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  name: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  code: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
  },
  wait: {
    marginVertical: space.sm,
  },
  notice: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    gap: space.sm,
  },
  noticeText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  muted: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  heading: {
    marginTop: space.md,
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TAP_SIZE,
  },
  memberName: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
  },
  ownerTag: {
    color: color.textMuted,
    fontSize: fontSize.label,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
  primary: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  primaryText: {
    color: color.onAccent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  leave: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    marginTop: space.sm,
  },
  leaveText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  off: {
    opacity: 0.4,
  },
});
