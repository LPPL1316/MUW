-- The VO₂ max on the profile (TASK-397, ADR-0332, docs/DATABASE.md). A
-- migration already in main is never edited: write the next one.

-- One row per account that answered «Show your VO₂ max?»: `show` is the
-- owner's yes, off until given. Only with it on does the phone send the
-- last value Apple Health or Health Connect holds (vo2max.py), and only
-- the day it was measured, never the hour; turning it off takes the value
-- away. Without a value the profile shows the estimate from the running
-- bests (vo2max_estimate.py), worked out on every read and never kept.
CREATE TABLE vo2max (
    user_id bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    show boolean NOT NULL DEFAULT false,
    -- Millilitres of oxygen per kilogram per minute.
    value double precision CHECK (value IS NULL OR value BETWEEN 10 AND 90),
    source text CHECK (source IS NULL OR source IN ('apple_health', 'health_connect')),
    measured_on date,
    -- A value comes with its source and its day, and only with the yes.
    CHECK ((value IS NULL) = (source IS NULL)),
    CHECK ((value IS NULL) = (measured_on IS NULL)),
    CHECK (show OR value IS NULL)
);
