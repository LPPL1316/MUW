import type { PublicProfile } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import { fetchProfile } from "../api/profiles";
import { decimal, t } from "../i18n";
import { useFollowsDoor } from "../social/followsDoor";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import { inUnits } from "../units/format";
import type { Units } from "../units/units";
import { useUnits } from "../units/useUnits";

/** The totals of a profile (TASK-324), as GET /users/{public_id} answers. */
export type ProfileTotals = Required<
  Pick<PublicProfile, "distance_m" | "climb_m" | "reactions">
>;

/** The totals of `profile`; null from an API older than TASK-324. */
export function totalsOf(profile: PublicProfile): ProfileTotals | null {
  const { distance_m, climb_m, reactions } = profile;
  if (distance_m === undefined || climb_m === undefined || reactions === undefined) {
    return null;
  }
  return { distance_m, climb_m, reactions };
}

/** From this many units the distance is whole: «412», not «412.3». */
const WHOLE_FROM = 100;

/** «42.3» under a hundred kilometres (or miles), «412» from there. */
export function totalDistanceNumber(metres: number, units: Units): string {
  const total = inUnits(Math.max(0, metres), units);
  // As it would be written with its decimal: 99.97 is «100», not «100.0».
  return Math.round(total * 10) / 10 < WHOLE_FROM
    ? decimal(total)
    : String(Math.round(total));
}

type Props = { totals: ProfileTotals };

/**
 * The totals of a profile (TASK-324, ADR-0284), in a row of three: how far
 * it went in all its runs, private ones too (the user's choice), how many
 * metres it climbed, and how many reactions its drawings received. The
 * distance in the app's units; the climb in metres, as on the run's screen.
 */
export function ProfileStats({ totals }: Props) {
  const units = useUnits();
  return (
    <View style={styles.row} testID="profile-stats">
      <Stat
        label={t("Distance")}
        value={totalDistanceNumber(totals.distance_m, units)}
        unit={units}
      />
      <Stat label={t("Elev. gain")} value={String(totals.climb_m)} unit="m" />
      <Stat label={t("Likes")} value={String(totals.reactions)} />
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const said = unit === undefined ? value : `${value} ${unit}`;
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}, ${said}`}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit !== undefined && <Text style={styles.unit}> {unit}</Text>}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The totals of one's own «Profile»: as the others see them, from GET
 * /users/{public_id} with the account's token. Null while they come, and
 * from an API older than TASK-324.
 */
export function useOwnTotals(
  publicId: string | null,
  { fetchFn, apiKey }: { fetchFn?: typeof fetch; apiKey?: string | null } = {},
): ProfileTotals | null {
  const { apiUrl, account } = useFollowsDoor();
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const asked = `${token ?? ""} ${publicId ?? ""}`;
  // The totals of one account and token: another's are not these.
  const [answer, setAnswer] = useState<{
    asked: string;
    totals: ProfileTotals | null;
  } | null>(null);

  useEffect(() => {
    if (token === null || apiUrl === null || publicId === null) {
      return;
    }
    let live = true;
    void fetchProfile(apiUrl, token, publicId, { fetchFn, key: apiKey }).then(
      (outcome) => {
        if (!live) {
          return;
        }
        if (outcome.kind === "ok") {
          setAnswer({ asked, totals: totalsOf(outcome.value) });
        } else if (sessionEnded(outcome)) {
          onSessionEnded(token);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, asked, fetchFn, onSessionEnded, publicId, token]);

  return answer !== null && answer.asked === asked ? answer.totals : null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  value: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  unit: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
});
