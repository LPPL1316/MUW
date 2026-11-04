-- The bests of each run, for the personal bests of the profile (TASK-368,
-- ADR-0312, docs/DATABASE.md). A migration already in main is never edited:
-- write the next one.

-- The fastest moving seconds over each distance the run covers, counted by
-- the API when the run is saved (personal_bests.py), for both sports
-- whatever the run was: the profile reads those of the sport it is now.
-- Deleting the run deletes them, and the next best is the profile's. The
-- runs saved before are counted once by `python -m
-- shaperoute_api.personal_bests_backfill`.
CREATE TABLE run_bests (
    run_id bigint NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    sport text NOT NULL CHECK (sport IN ('running', 'cycling')),
    -- The name of the distance: 5k, half, marathon, 160k.
    distance text NOT NULL CHECK (length(distance) <= 20),
    seconds integer NOT NULL CHECK (seconds > 0),
    PRIMARY KEY (run_id, sport, distance)
);
