-- Where the engine placed each route kept (TASK-297 part A2, ADR-0256,
-- docs/DATABASE.md): after the engine changes, the route is drawn again
-- from there. A migration already in main is never edited: write the
-- next one.

-- The placement of the search near the start that drew the route
-- (optimizer.Placement, and Attempt.scale_m): the point the shape starts
-- from (the start asked for, or one 250-500 m away where it closes on the
-- roads) and how far it is, the turn, where along the shape the route
-- enters it, and the metres of a unit of the normalized shape. Double
-- precision: the same numbers draw the same route. None for a route from
-- a nearby start or 2 km away, on the water, or kept before: those are
-- drawn again as before, from the start.
ALTER TABLE drawn_routes
    ADD COLUMN placed_start geography(Point, 4326),
    ADD COLUMN offset_m double precision CHECK (offset_m >= 0),
    ADD COLUMN rotation_deg double precision,
    ADD COLUMN phase double precision CHECK (phase >= 0 AND phase < 1),
    ADD COLUMN scale_m double precision CHECK (scale_m > 0),
    ADD CONSTRAINT drawn_routes_placement_whole CHECK (
        num_nulls(placed_start, offset_m, rotation_deg, phase, scale_m) IN (0, 5)
    );
