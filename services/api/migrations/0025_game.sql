-- The shape game, part A: what each run is worth and the shapes an account
-- collected (TASK-296, ADR-0255, docs/GIOCO.md, docs/DATABASE.md). A
-- migration already in main is never edited: write the next one.

-- One row per saved run, written by the API right after the run
-- (game.py), or by game_backfill.py for the runs saved before the game and
-- again whenever the rules change (rules_version). Deleting the run deletes
-- it, and its metres leave the totals; deleting the account deletes it.
CREATE TABLE game_runs (
    run_id bigint PRIMARY KEY REFERENCES runs (id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- game_rules.RULES_VERSION when it was computed.
    rules_version smallint NOT NULL CHECK (rules_version >= 1),
    counted boolean NOT NULL,
    -- Why it does not count, or counts less: a run by bike or paddling, a
    -- vehicle's speeds, another run of the same time, the day's cap.
    reason text CHECK (reason IN ('not_running', 'vehicle', 'overlap', 'daily_cap')),
    -- The metres that count, after the vehicle's stretches and the cap.
    counted_m integer NOT NULL CHECK (counted_m >= 0),
    -- The best moving seconds over 1000, 5000, 10000 and 21097 metres the
    -- run covered: {"1000": 287.4}. Empty for a run that does not count.
    best_s jsonb NOT NULL DEFAULT '{}',
    -- The run's first and last fix: two runs of an account that share some
    -- time count once.
    started_at timestamptz NOT NULL,
    ended_at timestamptz NOT NULL,
    CHECK (ended_at >= started_at),
    CHECK (counted OR counted_m = 0)
);

-- The runs of an account: its totals, the overlaps and the day's cap.
CREATE INDEX game_runs_user_idx ON game_runs (user_id, started_at);

-- The shapes an account owns. A shape stays once unlocked: deleting the
-- run that unlocked it keeps the row, without the run. Deleting the account
-- deletes them. 'team' is the edition of a challenge completed together
-- (part C).
CREATE TABLE game_unlocks (
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- An id of game_catalog.py.
    shape_id text NOT NULL CHECK (length(shape_id) BETWEEN 1 AND 40),
    edition text NOT NULL DEFAULT 'solo' CHECK (edition IN ('solo', 'team')),
    unlocked_at timestamptz NOT NULL,
    run_id bigint REFERENCES runs (id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, shape_id, edition)
);
