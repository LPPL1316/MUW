import type { GameTeam } from "@shaperoute/shared-types";
import { Share } from "react-native";

import { t } from "../i18n";

/**
 * «Share code» (TASK-296 part D, docs/GIOCO.md §9): the phone's share
 * sheet with a sentence that carries the team's name and its code, for a
 * message to whoever should join. Text only: the sheet of the pictures
 * (`share/sharePicture`) and the run's video are for a run. Resolves when
 * the sheet closes, false when the phone could not open it.
 */
export async function shareTeamCode(
  team: Pick<GameTeam, "name" | "code">,
): Promise<boolean> {
  try {
    await Share.share({ message: inviteText(team) });
    return true;
  } catch {
    return false;
  }
}

/** What the message says. */
export function inviteText(team: Pick<GameTeam, "name" | "code">): string {
  return t(
    "Join my team «{name}» on MuW: open Play, Challenges, and enter the code {code}.",
    {
      name: team.name,
      code: team.code,
    },
  );
}
