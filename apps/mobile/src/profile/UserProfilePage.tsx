import type { FollowState, PublicProfile } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { accountProblem, NO_API, sessionEnded } from "../account/messages";
import type { Account } from "../account/useAccount";
import type { AccountOutcome } from "../api/accounts";
import { fetchProfile, profilePhotoUri } from "../api/profiles";
import { t, tLater, tPlural } from "../i18n";
import { MessageButton } from "../messages/MessageButton";
import { FollowButton } from "../social/FollowButton";
import { ReportMenu } from "../social/ReportMenu";
import { color, fontSize, space } from "../theme/tokens";
import { ProfileGallery } from "./ProfileGallery";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileStats, totalsOf } from "./ProfileStats";

type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

type Props = {
  /** The API the account talks to (ADR-0031); null if unknown. */
  apiUrl: string | null;
  account: Pick<Account, "state" | "sessionEnded">;
  /** The `public_id` of the profile: never the email or the internal id. */
  publicId: string;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** What the page shows of a profile asked for. */
type Shown =
  { kind: "ready"; profile: PublicProfile } | { kind: "failed"; problem: string };

/** The answer for one profile, asked with one token. */
type Answer = { asked: string; shown: Shown };

/** In English: shown with `t()` (TASK-210). */
export const SIGN_IN_TO_SEE = tLater("Log in to see the profiles of the others.");
export const NO_SUCH_PROFILE = tLater("This profile is not available.");

/** «12 drawings», «1 drawing». */
export function drawingsText(drawings: number): string {
  return tPlural(drawings, "{count} drawing", "{count} drawings");
}

/**
 * The line under the name: «12 drawings · 3 followers · 5 following». An
 * API older than TASK-211 has no numbers of who follows: the drawings only.
 */
export function profileDetail(
  profile: Pick<PublicProfile, "drawings" | "followers" | "following">,
): string {
  const { followers, following } = profile;
  if (followers === undefined || following === undefined) {
    return drawingsText(profile.drawings);
  }
  return [
    drawingsText(profile.drawings),
    tPlural(followers, "{count} follower", "{count} followers"),
    t("{count} following", { count: following }),
  ].join(" · ");
}

/** A profile that could not be shown, in words. */
export function profileViewProblem(failed: Failed): string {
  // Unknown, deleted, or an API older than TASK-116 that has no profiles.
  if (failed.kind === "api_error" && failed.code === "http_error") {
    return t(NO_SUCH_PROFILE);
  }
  return accountProblem(failed);
}

/**
 * Another member's profile, read only (TASK-116, ADR-0128): the picture,
 * the name, the bio and how many drawings they published, and under them
 * the drawings (TASK-117). Never the email: the API does not send it.
 * It opens from the search of «Feed» (TASK-215) and from the lists of who
 * follows (TASK-211). Under the name, how many follow it and the button to
 * follow it, which asks: the other accepts or declines (ADR-0173). Its
 * «…» reports the member or blocks it (TASK-121, ADR-0228); blocked, the
 * page says so and shows the profile no more. «Message» opens the
 * conversation with them (TASK-319). Under the top, its totals and its
 * drawings and photos (TASK-324).
 */
export function UserProfilePage({ apiUrl, account, publicId, fetchFn, apiKey }: Props) {
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const asked = `${token ?? ""} ${publicId}`;
  const [answer, setAnswer] = useState<Answer | null>(null);
  // What the button changed since the profile came, for that profile only.
  const [changed, setChanged] = useState<{ asked: string; follow: FollowState } | null>(
    null,
  );
  // The profile just blocked from its «…» (TASK-121): it shows no more.
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    if (token === null || apiUrl === null) {
      return;
    }
    let live = true;
    void fetchProfile(apiUrl, token, publicId, { fetchFn, key: apiKey }).then(
      (outcome) => {
        if (!live) {
          return;
        }
        if (outcome.kind === "ok") {
          setAnswer({ asked, shown: { kind: "ready", profile: outcome.value } });
          return;
        }
        setAnswer({
          asked,
          shown: { kind: "failed", problem: profileViewProblem(outcome) },
        });
        if (sessionEnded(outcome)) {
          onSessionEnded(token);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, asked, fetchFn, onSessionEnded, publicId, token]);

  if (token === null) {
    return <Text style={styles.message}>{t(SIGN_IN_TO_SEE)}</Text>;
  }
  if (apiUrl === null) {
    return <Text style={styles.message}>{t(NO_API)}</Text>;
  }
  const shown = answer !== null && answer.asked === asked ? answer.shown : null;
  if (shown === null) {
    return <Text style={styles.message}>{t("Loading the profile…")}</Text>;
  }
  if (shown.kind === "failed") {
    return <Text style={[styles.message, styles.problem]}>{shown.problem}</Text>;
  }
  const { profile } = shown;
  if (blocked === asked) {
    return (
      <Text style={styles.message} accessibilityLiveRegion="polite">
        {t("You blocked {user}. Unblock them from Blocked people in your profile.", {
          user: profile.username,
        })}
      </Text>
    );
  }
  const follow =
    changed !== null && changed.asked === asked ? changed.follow : profile.follow;
  // Who stops following is one follower less, before the API is asked again.
  const left = profile.follow === "following" && follow !== "following" ? 1 : 0;
  const own =
    state.status === "signedIn" && state.session.user.public_id === profile.public_id;
  // An API older than TASK-324 has no totals: no row.
  const totals = totalsOf(profile);
  return (
    <View style={styles.page}>
      <View style={styles.top}>
        <ProfileHeader
          username={profile.username}
          bio={profile.bio}
          photo={profilePhotoUri(profile)}
          winner={(profile.contest_wins ?? 0) > 0}
          badges={profile.badges ?? null}
          detail={profileDetail({
            ...profile,
            followers:
              profile.followers === undefined
                ? undefined
                : Math.max(0, profile.followers - left),
          })}
        />
        {/* An API older than TASK-211 says nothing of following: no button. */}
        {follow !== undefined && !own && (
          <FollowButton
            apiUrl={apiUrl}
            token={token}
            publicId={profile.public_id}
            username={profile.username}
            follow={follow}
            onFollow={(next) => setChanged({ asked, follow: next })}
            onSessionEnded={onSessionEnded}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
        )}
        {!own && (
          <MessageButton
            person={{
              public_id: profile.public_id,
              username: profile.username,
              photo: null,
            }}
          />
        )}
        {/* An API older than following is older than blocking too. */}
        {follow !== undefined && !own && (
          <View style={styles.menu}>
            <ReportMenu
              apiUrl={apiUrl}
              token={token}
              target={{ kind: "user", id: profile.public_id }}
              person={profile}
              onBlocked={() => setBlocked(asked)}
              onSessionEnded={onSessionEnded}
              fetchFn={fetchFn}
              apiKey={apiKey}
            />
          </View>
        )}
      </View>
      {totals !== null && <ProfileStats totals={totals} />}
      <ProfileGallery
        publicId={profile.public_id}
        own={false}
        photos={totals !== null}
        apiUrl={apiUrl}
        token={token}
        onSessionEnded={onSessionEnded}
        fetchFn={fetchFn}
        apiKey={apiKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: space.lg,
  },
  // As the top of one's own «Profile» (ProfileHome.tsx).
  top: {
    gap: space.md,
  },
  // The «…» of the profile (TASK-121), at the right under the button.
  menu: {
    alignItems: "flex-end",
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  problem: {
    color: color.error,
  },
});
