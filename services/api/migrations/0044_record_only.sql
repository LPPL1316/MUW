-- The activities recorded without a shape join the runs (TASK-375, ADR-0319,
-- docs/DATABASE.md): a day of alpine skiing is saved as 'skiing', one of
-- cross-country skiing as 'xc_skiing'. Favorites and group runs keep a route
-- to do again, and these have none: their checks stay as they are.
--
-- The check of runs is read back and widened, not written out again: the
-- activities a migration before this one added (0043 walking, TASK-371)
-- stay, whatever the order the two enter main in. What is saved keeps its
-- activity.
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
    -- Written back as a list of quoted names, as the checks before it, so
    -- that the next migration reads it the same way.
    ALTER TABLE runs DROP CONSTRAINT runs_activity_check;
    EXECUTE format(
        'ALTER TABLE runs ADD CONSTRAINT runs_activity_check'
        ' CHECK (activity IN (%s))',
        (SELECT string_agg(quote_literal(name), ', ' ORDER BY position)
           FROM (SELECT name, min(position) AS position
                   FROM unnest(kept || ARRAY['skiing', 'xc_skiing'])
                        WITH ORDINALITY AS listed(name, position)
                  GROUP BY name) AS once)
    );
END
$$;
