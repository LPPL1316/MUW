-- The metres a run climbed, for the totals of the profile (TASK-324,
-- ADR-0284, docs/DATABASE.md). A migration already in main is never edited:
-- write the next one.

-- Counted by the API from the heights the app sends with the fixes
-- (run_climb.py). NULL for a run saved before, or without heights: the
-- totals leave it out, they never guess it.
--
-- IF NOT EXISTS: this same change reached the two repositories under other
-- names while they were divergent (0034_run_climb in MUW's main,
-- 0035_run_climb in shaperoute's, TASK-325). A database that applied one of
-- them has the column and not this version: here nothing happens, and the
-- version is recorded.
ALTER TABLE runs ADD COLUMN IF NOT EXISTS climb_m integer CHECK (climb_m >= 0);
