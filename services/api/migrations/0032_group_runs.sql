-- Group runs: a member publishes a route with a day, a time and where
-- exactly to meet at its start, and the others say «I'm going» (TASK-309,
-- ADR-0269, docs/EVENTI.md §12, docs/DATABASE.md). A migration already in
-- main is never edited: write the next one.

-- One row per group run. The route is a copy, whole, with the fields a
-- favorite keeps (0002 and after): it never changes after the creation.
-- The organiser goes always and has no row in group_run_going.
CREATE TABLE group_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
    starts_at timestamptz NOT NULL,
    -- «Where exactly» at the start: one line, NULL without.
    meeting_note text CHECK (length(meeting_note) BETWEEN 1 AND 80),
    description text CHECK (length(description) BETWEEN 1 AND 500),
    visibility text NOT NULL CHECK (visibility IN ('everyone', 'followers')),
    -- The route, as favorites keep it.
    activity text NOT NULL CHECK (activity IN ('running', 'cycling', 'paddling')),
    city text NOT NULL CHECK (length(city) <= 80),
    shape text CHECK (length(shape) <= 40),
    word text CHECK (length(word) <= 40),
    style text CHECK (style IN ('round', 'block')),
    distance_m integer NOT NULL CHECK (distance_m > 0),
    route_m integer NOT NULL CHECK (route_m > 0),
    similarity real NOT NULL CHECK (similarity BETWEEN 0 AND 1),
    -- WGS84, points as (lon, lat), as PostGIS wants them.
    line geometry(LineString, 4326) NOT NULL,
    walks jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(walks) = 'array'),
    on_foot jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(on_foot) = 'array'),
    rotation_deg real,
    -- The meeting point: the first point of the line, for the 50 km of the
    -- Feed's row.
    start geography(Point, 4326) NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    -- When the organiser cancelled it; NULL while it holds.
    cancelled_at timestamptz,
    -- When the reminder an hour before went out (group_runs.GroupRunClock);
    -- NULL again after a change of time or place.
    reminded_at timestamptz,
    -- Hidden by whoever runs MuW, from a report's email (TASK-291).
    hidden_at timestamptz
);

-- The Feed's row and the clock: the group runs not cancelled, by their day.
CREATE INDEX group_runs_starts_idx ON group_runs (starts_at)
    WHERE cancelled_at IS NULL;
-- The Feed's row: the ones starting within 50 km of the phone.
CREATE INDEX group_runs_start_idx ON group_runs USING GIST (start);
-- A profile's group runs, and the 10 upcoming of an account.
CREATE INDEX group_runs_owner_idx ON group_runs (owner_id, starts_at DESC);

-- Who said «I'm going»; «Not going» deletes the row.
CREATE TABLE group_run_going (
    group_run_id uuid NOT NULL REFERENCES group_runs (id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (group_run_id, user_id)
);

-- The group runs an account goes to, for the Feed's row.
CREATE INDEX group_run_going_user_idx ON group_run_going (user_id);

-- A group run is reported as a post is (TASK-121, TASK-291).
ALTER TABLE reports
    DROP CONSTRAINT reports_kind_check,
    ADD CONSTRAINT reports_kind_check
        CHECK (kind IN ('drawing', 'comment', 'user', 'group_run'));
