-- Where a run comes from (TASK-312 part A, ADR-0272, docs/IMPORTAZIONI.md,
-- docs/DATABASE.md). A migration already in main is never edited: write the
-- next one.

ALTER TABLE runs
    -- `muw`: recorded by the app. `file`: a GPX, TCX or FIT file of another
    -- app, read on the phone and saved with the same PUT. Only `muw` runs
    -- count for the shape game and the contest. The app says it, as it says
    -- the positions: not a proof. The runs saved before are all `muw`.
    -- Apple Health and the providers add their own values later (parts D, E).
    ADD COLUMN source text NOT NULL DEFAULT 'muw'
        CHECK (source IN ('muw', 'file'));
