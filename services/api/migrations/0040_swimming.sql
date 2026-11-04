-- Swimming joins the activities of the API (TASK-323 part B, ADR-0283,
-- docs/DATABASE.md). A migration already in main is never edited: write the
-- next one, and take the first number free in main when this one enters.

-- The checks of 0010, 0014 and 0032 list the activities of the API
-- (SUPPORTED_ACTIVITIES): a swim is kept as a favorite, saved as a run and
-- proposed as a group run as 'swimming'. What is kept keeps its activity.
ALTER TABLE favorites
    DROP CONSTRAINT favorites_activity_check,
    ADD CONSTRAINT favorites_activity_check
        CHECK (activity IN ('running', 'cycling', 'paddling', 'swimming'));

ALTER TABLE runs
    DROP CONSTRAINT runs_activity_check,
    ADD CONSTRAINT runs_activity_check
        CHECK (activity IN ('running', 'cycling', 'paddling', 'swimming'));

ALTER TABLE group_runs
    DROP CONSTRAINT group_runs_activity_check,
    ADD CONSTRAINT group_runs_activity_check
        CHECK (activity IN ('running', 'cycling', 'paddling', 'swimming'));
