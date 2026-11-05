-- A workout at the gym (TASK-385, ADR-0327, docs/DATABASE.md): a run of
-- the activity 'gym', with no track, its sets in a table of its own. A
-- migration already in main is never edited: write the next one.

-- 'gym' joins the activities of runs. The check is read back and widened,
-- not written out again, as 0044 does: the activities before stay.
DO $$
DECLARE
    kept text[];
BEGIN
    SELECT array_agg(quoted.value[1])
      INTO kept
      FROM pg_constraint,
           regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''', 'g')
               AS quoted(value)
     WHERE conname = 'runs_activity_check';
    IF kept IS NULL THEN
        RAISE EXCEPTION 'runs_activity_check lists no activity';
    END IF;
    ALTER TABLE runs DROP CONSTRAINT runs_activity_check;
    EXECUTE format(
        'ALTER TABLE runs ADD CONSTRAINT runs_activity_check'
        ' CHECK (activity IN (%s))',
        (SELECT string_agg(quote_literal(name), ', ' ORDER BY position)
           FROM (SELECT name, min(position) AS position
                   FROM unnest(kept || ARRAY['gym'])
                        WITH ORDINALITY AS listed(name, position)
                  GROUP BY name) AS once)
    );
END
$$;

-- Only a workout at the gym goes without a track; every other run keeps
-- the one it always had.
ALTER TABLE runs ALTER COLUMN track DROP NOT NULL;
ALTER TABLE runs
    ADD CONSTRAINT runs_track_check CHECK (track IS NOT NULL OR activity = 'gym');

-- A drawing others see had to have a track (0014). One of a run without a
-- track is published with none: `trackless` says so, and the API sets it
-- from the run (drawings.py). A drawing with a track is never trackless.
ALTER TABLE drawings
    ADD COLUMN trackless boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT drawings_trackless_check CHECK (NOT trackless OR track IS NULL);
DO $$
DECLARE
    named text;
BEGIN
    SELECT conname
      INTO named
      FROM pg_constraint
     WHERE conrelid = 'drawings'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%track IS NOT NULL%'
       AND pg_get_constraintdef(oid) LIKE '%only_me%';
    IF named IS NULL THEN
        RAISE EXCEPTION 'drawings has no check of its track';
    END IF;
    EXECUTE format('ALTER TABLE drawings DROP CONSTRAINT %I', named);
END
$$;
ALTER TABLE drawings
    ADD CONSTRAINT drawings_track_check
        CHECK (visibility = 'only_me' OR track IS NOT NULL OR trackless);

-- What a workout keeps besides its run: whether its post shows the
-- exercises, and its rests summed (each rest stays on the phone).
CREATE TABLE gym_sessions (
    run_id bigint PRIMARY KEY REFERENCES runs (id) ON DELETE CASCADE,
    show_exercises boolean NOT NULL DEFAULT true,
    rests smallint NOT NULL DEFAULT 0 CHECK (rests BETWEEN 0 AND 1000),
    rest_s integer NOT NULL DEFAULT 0 CHECK (rest_s BETWEEN 0 AND 86400)
);

-- The sets of a workout, in their order. An exercise of the catalog
-- (gym-exercises.json) has its key; one the runner named has its name.
-- The fields are those of its kind (gym_catalog.py checks them): kg of a
-- dumbbell per hand, metres and seconds of a cardio block. `at_s` is when
-- it was logged, in seconds of the workout; `live` whether during it.
CREATE TABLE gym_sets (
    run_id bigint NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    n smallint NOT NULL CHECK (n BETWEEN 1 AND 500),
    exercise text CHECK (exercise ~ '^[a-z0-9_]{1,40}$'),
    name text CHECK (length(name) BETWEEN 1 AND 40),
    kind text NOT NULL CHECK (kind IN ('load', 'bodyweight', 'timed', 'cardio')),
    reps integer CHECK (reps BETWEEN 1 AND 10000),
    load_kg numeric(6, 2) CHECK (load_kg BETWEEN 0 AND 2000),
    duration_s integer CHECK (duration_s BETWEEN 1 AND 86400),
    distance_m integer CHECK (distance_m BETWEEN 0 AND 1000000),
    speed_kmh numeric(4, 1) CHECK (speed_kmh BETWEEN 0 AND 60),
    incline_pct numeric(4, 1) CHECK (incline_pct BETWEEN -10 AND 40),
    level smallint CHECK (level BETWEEN 1 AND 100),
    floors smallint CHECK (floors BETWEEN 0 AND 10000),
    at_s integer NOT NULL CHECK (at_s BETWEEN 0 AND 86400),
    live boolean NOT NULL,
    PRIMARY KEY (run_id, n),
    CHECK ((exercise IS NULL) <> (name IS NULL))
);
