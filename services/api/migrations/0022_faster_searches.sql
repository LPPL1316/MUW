-- Faster searches (TASK-288, ADR-0249, docs/DATABASE.md). A migration
-- already in main is never edited: write the next one.

-- «Find friends» looks for a part of a name anywhere in it (follows.py,
-- lower(username) LIKE '%q%'). The trigrams of the names answer it from an
-- index, without reading every account, from three letters typed. pg_trgm
-- comes with PostgreSQL, in the postgis image too.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX users_username_trgm_idx
    ON users USING gin (lower(username) gin_trgm_ops);

-- The preview of a drawing's cut track, as recommended.preview makes it from
-- the whole line: at most 64 of its points, evenly spread by index, the first
-- and the last kept. The feed and the profiles read this instead of the
-- whole track, which a run of an hour has thousands of points of, and the
-- feed asks it whether a drawing is near the phone. The search path is
-- written out: a restore of a copy runs this with an empty one.
CREATE FUNCTION drawing_preview(track geometry) RETURNS geometry
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path = public
AS $$
    SELECT CASE
        WHEN track IS NULL OR ST_NPoints(track) <= 64 THEN track
        ELSE ST_MakeLine(ARRAY(
            SELECT ST_PointN(
                track, 1 + round(i * ((ST_NPoints(track) - 1)::float8 / 63))::int
            )
            FROM generate_series(0, 63) AS i
            ORDER BY i
        ))
    END
$$;

-- Made by PostgreSQL whenever the track is written, and now for the
-- drawings already there.
ALTER TABLE drawings
    ADD COLUMN preview geometry(LineString, 4326)
        GENERATED ALWAYS AS (drawing_preview(track)) STORED;

-- The drawings the others may see, the last published first: the feed's
-- order (feed.py).
CREATE INDEX drawings_published_idx
    ON drawings (published_at DESC, id DESC)
    WHERE visibility <> 'only_me';
