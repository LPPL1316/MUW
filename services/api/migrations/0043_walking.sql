-- Walking joins the activities of the API (TASK-371 part A, ADR-0315,
-- docs/DATABASE.md). A migration already in main is never edited: write the
-- next one, and take the first number free in main when this one enters.

-- The checks of 0040 list the activities of the API (walking.API_ACTIVITIES):
-- a walk is kept as a favorite, saved as a run and proposed as a group run as
-- 'walking'. It is drawn as a run on the same roads; what is kept keeps its
-- activity.
ALTER TABLE favorites
    DROP CONSTRAINT favorites_activity_check,
    ADD CONSTRAINT favorites_activity_check
        CHECK (activity IN ('running', 'cycling', 'paddling', 'swimming', 'walking'));

ALTER TABLE runs
    DROP CONSTRAINT runs_activity_check,
    ADD CONSTRAINT runs_activity_check
        CHECK (activity IN ('running', 'cycling', 'paddling', 'swimming', 'walking'));

ALTER TABLE group_runs
    DROP CONSTRAINT group_runs_activity_check,
    ADD CONSTRAINT group_runs_activity_check
        CHECK (activity IN ('running', 'cycling', 'paddling', 'swimming', 'walking'));
