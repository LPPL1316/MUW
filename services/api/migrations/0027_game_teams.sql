-- The shape game, part C: the teams, and the challenges they draw together
-- (TASK-296, ADR-0255, docs/GIOCO.md §6–§7, docs/DATABASE.md). A migration
-- already in main is never edited: write the next one.

-- A team is found only by its invite code, never in a search. owner_id is
-- the member who may remove the others: when the owner leaves or deletes
-- the account, the API hands the team to its oldest member
-- (game_teams.py), and a team left without members is deleted.
CREATE TABLE game_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    -- Six of A–Z and 2–9, without I, O, 0 and 1.
    invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
    owner_id bigint REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL
);

-- Who is in which team; deleting the account takes its rows.
CREATE TABLE game_team_members (
    team_id uuid NOT NULL REFERENCES game_teams (id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL,
    PRIMARY KEY (team_id, user_id)
);

-- The teams of an account.
CREATE INDEX game_team_members_user_idx ON game_team_members (user_id);

-- A shape of the catalog the team draws in pieces before ends_at; a run
-- started before ends_at still counts if saved within three hours after
-- (game_challenges.py). One at a time per team: active until completed, or
-- until those three hours are over. The team keeps it when its creator
-- leaves or deletes the account.
CREATE TABLE game_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES game_teams (id) ON DELETE CASCADE,
    -- An id of game_catalog.py.
    shape_id text NOT NULL CHECK (length(shape_id) BETWEEN 1 AND 40),
    created_by bigint REFERENCES users (id) ON DELETE SET NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    completed_at timestamptz,
    -- When the members were told «1 day left» (push challenge_ending).
    ending_told_at timestamptz,
    CHECK (ends_at > starts_at)
);

-- The challenges of a team, the latest first.
CREATE INDEX game_challenges_team_idx ON game_challenges (team_id, starts_at DESC);

-- The pieces of a challenge: idx from 0, the outline cut by
-- game_rules.pieces_of. A distance piece asks required_m metres; a fast
-- piece asks fast_distance_m in one run under max_pace_s a kilometre. The
-- holder is the member running it; a piece left goes back free with its
-- metres. Deleting the holder's account frees the piece (SET NULL).
CREATE TABLE game_pieces (
    challenge_id uuid NOT NULL REFERENCES game_challenges (id) ON DELETE CASCADE,
    idx smallint NOT NULL CHECK (idx >= 0),
    required_m integer CHECK (required_m > 0),
    fast_distance_m integer CHECK (fast_distance_m > 0),
    max_pace_s integer CHECK (max_pace_s > 0),
    holder_id bigint REFERENCES users (id) ON DELETE SET NULL,
    held_at timestamptz,
    done_m integer NOT NULL DEFAULT 0 CHECK (done_m >= 0),
    done_at timestamptz,
    PRIMARY KEY (challenge_id, idx),
    CHECK ((required_m IS NULL) <> (fast_distance_m IS NULL)),
    CHECK ((fast_distance_m IS NULL) = (max_pace_s IS NULL)),
    CHECK (holder_id IS NULL OR held_at IS NOT NULL)
);

-- The pieces a member holds.
CREATE INDEX game_pieces_holder_idx ON game_pieces (holder_id);

-- What each run gave to a piece: who, how many metres, when. Deleting the
-- account deletes its rows (the piece keeps its metres); deleting the run
-- keeps the row without the run.
CREATE TABLE game_contributions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    challenge_id uuid NOT NULL,
    piece_idx smallint NOT NULL,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    run_id bigint REFERENCES runs (id) ON DELETE SET NULL,
    metres integer NOT NULL CHECK (metres >= 0),
    at timestamptz NOT NULL,
    FOREIGN KEY (challenge_id, piece_idx)
        REFERENCES game_pieces (challenge_id, idx) ON DELETE CASCADE
);

-- The contributions of a piece, and those of a run (GET /game/runs/{key}).
CREATE INDEX game_contributions_piece_idx ON game_contributions (challenge_id, piece_idx);
CREATE INDEX game_contributions_run_idx ON game_contributions (run_id);

-- The team edition of a shape says which challenge gave it; the shape
-- stays when the challenge goes.
ALTER TABLE game_unlocks
    ADD COLUMN challenge_id uuid REFERENCES game_challenges (id) ON DELETE SET NULL;
