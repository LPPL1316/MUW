-- The lifts taken and the pistes skied in a day of skiing, by name
-- (TASK-375 part D2, ADR-0319, docs/DATABASE.md). A migration already in
-- main is never edited: write the next one.

-- Found by the API once, when the day is saved, from the lifts and pistes
-- of OpenStreetMap in its cache (ski_names.py): {"lifts": [...], "pistes":
-- [...]}, each {"name", "type", "times"}, in the order of the day. NULL for
-- any other activity, and for a day saved without the ski tiles; two empty
-- lists for a day where none was found. It needs nothing of 0047.
ALTER TABLE runs ADD COLUMN ski_names jsonb
    CHECK (ski_names IS NULL OR jsonb_typeof(ski_names) = 'object');
