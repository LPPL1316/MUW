-- The metres a run climbed, for the totals of the profile (TASK-311,
-- ADR-0271, docs/DATABASE.md). A migration already in main is never edited:
-- write the next one.

-- Counted by the API from the heights the app sends with the fixes
-- (run_climb.py). NULL for a run saved before, or without heights: the
-- totals leave it out, they never guess it.
ALTER TABLE runs ADD COLUMN climb_m integer CHECK (climb_m >= 0);
