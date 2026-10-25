-- Every route the engine drew, kept for whoever asks the same nearby
-- (TASK-297 part A, ADR-0256, docs/DATABASE.md). A migration already in
-- main is never edited: write the next one.

-- One row per route and per alternative, without who asked it: a drawn
-- route is everyone's (ADR-0086), and deleting an account touches nothing
-- here. The request keys the row as route_store._same does; `engine` is
-- the engine's fingerprint (route_store.engine_fingerprint): another
-- engine, other routes. `result` is the RouteResult as route_store writes
-- it, directions included, alternatives left out: each is a row of its own.
CREATE TABLE drawn_routes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    drawn_at timestamptz NOT NULL,
    engine text NOT NULL CHECK (length(engine) BETWEEN 1 AND 16),
    -- A shape of the catalogue, or a word: one of the two.
    shape text CHECK (length(shape) <= 40),
    word text CHECK (length(word) <= 40),
    style text NOT NULL CHECK (style IN ('round', 'block')),
    distance_m integer NOT NULL CHECK (distance_m > 0),
    activity text NOT NULL CHECK (length(activity) <= 20),
    pen_up boolean NOT NULL DEFAULT false,
    -- The start asked for, where the user was: the route begins at the
    -- road node nearest to it. Asked by distance.
    start geography(Point, 4326) NOT NULL,
    -- The route, points as (lon, lat).
    route geometry(LineString, 4326) NOT NULL,
    result jsonb NOT NULL,
    similarity real NOT NULL CHECK (similarity BETWEEN 0 AND 1),
    -- The line's name, as the app's favoriteKey (best_routes.line_key):
    -- how a saved run and a favorite find their route here.
    line_key text NOT NULL CHECK (line_key ~ '^[a-z0-9]{8,40}$'),
    -- How many runs were saved along this line, and how many favorites
    -- keep it: the most chosen answer first.
    runs integer NOT NULL DEFAULT 0 CHECK (runs >= 0),
    favorites integer NOT NULL DEFAULT 0 CHECK (favorites >= 0),
    CHECK ((shape IS NULL) <> (word IS NULL))
);
-- The same request, nearby: the request's columns, then the start.
CREATE INDEX drawn_routes_request_idx
    ON drawn_routes (engine, activity, distance_m, shape, word, style, pen_up);
CREATE INDEX drawn_routes_start_idx ON drawn_routes USING gist (start);
CREATE INDEX drawn_routes_line_key_idx ON drawn_routes (line_key);
-- The oldest go first when the archive is full.
CREATE INDEX drawn_routes_drawn_at_idx ON drawn_routes (drawn_at);
