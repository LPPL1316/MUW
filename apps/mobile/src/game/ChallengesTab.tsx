import type { GameTeam } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { t, tPlural } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { useFollowsDoor } from "../social/followsDoor";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useUnits } from "../units/useUnits";
import {
  clearRequestedChallenge,
  type RequestedChallenge,
  useRequestedChallenge,
} from "./challengeDoor";
import { useGameCatalog } from "./gameCatalog";
import { shapeNameIn } from "./ShapeCard";
import { TeamView } from "./TeamView";
import { keepChallenge } from "./useChallenge";
import { useTeams } from "./useTeams";

type Props = {
  /** The tab is on screen: the teams are asked for. */
  active: boolean;
  /** «Sign in to play with a team.» touched: the way to the account. */
  onSignIn: () => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
  now?: () => number;
};

/** What is open over the list: a team, or the challenge a notification
 * named, whose team the challenge itself says. A team just created or
 * joined is kept here too, while the list is read again. */
type Open = { teamId: string | null; challengeId: string | null; team?: GameTeam };

/**
 * The «Challenges» tab of «Play» (TASK-296 part D, docs/GIOCO.md §9): the
 * account's teams, «Create» with a name and «Join» with a code, and the
 * team opened, with its challenge. Without an account, the way to sign in;
 * on an API without the teams yet, a quiet line and no error. A challenge's
 * notification touched opens that challenge (`challengeDoor`).
 */
export function ChallengesTab({ active, onSignIn, fetchFn, apiKey, now }: Props) {
  const { account } = useFollowsDoor();
  const me =
    account.state.status === "signedIn"
      ? (account.state.session.user.public_id ?? null)
      : null;
  const units = useUnits();
  const language = useLanguage();
  const catalog = useGameCatalog();
  const teams = useTeams(active, { fetchFn, key: apiKey });
  const [open, setOpen] = useState<Open | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createProblem, setCreateProblem] = useState<string | null>(null);
  const [joinProblem, setJoinProblem] = useState<string | null>(null);

  // A challenge asked for from outside: opened, once per request.
  const requested = useRequestedChallenge();
  const [seen, setSeen] = useState<RequestedChallenge | null>(null);
  if (requested !== null && requested !== seen) {
    setSeen(requested);
    setOpen({ teamId: null, challengeId: requested.id });
  }
  useEffect(() => {
    if (requested !== null && requested === seen) {
      clearRequestedChallenge();
    }
  }, [requested, seen]);

  const list: GameTeam[] = teams.shown.status === "ready" ? teams.shown.teams : [];

  function show(team: GameTeam) {
    if (team.challenge !== null) {
      keepChallenge(team.challenge);
    }
    setOpen({ teamId: team.id, challengeId: team.challenge?.id ?? null, team });
  }

  async function create() {
    Keyboard.dismiss();
    setCreating(true);
    setCreateProblem(null);
    const done = await teams.create(name.trim());
    setCreating(false);
    if (done.ok) {
      setName("");
      show(done.value);
    } else {
      setCreateProblem(done.problem);
    }
  }

  async function join() {
    Keyboard.dismiss();
    setJoining(true);
    setJoinProblem(null);
    const done = await teams.join(code.trim());
    setJoining(false);
    if (done.ok) {
      setCode("");
      show(done.value);
    } else {
      setJoinProblem(done.problem);
    }
  }

  if (teams.shown.status === "off") {
    return (
      <Pressable
        style={styles.notice}
        onPress={onSignIn}
        accessibilityRole="button"
        testID="challenges-sign-in"
      >
        <Text style={styles.noticeText}>{t("Sign in to play with a team.")}</Text>
      </Pressable>
    );
  }
  if (teams.shown.status === "none") {
    return (
      <Text style={styles.muted} testID="challenges-none">
        {t("Teams are not on this server yet.")}
      </Text>
    );
  }
  if (open !== null) {
    const team =
      list.find((each) => each.id === open.teamId) ??
      teamOf(list, open.challengeId) ??
      open.team ??
      null;
    return (
      <TeamView
        key={`${open.teamId ?? ""}-${open.challengeId ?? ""}`}
        team={team}
        challengeId={open.challengeId}
        me={me}
        catalog={catalog}
        units={units}
        language={language}
        onBack={() => {
          setOpen(null);
          teams.reread();
        }}
        onRemove={teams.remove}
        onChanged={teams.reread}
        fetchFn={fetchFn}
        apiKey={apiKey}
        now={now}
      />
    );
  }
  return (
    <View style={styles.tab} testID="challenges-tab">
      <Text style={styles.heading}>{t("YOUR TEAMS")}</Text>
      {teams.shown.status === "loading" && (
        <ActivityIndicator color={color.textMuted} style={styles.wait} />
      )}
      {teams.shown.status === "failed" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{teams.shown.problem}</Text>
          <Pressable
            style={styles.button}
            onPress={teams.refresh}
            accessibilityRole="button"
            testID="challenges-retry"
          >
            <Text style={styles.buttonText}>{t("Try again")}</Text>
          </Pressable>
        </View>
      )}
      {teams.shown.status === "ready" && list.length === 0 && (
        <Text style={styles.muted} testID="challenges-empty">
          {t("No team yet. Create one, or join one with its code.")}
        </Text>
      )}
      {list.map((team) => {
        const shape = catalog?.shapes.find(
          (each) => each.id === team.challenge?.shape_id,
        );
        const summary =
          team.challenge === null
            ? t("No challenge yet")
            : `${shape === undefined ? team.challenge.shape_id : shapeNameIn(shape, language)} · ${t(
                "{done} of {total} pieces done",
                {
                  done: team.challenge.pieces.filter((piece) => piece.done).length,
                  total: team.challenge.pieces.length,
                },
              )}`;
        return (
          <Pressable
            key={team.id}
            style={styles.team}
            onPress={() => show(team)}
            accessibilityRole="button"
            accessibilityLabel={`${team.name}, ${tPlural(
              team.members.length,
              "{count} member",
              "{count} members",
            )}, ${summary}`}
            testID={`team-${team.id}`}
          >
            <Text style={styles.teamName} numberOfLines={1}>
              {team.name}
            </Text>
            <Text style={styles.teamLine}>
              {tPlural(team.members.length, "{count} member", "{count} members")}
            </Text>
            <Text style={styles.teamLine} numberOfLines={1}>
              {summary}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.heading}>{t("Create")}</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.field}
          value={name}
          onChangeText={setName}
          placeholder={t("Team name")}
          placeholderTextColor={color.textFaint}
          accessibilityLabel={t("Team name")}
          maxLength={40}
          editable={!creating}
          keyboardAppearance="dark"
          returnKeyType="done"
          onSubmitEditing={() => void create()}
          testID="team-name"
        />
        <Pressable
          style={[styles.button, (creating || name.trim() === "") && styles.off]}
          onPress={() => void create()}
          disabled={creating || name.trim() === ""}
          accessibilityRole="button"
          testID="team-create"
        >
          <Text style={styles.buttonText}>{t("Create")}</Text>
        </Pressable>
      </View>
      {createProblem !== null && (
        <Text
          style={styles.problem}
          accessibilityLiveRegion="polite"
          testID="create-problem"
        >
          {createProblem}
        </Text>
      )}

      <Text style={styles.heading}>{t("Join")}</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.field}
          value={code}
          onChangeText={setCode}
          placeholder={t("Team code")}
          placeholderTextColor={color.textFaint}
          accessibilityLabel={t("Team code")}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          editable={!joining}
          keyboardAppearance="dark"
          returnKeyType="done"
          onSubmitEditing={() => void join()}
          testID="team-code-field"
        />
        <Pressable
          style={[styles.button, (joining || code.trim() === "") && styles.off]}
          onPress={() => void join()}
          disabled={joining || code.trim() === ""}
          accessibilityRole="button"
          testID="team-join"
        >
          <Text style={styles.buttonText}>{t("Join")}</Text>
        </Pressable>
      </View>
      {joinProblem !== null && (
        <Text
          style={styles.problem}
          accessibilityLiveRegion="polite"
          testID="join-problem"
        >
          {joinProblem}
        </Text>
      )}
    </View>
  );
}

/** The team whose newest challenge is `challengeId`; null if none is. */
function teamOf(
  list: readonly GameTeam[],
  challengeId: string | null,
): GameTeam | null {
  if (challengeId === null) {
    return null;
  }
  return list.find((team) => team.challenge?.id === challengeId) ?? null;
}

const styles = StyleSheet.create({
  tab: {
    gap: space.sm,
  },
  heading: {
    marginTop: space.sm,
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wait: {
    marginVertical: space.sm,
  },
  notice: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    gap: space.sm,
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  noticeText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  muted: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  team: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    gap: 2,
  },
  teamName: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  teamLine: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  form: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  field: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    color: color.text,
    fontSize: fontSize.input,
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
  off: {
    opacity: 0.4,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
});
