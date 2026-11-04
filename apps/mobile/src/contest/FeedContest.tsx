import type { Contest, ContestMine, FeedPost } from "@shaperoute/shared-types";

import { themedOf } from "./contestApi";
import { ContestCard, SeeChallenge } from "./ContestCard";
import { WinnerCard } from "./WinnerCard";

type Props = {
  contest: Contest;
  mine: ContestMine | null | undefined;
  /** How wide the posts of «Feed» are. */
  width: number;
  /** Opens a drawing as a post of «Feed»; left out with nobody signed in. */
  onOpen?: (drawing: FeedPost) => void;
};

/**
 * What «Feed» shows of the contest, under the lens (TASK-299 part B): the
 * card while it runs; once its winner is proclaimed, the winning post. A
 * contest closed without a winner, or whose winning run was deleted, shows
 * nothing. A monthly challenge keeps the way to its page for that week
 * (TASK-343 part B), with or without a winner.
 */
export function FeedContest({ contest, mine, width, onOpen }: Props) {
  if (contest.closed_at === null) {
    return <ContestCard contest={contest} mine={mine} onOpen={onOpen} />;
  }
  const drawing = contest.winner?.drawing ?? null;
  const see =
    themedOf(contest) === null ? null : <SeeChallenge contestId={contest.id} />;
  if (drawing === null) {
    return see;
  }
  return (
    <>
      <WinnerCard
        drawing={drawing}
        width={width}
        onOpen={onOpen === undefined ? undefined : () => onOpen(drawing)}
      />
      {see}
    </>
  );
}
