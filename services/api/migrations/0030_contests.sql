-- The contests: for a period the posts for everyone race, and the one with
-- the most reactions wins a prize without money value (TASK-299, ADR-0260,
-- docs/CONCORSI.md, docs/DATABASE.md). A migration already in main is never
-- edited: write the next one.

-- One row per contest. Who takes part and who leads is never written: it
-- is read from drawings and reactions as they are (contests.py). The
-- winner is written once, by the `close` command, with closed_at; a run
-- deleted takes the drawing and leaves the account's win (the badge counts
-- winner_user_id); an account deleted leaves the contest without a winner.
CREATE TABLE contests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    winner_drawing_id uuid REFERENCES drawings (id) ON DELETE SET NULL,
    winner_user_id bigint REFERENCES users (id) ON DELETE SET NULL,
    -- When the winner was proclaimed; NULL while the contest is open.
    closed_at timestamptz,
    -- When it was opened.
    created_at timestamptz NOT NULL,
    CHECK (ends_at > starts_at),
    -- No winner while open.
    CHECK (closed_at IS NOT NULL
        OR (winner_user_id IS NULL AND winner_drawing_id IS NULL))
);

-- One open contest at a time: a second INSERT with closed_at NULL fails.
-- (A unique index on closed_at itself would not do: NULLs never collide.)
CREATE UNIQUE INDEX contests_one_open_idx ON contests ((TRUE))
    WHERE closed_at IS NULL;

-- The wins of an account (contest_wins in the profiles), and the contest
-- the winner's drawing won.
CREATE INDEX contests_winner_user_idx ON contests (winner_user_id);
CREATE INDEX contests_winner_drawing_idx ON contests (winner_drawing_id);
