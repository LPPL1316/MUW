/**
 * Central contract: RouteRequest in, RouteResult out (docs/ARCHITECTURE.md §3).
 *
 * Mirrors services/route-engine/route_engine/models.py by hand, with the
 * same field names, so the API can pass them through unchanged. The
 * fixtures in ../fixtures keep the two sides in step: see the tests here
 * and services/route-engine/tests/test_contract.py.
 */

/** A point as [latitude, longitude], WGS84, in that order. */
export type LatLon = [lat: number, lon: number];

/** The shape catalogue (ADR-0036): the same names as the route engine. */
export const SHAPES = [
  "circle",
  "heart",
  "star",
  "horse",
  "moon",
  "cat",
  "fish",
  "butterfly",
  "snail",
  "dog_head",
  "rabbit_head",
  "pumpkin",
  "christmas_tree",
  "smiley",
  "ghost",
  "donut",
  "sun",
] as const;
export type Shape = (typeof SHAPES)[number];

/** The shapes that may be drawn with the pen up (TASK-223, ADR-0185): the
 * outline, then each piece on its own, walking from one to the next. The
 * first five lift off their eyes; the others have pieces apart. */
export const PEN_UP_SHAPES = [
  "cat",
  "fish",
  "dog_head",
  "rabbit_head",
  "pumpkin",
  "smiley",
  "ghost",
  "donut",
  "sun",
] as const satisfies readonly Shape[];
export type PenUpShape = (typeof PEN_UP_SHAPES)[number];

/** Where a drawing goes (TASK-347, ADR-0300): searched for by the engine,
 * or left where the finger drew it. The same names as the route engine. */
export const PLACEMENTS = ["free", "anchored"] as const;
export type Placement = (typeof PLACEMENTS)[number];

/** What a route is for: on foot, by bike on the roads a bike may ride,
 * one-way streets kept (TASK-190, ADR-0153), or paddling on a lake or the
 * sea within 1 km of the shore, a shape of the catalogue only (TASK-191,
 * ADR-0161). */
export const ACTIVITIES = ["running", "cycling", "paddling"] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Where a saved run comes from (TASK-312, ADR-0272): "muw", recorded by
 * the app; "file", a GPX, TCX or FIT file of another app, read on the phone
 * and saved with the same PUT /me/activities/{key}. Only "muw" counts for
 * the shape game and the contest; the app shows «Imported» for the others. */
export const RUN_SOURCES = ["muw", "file"] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

/** Plausible target distances for running, in metres. */
export const MIN_DISTANCE_M = 1_000;
export const MAX_DISTANCE_M = 50_000;

/** The target distances of each activity, [lowest, highest] in metres:
 * running as above, cycling 10–30 km (TASK-190), paddling 1–5 km
 * (TASK-191). Outside them the API answers `invalid_request`, with the
 * limits in the message. */
export const DISTANCE_LIMITS_M: Readonly<
  Record<Activity, readonly [lowest: number, highest: number]>
> = {
  running: [MIN_DISTANCE_M, MAX_DISTANCE_M],
  cycling: [10_000, 30_000],
  paddling: [1_000, 5_000],
};

/**
 * The letters a word may use (route_engine/letters.json, ADR-0044): A to Z
 * since TASK-059 (ADR-0056). At most MAX_WORD_LETTERS of them, with
 * LETTER_DISTANCE_M of route for each (TASK-056). Upper or lower case alike.
 */
export const LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;
export const MAX_WORD_LETTERS = 8;
export const LETTER_DISTANCE_M = 3_000;

/** The letters of a word (TASK-080, ADR-0075): round, the default, or block,
 * square letters turned to the street grid (ADR-0072). Only for a word. */
export const LETTER_STYLES = ["round", "block"] as const;
export type LetterStyle = (typeof LETTER_STYLES)[number];

interface RouteRequestFields {
  start: LatLon;
  /** Target distance in metres, a whole number. */
  distance_m: number;
  activity: Activity;
  /**
   * On the water (TASK-238, ADR-0202), where the centre of the shape is
   * wanted: `RouteResult.centre` of the route before, moved by the user. The
   * shape is placed at the nearest place to it where it fits. Refused with
   * another activity; absent or null leaves the place to the engine.
   */
  near?: LatLon | null;
  /**
   * Where the shape goes (TASK-347, ADR-0300): "free", the search turns,
   * scales and moves it to where the roads draw it best, as before;
   * "anchored", it stays where and as it was drawn (its first point on
   * `start`, upright, at the scale of `distance_m`), traced once and never
   * rescaled: a distance off by more than 10% is a warning, not a refusal.
   * Only on the roads. Absent means "free", as an older app sends it; an API
   * older than TASK-347 refuses the field, so the app sends it only after
   * the probe (GET /stroke-matches).
   */
  placement?: Placement;
  /**
   * With `placement` "anchored": the magnet, from 0 (faithful to the
   * drawing: tight zones and corridor) to 1 (today's tracing, wide); absent,
   * the engine's default. Refused with "free".
   */
  fit?: number;
}

/** A shape of the catalogue, or a word written one letter at a time: one
 * of the two, the other absent or null (TASK-056). `pen_up` with a word
 * (TASK-197, ADR-0157): each letter drawn on its own, and the route walks
 * from one to the next without drawing (`RouteResult.walks`); the distance
 * is the letters'. So with a shape of PEN_UP_SHAPES, piece by piece
 * (TASK-223); on the water too (TASK-226, ADR-0188), where the distance is
 * the whole route's. Absent means false, as an older app sends it. */
export type RouteRequest =
  | (RouteRequestFields & {
      shape: Shape;
      word?: null;
      style?: "round";
      pen_up?: false;
    })
  | (RouteRequestFields & {
      shape: PenUpShape;
      word?: null;
      style?: "round";
      pen_up: true;
    })
  | (RouteRequestFields & {
      shape?: null;
      word: string;
      style?: LetterStyle;
      pen_up?: boolean;
    });

/**
 * A stretch of a route walked from one letter to the next of a word with
 * the pen up (TASK-197): [from, to] indices into `RouteResult.points`, both
 * included. Recording pauses at `from` and resumes at `to`.
 */
export type Walk = [from: number, to: number];

/**
 * A stretch of a bike route walked with the bike on foot (TASK-206,
 * ADR-0167): [from, to] indices into `RouteResult.points`, both included.
 */
export type Stretch = [from: number, to: number];

export interface RouteResult {
  /**
   * The route, closed: the last point is the first. A word with the pen up
   * is open: from its first letter to its last (TASK-197).
   */
  points: LatLon[];
  /** Distance actually covered, in metres. */
  distance_m: number;
  /** How much the route looks like the shape, from 0 to 1. */
  similarity: number;
  /** Null for a word (TASK-056) or an image (TASK-073). */
  shape: Shape | null;
  warnings: string[];
  /** Turn by turn, the start first (TASK-048); empty without a search. */
  directions: Direction[];
  /** The word in capitals, null for a shape or an image (TASK-056). */
  word?: string | null;
  /**
   * Other routes for the same request, best first, to choose from (TASK-093,
   * ADR-0087): at most MAX_ALTERNATIVES, each a whole result with no
   * alternatives of its own. Missing from an older API.
   */
  alternatives?: RouteResult[];
  /**
   * The walks of a word with the pen up (TASK-197, ADR-0157), in order: one
   * fewer than its letters, the next letter beginning where a walk ends.
   * Empty for a shape, an image and a word without; missing from an older
   * API, which draws one line.
   */
  walks?: Walk[];
  /**
   * By bike (TASK-206, ADR-0167): where the rider walks with the bike on
   * foot, in order, also in the approach from a nearby start; the warnings
   * say how many metres. Empty on foot and on the water; missing from an
   * older API, which says nothing of it.
   */
  on_foot?: Stretch[];
  /**
   * A distance in whole km where the search found the shape clearly better
   * drawn (TASK-234, ADR-0197), for «Try N km» under the route. Null without
   * one, in the alternatives and on the water; missing from an older API.
   */
  better_distance_m?: number | null;
  /**
   * On the water, the centre of the shape as placed (TASK-238, ADR-0202):
   * moved and sent back as the request's `near`, it moves the shape. Null on
   * the roads; missing from an older API, whose shapes are not moved.
   */
  centre?: LatLon | null;
  /**
   * How far the shape is turned, in degrees counterclockwise, in (-180, 180]
   * (TASK-232, ADR-0195): the map shows the drawing upright with a MapLibre
   * bearing of -rotation_deg. 0 for a shape that turns freely, like the
   * circle; each alternative has its own. Missing from an older API: the map
   * stays north-up.
   */
  rotation_deg?: number;
  /**
   * The drawing as the engine placed it, in WGS84 lines (TASK-347,
   * ADR-0300): turned, scaled and moved by the search when `placement` was
   * "free", left where it was drawn when "anchored"; one closed line for a
   * shape, one open line per letter or piece drawn with the pen up. The app
   * draws it as a ghost under the route, so the drawing never disappears
   * when the route arrives. Empty on the water; missing from an older API.
   */
  placed_outline?: LatLon[][];
}

/** Routes besides the one chosen by the engine: three to choose from. */
export const MAX_ALTERNATIVES = 2;

/** What a direction says to do (route_engine/directions.py, ADR-0045). */
export const TURNS = [
  "depart",
  "left",
  "right",
  "sharp-left",
  "sharp-right",
  "straight",
  "u-turn",
] as const;
export type Turn = (typeof TURNS)[number];

/** Directions closer than this to the one before are read with it. */
export const GROUP_M = 15;

/** What to do at one junction of the route. */
export interface Direction {
  /** OpenStreetMap id of the junction's node. */
  node: number;
  point: LatLon;
  /** Along the route from its start, in metres. */
  distance_m: number;
  /** "depart" for the first: the road the route starts on. */
  turn: Turn;
  /** The turn in degrees, positive to the right. */
  angle_deg: number;
  /** Name or ref of the road entered; null when OSM has neither, never made up. */
  street: string | null;
  /** OSM highway of the road entered, like "footway". */
  road_type: string | null;
  /** Roads that meet at the junction. */
  branches: number;
  /** Less than GROUP_M after the direction before: read with it. */
  joined: boolean;
  /**
   * When `street` is null, the street the road runs along, deduced from the
   * roads beside it (ADR-0054, ADR-0057): never a name of the road itself.
   * Missing from an API older than TASK-060.
   */
  along?: string | null;
}

/** Codes of the errors the API answers with (docs/API.md). */
export const API_ERROR_CODES = [
  "invalid_request",
  "shape_not_drawable",
  "map_data_unavailable",
  "engine_error",
  "http_error",
  "ai_unavailable",
  "image_not_usable",
  /** A line drawn on an image's outline gives no outline (TASK-079). */
  "outline_edit_rejected",
  /** A key is set on the API and the request has the wrong one (TASK-081). */
  "unauthorized",
  /**
   * Too many requests from this phone in a minute (TASK-081), or too many
   * wrong passwords for one email (TASK-114).
   */
  "too_many_requests",
  /** Signing up with an email that already has an account (TASK-114). */
  "email_taken",
  /** Signing up with a username already taken, whatever the case. */
  "username_taken",
  /** Signing in with a wrong email or password. */
  "wrong_credentials",
  /** No session token, or one that was signed out. */
  "not_signed_in",
  /** A session unused for 90 days: sign in again. */
  "session_expired",
  /** The API has no database: accounts are off on that server. */
  "accounts_unavailable",
  /** A comment the API refuses, a negative one (TASK-120, ADR-0176). */
  "comment_rejected",
  /** No contest open, nor one closed less than a week ago (TASK-299). */
  "no_contest",
  /**
   * An entry in a monthly challenge, 409 (TASK-343): the contest takes no
   * entries now (ended, closed, or without a theme).
   */
  "contest_closed",
  /**
   * An entry in a monthly challenge, 409 (TASK-343): the drawing cannot take
   * part (another's, not for everyone, imported, outside the period, hidden).
   */
  "not_entrant",
  /** «Send to Strava» of a run added from another app's file, 409 (TASK-312). */
  "imported_run",
  /**
   * POST /session/{provider}, 404 (TASK-322): no account yet for that Apple
   * or Google account nor its email; NewAccountError carries the email.
   */
  "new_account",
  /** The API has no keys for Apple or for Google, 503 (TASK-322). */
  "provider_unavailable",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** The body of every error answer of the API. */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    /** In English, for people: the engine's own words when it has them. */
    message: string;
    /**
     * Only with "shape_not_drawable", else null: a distance the shape fits,
     * in whole km as metres (TASK-031).
     */
    suggested_distance_m: number | null;
    /**
     * Only with "image_not_usable", else null: why the engine found no
     * outline (TASK-073). Missing from an API older than TASK-073. With
     * "outline_edit_rejected", why the drawing was refused (TASK-079); with
     * "comment_rejected", why the comment was (TASK-120).
     */
    reason?: ImageReason | EditReason | CommentReason | null;
  };
}

/** Where a route request stands, from queued to done or failed. */
export const JOB_STATUSES = [
  "queued",
  "downloading_map",
  "computing",
  "done",
  "failed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * A route request the API is working on (ADR-0032): the answer to
 * POST /route-jobs and to every GET /route-jobs/{job_id}.
 */
export interface RouteJob {
  job_id: string;
  status: JobStatus;
  /** Only when `status` is "done". */
  result: RouteResult | null;
  /** Only when `status` is "failed". */
  error: ApiError["error"] | null;
}

/** What the app sends to POST /gpx to get the route as a GPX file (ADR-0033). */
export interface GpxRequest {
  request: RouteRequest | ImageRouteRequest;
  result: RouteResult;
}

/** One GPS fix of a run, as the app recorded it (TASK-112). */
export interface TrackFix {
  point: LatLon;
  /** When the fix was taken, in milliseconds on the phone's clock. */
  time_ms: number;
  /** Radius of the fix's error, in metres; null or absent when unknown. */
  accuracy_m?: number | null;
}

/** What the app sends to POST /track-scores (TASK-113, ADR-0093). */
export interface TrackScoreRequest {
  /** The planned route: RouteResult.points. */
  points: LatLon[];
  /** The planned route's: RouteResult.similarity. */
  similarity: number;
  /** The run, fix by fix, in order. */
  track: TrackFix[];
  /**
   * The planned route's: RouteResult.walks (TASK-197). The run is judged on
   * the letters alone, its positions on a walk not counted. Absent or empty
   * for any other route.
   */
  walks?: Walk[];
}

/** The score of a run (route_engine/track_score.py, ADR-0090). */
export interface TrackScoreResult {
  /** From 0 to 100: the route's similarity times `fidelity`. */
  score: number;
  /** How much of the plan was run, and nothing else, from 0 to 1. */
  fidelity: number;
  /** Share of the planned route with the run near it. */
  covered: number;
  /** Share of the run near the planned route. */
  on_route: number;
  /** Length of the run, in metres. */
  distance_m: number;
}

/** The longest text of the shape field the AI reads: a word or a few. */
export const MAX_SHAPE_TEXT_LENGTH = 60;

/**
 * What the app sends to POST /shape-readings (ADR-0012): the words of the
 * shape field that the app's own table does not know.
 */
export interface ShapeReadingRequest {
  text: string;
}

/** The AI's reading of the words: a shape of the catalogue, or none. */
export interface ShapeReading {
  /** The words as read: single spaces, none at the ends. */
  text: string;
  /** Null when no shape of the catalogue fits the words. */
  shape: Shape | null;
}

/** The largest image POST /image-outlines takes, before base64 (ADR-0069). */
export const MAX_IMAGE_BYTES = 10_000_000;
/** The most corners an outline traced from an image has (ADR-0068). */
export const MAX_OUTLINE_POINTS = 100;

/**
 * Why an image gives no outline (route_engine/image_outline.py, ADR-0068):
 * not PNG or JPEG, unreadable, a background that is not plain, no subject,
 * more than 4 subjects (TASK-084), a subject on the edge, too small, too
 * jagged.
 */
export const IMAGE_REASONS = [
  "format",
  "unreadable",
  "background",
  "no_subject",
  "scattered",
  "edge",
  "small",
  "jagged",
] as const;
export type ImageReason = (typeof IMAGE_REASONS)[number];

/**
 * What the app sends to POST /image-outlines (TASK-073, ADR-0069): a PNG or
 * JPEG file in base64, at most MAX_IMAGE_BYTES before encoding.
 */
export interface ImageOutlineRequest {
  image: string;
}

/** A point of an outline as [x, y]. */
export type OutlinePoint = [x: number, y: number];

/** The outline the engine traced from an image, to show before the route. */
export interface ImageOutline {
  /** Closed, centred and scaled into [-1, 1], y upwards: what an
   * ImageRouteRequest sends back. */
  points: OutlinePoint[];
  /** The same corners over the image, as shares of its width and height
   * from the top left: to draw the outline on the picture. */
  image_points: OutlinePoint[];
  /** Width over height of the image, upright. */
  aspect: number;
  /** The other subjects of the image (TASK-084) and the details drawn by
   * hand (TASK-079), in the frame of `points`: each starts on the outline
   * or on an earlier one, and the route goes along it and back; one that
   * ends on its own second point closes a loop, drawn once. Empty for one
   * subject as traced; missing from an API older than TASK-079. */
  strokes?: OutlinePoint[][];
  /** The same strokes over the image, like `image_points`. */
  image_strokes?: OutlinePoint[][];
}

/**
 * What the app sends to POST /image-route-jobs: the route of an image's
 * outline. The answer is a RouteJob, read at /route-jobs/{job_id}; its
 * result has neither shape nor word.
 */
export interface ImageRouteRequest {
  start: LatLon;
  /** The `points` of an ImageOutline, unchanged. */
  outline: OutlinePoint[];
  /** The `strokes` of an ImageOutline, unchanged (TASK-079); absent or
   * empty for an outline without. */
  strokes?: OutlinePoint[][];
  /** Target distance in metres, a whole number. */
  distance_m: number;
  activity: Activity;
  /** No letters to draw with the pen up: true is refused (TASK-197). */
  pen_up?: false;
  /** As in RouteRequest (TASK-347): "anchored" leaves the outline where it
   * was drawn, its first point on `start`, at the scale of `distance_m`.
   * This is what «Draw route» sends for a drawing made on the map. */
  placement?: Placement;
  /** As in RouteRequest: the magnet of an anchored outline, 0 to 1. */
  fit?: number;
}

/** The most points of one stroke sent to POST /stroke-matches (TASK-347):
 * the app simplifies the finger's line first, and splits a longer stroke. */
export const MAX_STROKE_POINTS = 500;
/** The longest stroke, in metres along its points; a longer one is split. */
export const MAX_STROKE_M = 10_000;

/**
 * One stroke drawn on the map, to anchor to the roads as the finger lifts
 * (TASK-347, ADR-0300): what the app sends to POST /stroke-matches, or to
 * the engine on the phone first. Sent only to a server that knows it: GET
 * /stroke-matches answers 204 there and 404 on an older API.
 */
export interface StrokeMatchRequest {
  activity: Activity;
  /** The magnet, 0 (faithful to the drawing) to 1 (today's tracing, wide);
   * absent, the engine's default. */
  fit?: number;
  /** The stroke as drawn, in order: 2 to MAX_STROKE_POINTS points, at most
   * MAX_STROKE_M long. */
  line: LatLon[];
  /** Where the stroke before ended: the route starts at the road node
   * nearest to it, so the strokes join along the roads. Absent for the
   * first stroke. */
  from?: LatLon;
}

/** The roads that draw a stroke: the answer of POST /stroke-matches. */
export interface StrokeMatchResult {
  /** The route along the roads, from the node of `from` (or the one nearest
   * to the first point) to the roads near the last point; the last point is
   * the next stroke's `from`. */
  points: LatLon[];
  /** For each point of the stroke as sent, in order, how far the route runs
   * from it, in metres: the app colours the far ones. */
  away_m: number[];
  /** True when the drawn points are, on average, farther from a road than
   * the engine's sparse-network threshold: the stroke is in the fields, the
   * match is a guess, and the app may leave the stroke as a ghost. */
  off_roads: boolean;
}

/** The most points of all the strokes of an outline together, as the
 * route travels them: the other subjects of the image (TASK-084) and the
 * details drawn by hand (TASK-079). A line run out and back counts twice:
 * about 100 points of details without loops. */
export const MAX_DETAIL_POINTS = 200;
/** The most points of a line drawn with a finger (TASK-079). */
export const MAX_DRAWN_POINTS = 2_000;

/**
 * Why a line drawn on an outline was refused (route_engine/outline_edits.py,
 * TASK-079, ADR-0074): too short or small; a part over the start of a
 * detail; too many corners. A drawing away from the outline is not
 * refused, it is joined to the nearest line; and lines may cross.
 */
export const EDIT_REASONS = ["short", "covers_detail", "too_many_corners"] as const;
export type EditReason = (typeof EDIT_REASONS)[number];

/** What a line drawn on an outline adds: a closed part joined to the
 * silhouette, or a detail the route goes along and back. */
export type EditKind = "part" | "detail";

/**
 * What the app sends to POST /image-outline-edits (TASK-079, ADR-0074): the
 * outline it shows over the picture and one line drawn on it. The answer is
 * the new ImageOutline, or an ApiError "outline_edit_rejected" with its
 * `reason`. Nothing is kept between two edits: undo is the app's own.
 */
export interface ImageOutlineEditRequest {
  /** The `image_points` of the ImageOutline shown. */
  image_points: OutlinePoint[];
  /** Its `image_strokes`. */
  image_strokes: OutlinePoint[][];
  /** Its `aspect`. */
  aspect: number;
  kind: EditKind;
  /** The line drawn, as shares of the image from the top left. */
  line: OutlinePoint[];
}

/**
 * Accounts (TASK-114, ADR-0115): email and password. What the app sends to
 * POST /accounts to sign up; signing up also signs in.
 */
export interface SignUpRequest {
  /** Stored in lower case: one address is one account. */
  email: string;
  /** PASSWORD_LENGTH.min to PASSWORD_LENGTH.max characters. */
  password: string;
  /** 3 to 20 letters, digits, "_" or "."; unique whatever the case. */
  username: string;
  /** The "I am at least 16" box (ADR-0114): false is refused. */
  at_least_16: boolean;
  /**
   * The box «Don't send me these emails» (TASK-284): false when ticked.
   * Without it, «Email when I'm away» is on.
   */
  away_email?: boolean;
  /** The app's language, for the texts of the emails; English without it. */
  language?: PushLanguage | null;
}

/** The limits of a password, checked by the API too. */
export const PASSWORD_LENGTH = { min: 8, max: 128 } as const;

/** What the app sends to POST /session to sign in. */
export interface SignInRequest {
  email: string;
  password: string;
}

/**
 * «Continue with Apple» and «Continue with Google» (TASK-322, ADR-0282):
 * besides email and password, an account opens with these. Apple only on
 * iPhone.
 */
export const SIGN_IN_PROVIDERS = ["apple", "google"] as const;
export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number];

/**
 * GET /session/providers: the ones the API has the keys of, none without
 * its database. The app shows only their buttons.
 */
export interface SignInProviders {
  providers: SignInProvider[];
}

/**
 * What the app sends to POST /session/{provider}. The answer is a Session:
 * 200 for an account that was there (the same Apple or Google account, or
 * one already signed up with its email), 201 for a new one. The first time,
 * without `username`: 404 NewAccountError, and the app sends the same again
 * with the username and the box. A token that does not hold: 401
 * "wrong_credentials".
 */
export interface ProviderSignInRequest {
  /**
   * The token Apple's or Google's sheet gave: it lasts 10 minutes for
   * Apple, an hour for Google.
   */
  id_token: string;
  /**
   * Apple only: the code of the same sign-in, so the API can revoke the
   * access when the account is deleted.
   */
  authorization_code?: string | null;
  /** Apple only: the string the app made; Apple gets its SHA-256, in hex. */
  nonce?: string | null;
  /** A new account only, as in SignUpRequest; ignored otherwise. */
  username?: string | null;
  /** A new account only: the "I am at least 16" box; false is refused. */
  at_least_16?: boolean;
  /**
   * A new account only: the box «Don't send me these emails», as in
   * SignUpRequest.
   */
  away_email?: boolean;
  /** A new account only: the app's language, for the texts of the emails. */
  language?: PushLanguage | null;
}

/**
 * 404 of POST /session/{provider}: the email Apple or Google gave, shown
 * above the username.
 */
export interface NewAccountError {
  error: ApiError["error"] & { code: "new_account"; email: string };
}

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** GET /me, and the user of a Session: never the password or a token. */
export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  /** ISO 8601, UTC. */
  created_at: string;
  /**
   * The profile (TASK-116): a few words, "" without; missing from an API
   * older than TASK-116, which has no bio.
   */
  bio?: string;
  /**
   * The id the others open the profile with, GET /users/{public_id}: a
   * random UUID, never `id`. Missing from an API older than TASK-116.
   */
  public_id?: string;
  /**
   * The phone number (TASK-183), in E.164 ("+393331234567"), or null
   * without one: told to its owner only. Missing from an API older than
   * TASK-183.
   */
  phone?: string | null;
  /**
   * The two notification switches of «Settings» (TASK-185): told to their
   * owner only. Missing from an API older than TASK-185: both off.
   */
  notifications?: Notifications;
  /**
   * Whether the owner opened the link sent to `email` (TASK-300). Missing
   * from an API older than TASK-300.
   */
  email_confirmed?: boolean;
  /**
   * The address asked for in «Settings» that waits for its link, or null
   * (TASK-300): `email` stays the one to log in with until then. Missing
   * from an API older than TASK-300.
   */
  pending_email?: string | null;
  /**
   * The contests won (TASK-299), as PublicProfile has it. Missing from an
   * API older than TASK-299.
   */
  contest_wins?: number;
}

/**
 * What an account chose about being notified (TASK-185): both off until
 * turned on. With «Push notifications» on the API sends push notifications
 * to the phones of the account (TASK-262); with «Email notifications» on,
 * one email a day at most with the same news (TASK-262 part B).
 */
export interface Notifications {
  email: boolean;
  push: boolean;
  /**
   * «Email when I'm away» (TASK-284): one email after two weeks without
   * opening the app, with what is new. On until turned off. Missing from
   * an API older than TASK-284: on.
   */
  away?: boolean;
}

/**
 * PUT /me/notifications (TASK-185): only what changes; a switch not sent
 * stays as it is. The answer is the User.
 */
export interface NotificationsRequest {
  email?: boolean;
  push?: boolean;
  /** «Email when I'm away» (TASK-284). */
  away?: boolean;
}

/**
 * PUT /me/email (TASK-183): the new address, and the password of the
 * account; the answer is the User. On a server that sends email (TASK-300)
 * the new address waits in `pending_email` for its link, and the answer is
 * 429 after too many emails asked; otherwise it holds at once.
 */
export interface ChangeEmailRequest {
  email: string;
  password: string;
}

/**
 * GET /account-email (TASK-300): 200 when the server confirms addresses
 * and resets passwords by email, 404 otherwise.
 */
export interface AccountEmailService {
  on: true;
}

/**
 * POST /password-reset (TASK-300), without an account: 202 whoever has the
 * address, and an email with a link when an account has it; 429 after
 * three in an hour for one address. `language` is the app's, for the email.
 * POST /me/email/confirmation sends the link again (202, or 204 with
 * nothing to confirm); DELETE /me/email/pending drops the address that
 * waits and answers the User.
 */
export interface PasswordResetRequest {
  email: string;
  language?: PushLanguage;
}

/**
 * PUT /me/phone (TASK-183): the number with its country code, however it
 * is spaced ("+39 333 123 4567"); null takes it away. The answer is the
 * User, with the number in E.164.
 */
export interface ChangePhoneRequest {
  phone: string | null;
}

/** The limit of a bio, checked by the API too (TASK-116). */
export const BIO_MAX_LENGTH = 160;

/**
 * PATCH /me (TASK-116): only what changes. A username follows the rule of
 * SignUpRequest; an empty bio takes the bio away. The answer is the User.
 */
export interface EditProfileRequest {
  username?: string;
  /** At most BIO_MAX_LENGTH characters; new lines are kept. */
  bio?: string;
}

/**
 * GET /users/{public_id} (TASK-116): an account as every member sees it.
 * Never the email, the role or `id`.
 */
export interface PublicProfile {
  public_id: string;
  username: string;
  /** "" without one. */
  bio: string;
  /** The square JPEG of the picture in base64, as /me/photo; null without. */
  photo: string | null;
  /** How many runs it made public as drawings (TASK-117). */
  drawings: number;
  /**
   * How many follow it, and how many it follows: only the requests accepted
   * (TASK-211). Missing from an API older than TASK-211.
   */
  followers?: number;
  following?: number;
  /** Where the one who asks stands towards it. Missing from an older API. */
  follow?: FollowState;
  /**
   * The contests it won (TASK-299): the «Winner» badge when 1 or more.
   * Missing from an API older than TASK-299.
   */
  contest_wins?: number;
  /**
   * The totals (TASK-324, ADR-0284): the metres of all its runs and the
   * metres climbed in those that know it, private runs too (the user's
   * choice), and the reactions others left on its drawings the one who asks
   * sees. All three missing from an API older than TASK-324.
   */
  distance_m?: number;
  climb_m?: number;
  reactions?: number;
  /**
   * The badges it earned (TASK-341, ADR-0294), in the order of
   * PROFILE_BADGES, decided by the API on the drawings the one who asks
   * sees. «Winner» is `contest_wins`. Missing from an API older than TASK-341.
   */
  badges?: ProfileBadge[];
}

/**
 * The badges of a profile (TASK-341): a first drawing, ten drawings, a
 * drawing of 30 km or more, of runs recorded by the app.
 */
export const PROFILE_BADGES = [
  "first_drawing",
  "ten_drawings",
  "long_drawing",
] as const;
export type ProfileBadge = (typeof PROFILE_BADGES)[number];

/**
 * Where a member stands towards a profile (TASK-211): it asked and waits
 * for the other to accept, or it follows. Its own profile: "none". A
 * request declined is "none" again: nothing says it was declined.
 */
export const FOLLOW_STATES = ["none", "requested", "following"] as const;
export type FollowState = (typeof FOLLOW_STATES)[number];

/** POST /users/{public_id}/follow (TASK-211): where the one who asked stands now. */
export interface Follow {
  follow: Exclude<FollowState, "none">;
}

/** The fewest characters GET /users?q= looks for, spaces at the ends left out. */
export const PEOPLE_QUERY_MIN_LENGTH = 2;
/** The most members GET /users?q= gives. */
export const PEOPLE_FOUND_MAX = 20;
/** The side of a Person's picture, in pixels: half that of a PublicProfile. */
export const PERSON_PHOTO_SIDE = 128;

/**
 * A member in a list (TASK-211): found by name, a follower, one followed,
 * one who asks to follow. Never the email; the profile is GET
 * /users/{public_id}.
 */
export interface Person {
  public_id: string;
  username: string;
  /** A square JPEG of PERSON_PHOTO_SIDE px in base64; null without a picture. */
  photo: string | null;
}

/**
 * GET /users?q= (TASK-211): at most PEOPLE_FOUND_MAX members whose name
 * holds the query, whatever the case, never the one who asks; first the
 * names that begin with it, then the shortest.
 */
export interface PeopleFound {
  people: Person[];
}

/**
 * GET /me/followers, /me/following, /me/follow-requests (TASK-211): a
 * page, the latest first; only the account's own.
 */
export interface PeoplePage {
  people: Person[];
  /** The `cursor` of the next page; null on the last one. */
  next: string | null;
  /** How many there are, on every page. */
  total: number;
}

/** The limit of a drawing's title, checked by the API too (TASK-117). */
export const DRAWING_TITLE_MAX_LENGTH = 60;

/**
 * What the other members never see of a public run, from either end of its
 * track, in metres along it (ADR-0114, point 4): the API cuts it.
 */
export const DRAWING_CUT_M = 200;

/**
 * Who can see a drawing (TASK-208, ADR-0170): every member, the members who
 * follow its owner with the request accepted, or only its owner.
 */
export const VISIBILITIES = ["everyone", "followers", "only_me"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** The limits of a drawing, checked by the API too (TASK-208). */
export const DRAWING_DESCRIPTION_MAX_LENGTH = 500;
export const DRAWING_MAX_TAGS = 10;
/**
 * Besides the map, what the app offers today. It goes to
 * DRAWING_PHOTO_PLACES with TASK-348's app part: a phone on a server not yet
 * updated must not ask for a place the server refuses.
 */
export const DRAWING_MAX_PHOTOS = 3;
/** The places of the photos of a drawing on the API (TASK-348, ADR-0301). */
export const DRAWING_PHOTO_PLACES = 10;

/**
 * PUT /me/activities/{key}/drawing (TASK-117, TASK-208): a saved run's
 * drawing as it should be now. The answer is a MyDrawing.
 */
export interface DrawingRequest {
  /** At most DRAWING_TITLE_MAX_LENGTH characters; null or "": none. */
  title?: string | null;
  /** Who can see it; or `public`, never both (TASK-208). */
  visibility?: Visibility;
  /** An app before TASK-208: true is "everyone", false "only_me". */
  public?: boolean;
  /**
   * «How did it go?»: at most DRAWING_DESCRIPTION_MAX_LENGTH characters,
   * lines and all; null or "": none; missing: as it was.
   */
  description?: string | null;
  /** What the run was; missing: as it was. */
  activity?: Activity;
  /** The public_id of the members tagged, in order; []: none; missing: as they were. */
  tags?: string[];
}

/**
 * PUT /me/activities/{key}/drawing/photos/{n} (TASK-208): a JPEG or PNG in
 * base64; the API keeps it upright, at most 1080 px a side, without EXIF.
 */
export interface DrawingPhotoRequest {
  image: string;
}

/**
 * PUT /me/activities/{key}/drawing/order (TASK-348, ADR-0301): where each
 * stands in the post. The map once, `drawing`, and the photos by place,
 * `photo:2`, each once; it may name a photo not sent yet. The answer is a
 * MyDrawing.
 */
export interface DrawingOrderRequest {
  order: string[];
}

/** A member tagged in a drawing: never the email. */
export interface DrawingTag {
  public_id: string;
  username: string;
}

/** A photo of a drawing, besides its map (TASK-208). */
export interface DrawingPhoto {
  /**
   * Its place, 1 to DRAWING_PHOTO_PLACES: a place emptied stays empty, and a
   * place says which photo, not where it stands (`order`).
   */
  n: number;
  /** A JPEG on the API, read with the token; it changes with the photo. */
  url: string;
  width: number;
  height: number;
}

/**
 * What the owner chose for one of its runs: GET and PUT
 * /me/activities/{key}/drawing, and each item of GET /me/drawings.
 */
export interface MyDrawing {
  /** The run's key, as in My activities. */
  key: string;
  /** What the others open it with; null for a run never titled nor published. */
  id: string | null;
  title: string | null;
  /** Every member sees it: `visibility` is "everyone". */
  public: boolean;
  /** When the others could first see it since it was last "only_me"; null while it is. */
  published_at: string | null;
  /** The fields of TASK-208: an API before has none. */
  visibility?: Visibility;
  description?: string | null;
  activity?: Activity;
  /** The run's (TASK-312); missing from an API before it: "muw". */
  source?: RunSource;
  tags?: DrawingTag[];
  photos?: DrawingPhoto[];
  /**
   * The post's order, the map among the photos: `drawing`, `photo:2`
   * (TASK-348, ADR-0301); `photos` comes in it. Null or missing: never
   * ordered or an older server, the map first and the photos by place.
   */
  order?: string[] | null;
}

/** GET /me/drawings: the runs with a title or made public, latest first. */
export interface MyDrawings {
  drawings: MyDrawing[];
}

/** Who published a drawing: never the email. */
export interface DrawingAuthor {
  public_id: string;
  username: string;
}

/** What every member sees of a drawing: the run's numbers, counted by the API. */
interface DrawingFields {
  id: string;
  /** The owner's title; null: none. */
  title: string | null;
  started_at: string;
  /** Null only for its owner, on a private one. */
  published_at: string | null;
  /** The town the run starts from ("Trento"), or null. */
  place: string | null;
  shape: string | null;
  word: string | null;
  style: LetterStyle | null;
  /** What the planned route draws when neither shape nor word says it. */
  route_title: string | null;
  distance_m: number;
  duration_s: number;
  /** 0–100, against the planned route; null without one or too short. */
  score: number | null;
  fidelity: number | null;
  /** The fields of TASK-208: an API before has none. */
  visibility?: Visibility;
  description?: string | null;
  activity?: Activity;
  /** The run's (TASK-312): "file" is shown with «Imported». Missing from an
   * API before it: "muw". */
  source?: RunSource;
  tags?: DrawingTag[];
  photos?: DrawingPhoto[];
  /**
   * The post's order, the map among the photos: `drawing`, `photo:2`
   * (TASK-348, ADR-0301); `photos` comes in it. Null or missing: never
   * ordered or an older server, the map first and the photos by place.
   */
  order?: string[] | null;
  /**
   * How far the planned route's shape is turned, as RouteResult.rotation_deg
   * (TASK-232, ADR-0195): the drawing is shown turned back, so it reads
   * upright. Null for a run without a route, one north up and every run
   * saved before; missing from an API before TASK-232 part C.
   */
  rotation_deg?: number | null;
}

/** One drawing of GET /users/{public_id}/drawings. */
export interface Drawing extends DrawingFields {
  /** At most 64 points of the cut track. */
  track_preview: LatLon[];
}

/** GET /users/{public_id}/drawings: a page, the latest run first. */
export interface DrawingsPage {
  drawings: Drawing[];
  /** The `cursor` of the next page; null on the last one. */
  next: string | null;
  /** How many drawings of the profile the one who asks sees. */
  total: number;
}

/**
 * GET /drawings/{id}: one drawing whole. The track is cut: never its first
 * and last DRAWING_CUT_M metres, never its times or the planned route.
 */
export interface DrawingDetail extends DrawingFields {
  author: DrawingAuthor;
  /** Every member sees it: `visibility` is "everyone". */
  public: boolean;
  /** Empty only for the owner's private run too short to publish. */
  track: LatLon[];
}

/** The limit of a comment, checked by the API too (TASK-120). */
export const COMMENT_MAX_LENGTH = 500;

/**
 * Why the API refuses a comment with "comment_rejected" (ADR-0176): a
 * negative one is never published, and the app says so in an alert.
 */
export const COMMENT_REASONS = ["negative"] as const;
export type CommentReason = (typeof COMMENT_REASONS)[number];

/**
 * POST /drawings/{id}/comments (TASK-120): plain text, 1 to
 * COMMENT_MAX_LENGTH characters once the spaces at either end are gone; new
 * lines are kept. The answer is the Comment.
 */
export interface CommentRequest {
  text: string;
}

/** One comment under a drawing, as who asks sees it. */
export interface Comment {
  id: string;
  /** Who wrote it: never the email. */
  author: DrawingAuthor;
  /** Plain text: shown as text, never as a link or HTML. */
  text: string;
  created_at: string;
  /** Who asks may delete it: it wrote it, or it owns the drawing. */
  deletable: boolean;
}

/** GET /drawings/{id}/comments: a page, the oldest first. */
export interface CommentsPage {
  comments: Comment[];
  /** The `cursor` of the next page; null on the last one. */
  next: string | null;
  /** How many comments the drawing has, on every page. */
  total: number;
}

/**
 * The reactions under a drawing (TASK-119, ADR-0193), in the order the app
 * shows them: the Sgrava heart, the super like, then 🔥 👏 💪 😂 😮. Codes,
 * never the emoji: the app draws them.
 */
export const REACTION_KINDS = [
  "super_like",
  "fire",
  "clap",
  "strong",
  "laugh",
  "wow",
] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

/**
 * A super like needs a comment of at least this many characters, once the
 * spaces at either end are gone (ADR-0193); checked by the API too.
 */
export const SUPER_LIKE_MIN_COMMENT = 2;

/**
 * PUT /drawings/{id}/reaction (TASK-119): one reaction each, in place of
 * one's own; the same kind again changes nothing. `comment` only with
 * "super_like", and then needed: SUPER_LIKE_MIN_COMMENT to
 * COMMENT_MAX_LENGTH characters, refused as a comment is
 * ("comment_rejected"). The answer is the ReactionResult.
 */
export interface ReactionRequest {
  kind: ReactionKind;
  comment?: string | null;
}

/**
 * GET /drawings/{id}/reactions, and the answer of DELETE
 * /drawings/{id}/reaction: how many, never who.
 */
export interface ReactionsSummary {
  /** How many of each kind, all six, zero included. */
  counts: Record<ReactionKind, number>;
  total: number;
  /** The reaction of who asks; null when it left none. */
  mine: ReactionKind | null;
}

/** The answer of PUT /drawings/{id}/reaction. */
export interface ReactionResult {
  reactions: ReactionsSummary;
  /**
   * The comment kept with a super like just left, to add to the comments;
   * null otherwise, also when the super like was there already.
   */
  comment: Comment | null;
}

/**
 * The answer of POST /accounts and POST /session, the only one with the
 * token: the app keeps it in expo-secure-store and sends it back as
 * "Authorization: Bearer <token>". It ends 90 days after its last use, or
 * with DELETE /session.
 */
export interface Session {
  token: string;
  user: User;
}

/** Posts a page of GET /feed holds unless `limit` says (TASK-118). */
export const FEED_PAGE_SIZE = 20;

/**
 * How far from the phone a drawing of someone the reader does not follow
 * is still in its feed, in metres (TASK-118, ADR-0227).
 */
export const FEED_NEAR_M = 50_000;

/**
 * One post of GET /feed (TASK-118): a drawing as a profile lists it, with
 * who published it. Opened whole with GET /drawings/{id}.
 */
export interface FeedPost extends Drawing {
  author: DrawingAuthor;
}

/**
 * GET /feed?limit=20&cursor=…&lat=…&lon=…: the drawings the reader may
 * see, its own first, then those of the people it follows, then the
 * others' near the point sent (all of them without one), the last
 * published first in each group. Never a private one. The pages follow
 * the cursor: a drawing published between two pages goes above it, and
 * the next page neither repeats nor skips one.
 */
export interface FeedPage {
  posts: FeedPost[];
  /** The `cursor` of the next page; null on the last one. */
  next: string | null;
}

/** The orders of GET /search/drawings (TASK-344, ADR-0297): the last
 * published, the longest, the one with the most reactions first. */
export const DRAWING_SORTS = ["recent", "longest", "popular"] as const;
export type DrawingSort = (typeof DRAWING_SORTS)[number];

/** How complex a drawing's line is, a filter of GET /search/drawings. */
export const DRAWING_COMPLEXITIES = ["simple", "medium", "complex"] as const;
export type DrawingComplexity = (typeof DRAWING_COMPLEXITIES)[number];

/**
 * How complex a line is: its length over the diagonal of the rectangle it
 * fits in, on at most 64 of its points. Below the first, simple; below the
 * second, medium; complex above. The same on the server
 * (drawing_search.py) and for the examples on the phone.
 */
export const DRAWING_SIMPLE_BELOW = 3.6;
export const DRAWING_MEDIUM_BELOW = 4.5;

/** Posts a page of GET /search/drawings holds unless `limit` says. */
export const DRAWING_SEARCH_PAGE_SIZE = 20;

/**
 * GET /search/drawings?q=…&named=…&shape=…&activity=…&min_m=…&max_m=…
 * &place=…&complexity=…&sort=…&limit=20&cursor=… (TASK-344): the drawings
 * the reader may see that hold every word of `q`, capitals and accents
 * aside, or are of a shape in `named`, and pass every filter. A list
 * filter is sent once for each value. Never a private one. A page is the
 * feed's.
 */
export type DrawingSearchPage = FeedPage;

/**
 * What a member reports with POST /reports (TASK-121, ADR-0228): a drawing
 * (a post of the feed), a comment, a member, a group run (TASK-309), or a
 * private message (TASK-319: only the one it was sent to reports it).
 */
export const REPORT_KINDS = [
  "drawing",
  "comment",
  "user",
  "group_run",
  "message",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/**
 * The short list of reasons, in the order the app shows them. Codes, never
 * the words: the app says them in its language.
 */
export const REPORT_REASONS = [
  "spam",
  "offensive",
  "harassment",
  "sexual",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * POST /reports: kept once for each reporter and thing, the latest reason
 * kept; 204. `id` is the drawing's id, the comment's id, the member's
 * public_id or the message's id. PUT and DELETE /users/{public_id}/block keep two members
 * apart both ways, and GET /me/blocked is a PeoplePage of those blocked.
 */
export interface ReportRequest {
  kind: ReportKind;
  id: string;
  reason: ReportReason;
}

/** The platform of a phone, as the push service names it (TASK-262). */
export type PushPlatform = "ios" | "android";

/** The languages a push notification is written in (TASK-262). */
export type PushLanguage = "en" | "de" | "it" | "es" | "fr";

/**
 * PUT /me/push-token (TASK-262): this phone's Expo push token, sent once the
 * phone allowed notifications and «Push notifications» is on. `language`
 * is the app's on this phone: the notifications are written in it, in
 * English without it. Taken back with DELETE /me/push-token/{token}. Both
 * answer 204.
 */
export interface PushTokenRequest {
  token: string;
  platform: PushPlatform;
  language?: PushLanguage | null;
}

/**
 * What a push notification tells of (TASK-262). `contest_won` (TASK-299)
 * goes to the winner of a contest and opens its post.
 */
export type PushKind =
  "follow_request" | "follow_accepted" | "reaction" | "comment" | "tag" | "contest_won";

/**
 * The `data` of a push notification (TASK-262): what the app opens when it
 * is touched. A drawing for a reaction, a comment or a tag; the profile of
 * who acted for a follow request or a request accepted.
 */
export type PushData =
  | { kind: PushKind; drawing_id: string }
  | { kind: PushKind; public_id: string; username: string };

// --- The shape game (TASK-296, ADR-0255; docs/GIOCO.md) ---

/**
 * The push notification of the game (TASK-296), beside `PushKind`: a shape
 * unlocked. Its `data` carries the runner's own profile, as a follow
 * event's would; the app opens «Play» instead.
 */
export type GamePushKind = "shape_unlocked";

/**
 * What a shape of the game asks (GET /game/catalog): so many metres in
 * all, or `distance_m` in one run at `pace_s` seconds a kilometre or
 * better. The fields of the other kind are null.
 */
export type GameGoal =
  | { kind: "distance"; total_m: number; distance_m: null; pace_s: null }
  | { kind: "pace"; total_m: null; distance_m: number; pace_s: number };

/** A shape to collect, as the API's catalog serves it. */
export interface GameShape {
  id: string;
  /** Its name in each language of the app (en, de, it, es, fr). */
  names: Record<PushLanguage, string>;
  goal: GameGoal;
  /** Closed (the last point is the first), from 0 to 1, y downwards as on
   * a screen: a drawing, never a place. */
  outline: [number, number][];
}

/** GET /game/catalog: the shapes of the game. Without an account; an API
 * before the game answers 404, and the app shows no «Play» (ADR-0255). */
export interface GameCatalog {
  rules_version: number;
  shapes: GameShape[];
}

/** One shape of the catalog, for the account: when it was unlocked, or how
 * far along it is (1 once unlocked; before, at most 0.99). */
export interface GameShapeState {
  id: string;
  unlocked_at: string | null;
  progress: number;
}

/** GET /game/me: the game of the account. `best_s` has the best moving
 * seconds by distance in metres, as text: {"1000": 287.4}. */
export interface GameMe {
  counted_m: number;
  longest_m: number;
  best_s: Record<string, number>;
  shapes: GameShapeState[];
}

/** Why a run does not count for the game, or counts less (docs/GIOCO.md §4). */
export type RunGameReason = "not_running" | "vehicle" | "overlap" | "daily_cap";

/** GET /game/runs/{key}: what one saved run was worth, and the shapes it
 * unlocked, in catalog order; 404 until the run is saved. */
export interface RunGame {
  counted: boolean;
  reason: RunGameReason | null;
  counted_m: number;
  best_s: Record<string, number>;
  unlocked: string[];
}

/** The most hashes one POST /people/from-contacts takes (TASK-262 C). */
export const CONTACT_HASHES_MAX = 500;

/**
 * POST /people/from-contacts (TASK-262 C, ADR-0226): the phone numbers of
 * the phone's contacts, each written in E.164 and hashed with SHA-256, in
 * lower-case hex. The server compares them with the SHA-256 of the numbers
 * the members saved (TASK-183) and keeps none of them: neither in the
 * database nor in a log.
 */
export interface ContactsPeopleRequest {
  /** 1 to CONTACT_HASHES_MAX, each 64 lower-case hex digits. */
  hashes: string[];
}

/** A member found from the contacts, and where the one who asks stands towards it. */
export interface ContactPerson extends Person {
  follow: FollowState;
}

/**
 * The answer of POST /people/from-contacts: the members who saved one of
 * the numbers, by name; never the one who asks, nor one it blocked or
 * that blocked it.
 */
export interface ContactsPeople {
  people: ContactPerson[];
}

// --- The shape game, teams and challenges (TASK-296 parts C and D, ADR-0255; docs/API.md «Shape game», part C) ---

/**
 * The push notifications of a challenge (TASK-296 C), beside `PushKind`
 * and `GamePushKind`: a team-mate finished a piece, the team completed the
 * shape, one day is left. Their `data` is `{ kind, challenge_id }`, and the
 * app opens the challenge.
 */
export type ChallengePushKind = "piece_done" | "challenge_done" | "challenge_ending";

/** The `data` of a challenge's notification. */
export interface ChallengePushData {
  kind: ChallengePushKind;
  challenge_id: string;
}

/** The limits of a challenge, as the API checks them (docs/GIOCO.md §6.2). */
export const CHALLENGE_PIECES_MIN = 2;
export const CHALLENGE_PIECES_MAX = 12;
export const CHALLENGE_PIECE_M_MIN = 1_000;
export const CHALLENGE_PIECE_M_MAX = 50_000;
/** A fast piece is run over one of these distances, in metres. */
export const CHALLENGE_FAST_DISTANCES_M: readonly number[] = [1_000, 5_000];
export const CHALLENGE_PACE_S_MIN = 150;
export const CHALLENGE_PACE_S_MAX = 900;
export const CHALLENGE_DAYS_MIN = 1;
export const CHALLENGE_DAYS_MAX = 14;
export const CHALLENGE_DAYS_DEFAULT = 7;
/** A team takes this many members, and an account is in this many teams. */
export const TEAM_MEMBERS_MAX = 20;
export const TEAMS_MAX = 10;
export const TEAM_NAME_MAX_LENGTH = 40;

/** POST /game/teams: the team's name, 1 to TEAM_NAME_MAX_LENGTH characters
 * on one line. */
export interface TeamRequest {
  name: string;
}

/** POST /game/teams/join: the invite code, six characters in any case. */
export interface JoinTeamRequest {
  code: string;
}

/**
 * What every piece of a challenge asks (POST /game/teams/{id}/challenges):
 * `total_m` metres, or `distance_m` (one of CHALLENGE_FAST_DISTANCES_M) in
 * one run at `pace_s` seconds a kilometre or better.
 */
export type PieceRequest =
  | { kind: "distance"; total_m: number }
  | { kind: "pace"; distance_m: number; pace_s: number };

/** POST /game/teams/{id}/challenges: a shape of the catalog in `pieces`
 * pieces, each asking `piece`, for `days` days (CHALLENGE_DAYS_DEFAULT). */
export interface ChallengeRequest {
  shape_id: string;
  pieces: number;
  piece: PieceRequest;
  days?: number;
}

/** A challenge is `active` until it is complete, or three hours past its
 * deadline: then `expired`. */
export type ChallengeStatus = "active" | "completed" | "expired";

/** Who holds a piece: never the picture, which the team's members have. */
export interface PieceHolder {
  public_id: string;
  username: string;
}

/** One piece of a challenge: its goal (as a shape's), who holds it, how
 * much is run, and its stretch of the shape's outline, from 0 to 1. */
export interface ChallengePiece {
  idx: number;
  goal: GameGoal;
  holder: PieceHolder | null;
  done_m: number;
  done: boolean;
  /** `pieces_of(outline, n)` on the API: the phone cuts the same way. */
  outline: [number, number][];
}

/** The metres a member gave to a piece, all its runs together. */
export interface ChallengeContribution {
  public_id: string;
  username: string;
  idx: number;
  metres: number;
}

/** A challenge as its team sees it (GET /game/challenges/{id}): no time or
 * place of any run, only pieces and metres. */
export interface GameChallenge {
  id: string;
  team_id: string;
  shape_id: string;
  status: ChallengeStatus;
  /** ISO 8601, UTC. */
  starts_at: string;
  ends_at: string;
  completed_at: string | null;
  /** To the deadline; 0 once past. */
  seconds_left: number;
  pieces: ChallengePiece[];
  contributions: ChallengeContribution[];
}

/** A team as its members see it: everyone has the code to share. */
export interface GameTeam {
  id: string;
  name: string;
  code: string;
  /** The public_id of who created it and removes members; null if gone. */
  owner: string | null;
  /** In the order they joined. */
  members: Person[];
  /** The newest challenge, whatever its status; null before one. */
  challenge: GameChallenge | null;
}

/** GET /game/teams: the account's teams, the first joined first. */
export interface GameTeams {
  teams: GameTeam[];
}

/** A piece a saved run finished (GET /game/runs/{key}, `pieces_done`,
 * since part C). */
export interface PieceDone {
  challenge_id: string;
  team_id: string;
  team_name: string;
  shape_id: string;
  idx: number;
  pieces: number;
  challenge_completed: boolean;
}

/** GET /game/runs/{key} since part C: also the pieces the run finished. */
export interface RunGameWithPieces extends RunGame {
  pieces_done: PieceDone[];
}

/** GET /game/me since part C: each shape also says when the account got
 * its team edition, in a completed challenge; null without. */
export interface GameShapeStateWithTeam extends GameShapeState {
  team_unlocked_at: string | null;
}

// --- The first contest (TASK-299, ADR-0260; docs/CONCORSI.md) ---

/**
 * One of the first posts of a contest (GET /contests/current). `rank` is
 * its place in the whole standings: with a token, a post across a block
 * with who asks is left out of `top`, and the others keep their numbers.
 * `reactions` are the ones that count: one per member, never the author's
 * own, none across a block with the author, left by `ends_at`.
 */
export interface ContestEntry {
  rank: number;
  reactions: number;
  drawing: FeedPost;
}

/** The best post of who asks in the contest: its place and its reactions. */
export interface ContestMine {
  drawing_id: string;
  rank: number;
  reactions: number;
}

/** The winner, once the contest is closed; `drawing` is null when its run
 * was deleted since. */
export interface ContestWinner {
  reactions: number;
  drawing: FeedPost | null;
}

/**
 * GET /contests/current: the contest open, or closed less than a week ago
 * (the week of the winner's post at the top of the Feed); 404 `no_contest`
 * otherwise, and the app shows no card. Without a token `mine` is missing;
 * with one it is null when who asks has no post that takes part. `top` has
 * at most three posts, in order: more reactions, then more MuW hearts, then
 * the one published first. `winner` is null while open.
 */
export interface Contest {
  id: string;
  /** ISO 8601, with the offset. */
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
  top: ContestEntry[];
  mine?: ContestMine | null;
  winner: ContestWinner | null;
}

// --- The monthly challenges (TASK-343, ADR-0296; docs/CONCORSI.md §15) ---

/** A theme in one language. */
export interface ContestThemeText {
  /** 1 to 60 characters. */
  title: string;
  /** 1 to 500 characters. */
  description: string;
}

/**
 * The theme of a monthly challenge, by language: the app shows its own,
 * English when it is missing.
 */
export interface ContestTheme {
  en: ContestThemeText;
  de?: ContestThemeText | null;
  it?: ContestThemeText | null;
  es?: ContestThemeText | null;
  fr?: ContestThemeText | null;
}

/**
 * GET /contests/current for a monthly challenge: a `Contest` with its theme.
 * Only the drawings entered take part, so `top`, `mine` and `winner` are of
 * those. `entrants` counts the accounts with a drawing that takes part;
 * `entered`, only with a token, the drawings of who asks entered, whether
 * they still take part or not. A contest without a theme has none of these
 * three fields.
 */
export interface ThemedContest extends Contest {
  theme: ContestTheme;
  entrants: number;
  entered?: string[];
}

/** The orders of the gallery: by place, or the latest published first. */
export type ContestGalleryOrder = "top" | "new";

/**
 * GET /contests/{id}/entries?order=top|new&cursor=: a page of 30 of the
 * whole standings of a contest. With a token a post across a block with who
 * asks is left out, and the others keep their `rank`.
 */
export interface ContestEntriesPage {
  entries: ContestEntry[];
  /** The `cursor` of the next page, of the same order; null on the last. */
  next: string | null;
}

/** A contest closed, in the archive. */
export interface PastContest {
  id: string;
  starts_at: string;
  ends_at: string;
  closed_at: string;
  /** Null for a contest without a theme. */
  theme: ContestTheme | null;
  entrants: number;
  /** The first three, as in `Contest`. */
  top: ContestEntry[];
  winner: ContestWinner;
}

/** GET /contests?state=closed&cursor=: a page of 10, the latest closed first. */
export interface PastContestsPage {
  contests: PastContest[];
  next: string | null;
}

/**
 * The push notifications of a monthly challenge, beside `PushKind`: a new
 * one opened, its last 3 days, its results. Their `data` is
 * `{ kind, contest_id }`, and the app opens the page of the challenge. The
 * winner still hears `contest_won`.
 */
export type ContestPushKind = "contest_open" | "contest_last_days" | "contest_results";

/** The `data` of a monthly challenge's notification. */
export interface ContestPushData {
  kind: ContestPushKind;
  contest_id: string;
}

/** The longest message «Send feedback» takes (TASK-308). */
export const MAX_FEEDBACK_LENGTH = 2000;

/**
 * POST /feedback (TASK-308, ADR-0268): what a member writes to whoever runs
 * MuW, 1 to MAX_FEEDBACK_LENGTH characters once the spaces at either end
 * are gone; 204. No endpoint reads it back: it is emailed with the
 * member's username and address. At most 5 in any 24 hours, then 429
 * `too_many_requests` with the seconds to wait.
 */
export interface FeedbackRequest {
  text: string;
  /** The app's version and build, like «1.0.0 (7)». */
  app_version?: string | null;
  platform?: PushPlatform | null;
}

// --- Group runs (TASK-309, ADR-0269; docs/EVENTI.md, docs/API.md «Group runs») ---

/** Who sees a group run: every member, or who follows the organiser with
 * the request accepted. It does not change after the creation. */
export type GroupRunVisibility = "everyone" | "followers";

/**
 * Where a group run stands, by the server's clock: `upcoming` until its
 * start (the organiser may change or cancel it), `started` for the next
 * GROUP_RUN_OVER_AFTER_HOURS («I'm going» still holds), then `over`;
 * `cancelled` whenever the organiser cancelled it.
 */
export type GroupRunStatus = "upcoming" | "started" | "over" | "cancelled";

/** The limits of a group run, as the API checks them (docs/EVENTI.md §3). */
export const GROUP_RUN_TITLE_MAX = 60;
export const GROUP_RUN_MEETING_NOTE_MAX = 80;
export const GROUP_RUN_DESCRIPTION_MAX = 500;
/** `starts_at` from this many minutes to this many days from now. */
export const GROUP_RUN_EARLIEST_MINUTES = 30;
export const GROUP_RUN_LATEST_DAYS = 60;
export const GROUP_RUN_OVER_AFTER_HOURS = 3;
/** Not over and not cancelled, per account. */
export const GROUP_RUNS_UPCOMING_MAX = 10;

/**
 * POST /group-runs (201 `GroupRunDetail`): the route as PUT
 * /me/favorites/{key} keeps it, whole, with a title of its own, and when
 * and where to meet. The meeting point is the route's first point. The
 * three texts pass the filter of the comments: `422 comment_rejected`.
 * `starts_at` is ISO 8601 with its offset.
 */
export interface GroupRunRequest {
  city: string;
  shape: string | null;
  word: string | null;
  style: "round" | "block" | null;
  title: string;
  distance_m: number;
  route_m: number;
  similarity: number;
  points: LatLon[];
  walks?: Walk[];
  on_foot?: Stretch[];
  /** Left out for a run, as for a favorite. */
  activity?: string;
  rotation_deg?: number | null;
  starts_at: string;
  /** «Where exactly», one line. */
  meeting_note?: string | null;
  description?: string | null;
  visibility: GroupRunVisibility;
}

/**
 * PUT /group-runs/{id} (200 `GroupRunDetail`), the organiser only, before
 * the start: all four, and a note or a description left out is taken away.
 * A new time is checked as at the creation; a new time or place tells who
 * goes (`group_run_changed`) and the reminder is sent again.
 */
export interface GroupRunChange {
  title: string;
  starts_at: string;
  meeting_note?: string | null;
  description?: string | null;
}

/** A group run on a card: the Feed's row, a profile. */
export interface GroupRun {
  id: string;
  title: string;
  /** ISO 8601 in UTC: the app shows it in the phone's time. */
  starts_at: string;
  meeting_note: string | null;
  visibility: GroupRunVisibility;
  status: GroupRunStatus;
  organiser: Person;
  /** How many go, the organiser included, as who asks sees them. */
  going: number;
  /** The first three of them, the organiser first. */
  faces: Person[];
  /** Whether who asks goes; always for the organiser. */
  i_am_going: boolean;
  activity: string;
  city: string;
  shape: string | null;
  word: string | null;
  style: string | null;
  distance_m: number;
  route_m: number;
  similarity: number;
  /** The meeting point: the route's first point. */
  start: LatLon;
  preview: LatLon[];
  rotation_deg: number | null;
  created_at: string;
}

/**
 * GET /group-runs/{id}: the group run whole, also once cancelled or over;
 * 404 for who does not see it, as for an id that is not there.
 */
export interface GroupRunDetail extends GroupRun {
  description: string | null;
  points: LatLon[];
  walks: Walk[];
  on_foot: Stretch[];
  /** The first 20 who go, the organiser first; GET
   * /group-runs/{id}/going?cursor=`next` (a `PeoplePage`) for the others. */
  people: Person[];
  next: string | null;
}

/**
 * GET /group-runs?lat=…&lon=…: the Feed's row, at most 20, the nearest in
 * time first. The app shows the row only when it is not empty.
 */
export interface GroupRunsPage {
  group_runs: GroupRun[];
}

/** GET /users/{public_id}/group-runs: those not over yet, the nearest
 * first, and the last 20 over, the latest first; never the cancelled. */
export interface ProfileGroupRuns {
  upcoming: GroupRun[];
  past: GroupRun[];
}

/**
 * The push notifications of a group run, beside `PushKind`: it starts
 * within the hour (to who goes, the organiser too), its time or place
 * changed, it was cancelled. Their `data` is `{ kind, group_run_id }`, and
 * the app opens the group run. Nobody is told of a new «I'm going».
 */
export type GroupRunPushKind =
  "group_run_soon" | "group_run_changed" | "group_run_cancelled";

/** The `data` of a group run's notification. */
export interface GroupRunPushData {
  kind: GroupRunPushKind;
  group_run_id: string;
}

/**
 * POST /way-back (TASK-314, ADR-0274): the way back to the route, on the
 * streets, for a runner off it. `ahead` is the stretch of the route where
 * the runner may rejoin it, in the route's order (ADR-0263). Answered by
 * the engine on the phone first, with the same bodies.
 */
export interface WayBackRequest {
  activity: Activity;
  here: LatLon;
  ahead: LatLon[];
}

/**
 * The way from the runner along the streets to `rejoin`, where it reaches
 * the route: `rejoin_m` along `ahead`, from its first point. The
 * directions' `distance_m` are along `points`: the street the way starts
 * on first, the turn onto the route last. No way back is a 422
 * `invalid_request`; no map kept for the area, 503 `map_data_unavailable`;
 * asked too often, 429. An API older than TASK-314 answers 404.
 */
export interface WayBack {
  points: LatLon[];
  distance_m: number;
  rejoin: LatLon;
  rejoin_m: number;
  directions: Direction[];
}

// --- Private messages (TASK-319, ADR-0279; docs/API.md «Messages») ---

/** The limit of a message, checked by the API too. */
export const MESSAGE_MAX_LENGTH = 1000;

/**
 * Where who asks stands in a conversation:
 * - "open": it writes freely;
 * - "first": it writes one message, which the other gets as a request;
 * - "waiting": it wrote that one, and writes again once the other accepts
 *   (POST answers 409 meanwhile);
 * - "request": the other wrote it a request: Accept, Delete or Block.
 */
export const CONVERSATION_STATES = ["open", "first", "waiting", "request"] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

/** The two lists of GET /me/conversations?box=. */
export type ConversationBox = "inbox" | "requests";

/**
 * POST /conversations/{public_id}/messages: plain text, 1 to
 * MESSAGE_MAX_LENGTH characters once the spaces at either end are gone; new
 * lines are kept. The answer is the Message (201). The one message of a
 * request is refused as a comment ("comment_rejected") when negative.
 * With an attachment (TASK-333) the text may be empty; outside an "open"
 * conversation an attachment is 409.
 */
export interface MessageRequest {
  text: string;
  attachment?: MessageAttachmentRequest;
}

/** One message, as who asks sees it. */
export interface Message {
  id: string;
  /**
   * Plain text: shown as text, never as a link or HTML. Asked without
   * `?with=attachments`, a message with an attachment says «[Photo]»,
   * «[Video]» or «[Drawing]» before it, for an app of before.
   */
  text: string;
  created_at: string;
  /** Who asks wrote it, and may delete it (DELETE /messages/{id}). */
  mine: boolean;
  /** What it carries besides its text; null: nothing. Missing from an API
   * before TASK-333. */
  attachment?: MessageAttachment | null;
}

/**
 * GET /conversations/{public_id}/messages: a page, the latest first; no
 * messages before the first one is written. 404 for nobody, or someone a
 * block keeps apart; 422 for oneself.
 */
export interface MessagesPage {
  /** Who the conversation is with: never the email. */
  person: Person;
  state: ConversationState;
  messages: Message[];
  /** The `cursor` of the page of older ones; null on the oldest. */
  next: string | null;
  /**
   * What who asks may attach now (TASK-333): null outside an "open"
   * conversation. Missing from an API before it: then no «+».
   */
  attachments?: AttachmentsAllowed | null;
}

/** The most `unread_count` counts: beyond it the app says «9+» anyway. */
export const CONVERSATION_UNREAD_COUNT_MAX = 10;

/** One conversation in a list: who with, and its latest message. */
export interface Conversation {
  person: Person;
  last: Message;
  /** The other wrote since who asks last read it (PUT …/read). */
  unread: boolean;
  /**
   * How many it wrote since, up to CONVERSATION_UNREAD_COUNT_MAX (TASK-353);
   * missing on a server of before.
   */
  unread_count?: number;
}

/**
 * GET /me/conversations?box=inbox|requests: a page, the latest message
 * first. PUT /conversations/{public_id}/accept takes a request into the
 * inbox, DELETE /conversations/{public_id} takes a conversation out of
 * one's own view; both answer 204.
 */
export interface ConversationsPage {
  conversations: Conversation[];
  /** The `cursor` of the next page; null on the last one. */
  next: string | null;
  /** How many conversations the box has, on every page. */
  total: number;
}

/** GET /me/conversations/unread: what the dot of «Messages» counts. */
export interface ConversationsUnread {
  /** Conversations of the inbox with a message not read yet. */
  unread: number;
  /** Message requests waiting for an answer. */
  requests: number;
}

/**
 * The push notifications of the messages, beside `PushKind`: a message
 * (with its beginning), a message request (once a day for each writer).
 * Their `data` is the profile of who wrote, as a follow event's; the app
 * opens the conversation.
 */
export type MessagePushKind = "message" | "message_request";

/** The `data` of a message's notification. */
export interface MessagePushData {
  kind: MessagePushKind;
  public_id: string;
  username: string;
}

// --- Attachments of the private messages (TASK-333, ADR-0289) ---

/** What a message may carry besides its text. */
export const MESSAGE_ATTACHMENT_KINDS = ["photo", "video", "drawing"] as const;
export type MessageAttachmentKind = (typeof MESSAGE_ATTACHMENT_KINDS)[number];
/** The user's limits of 2026-10-29, checked by the API too. */
export const MESSAGE_VIDEO_MAX_S = 60;
export const MESSAGE_VIDEO_MAX_BYTES = 40_000_000;
/** A video is kept this long after its message, then `expired`. */
export const MESSAGE_VIDEO_DAYS = 30;
/** Ask the pages and POST with this, `?with=attachments`, to read the
 * attachments: without, the text says «[Photo]» and the like. */
export const WITH_ATTACHMENTS = "attachments";

/**
 * A drawing sent in a message: a copy of the route, the body PUT
 * /me/favorites/{key} takes (the app's FavoriteRequest). A run of who sends
 * it goes cut as in the Feed; a route planned goes whole, with its start.
 * GET /messages/{id}/drawing answers it.
 */
export interface MessageDrawing {
  city: string;
  shape: string | null;
  word: string | null;
  style: LetterStyle | null;
  title: string | null;
  distance_m: number;
  route_m: number;
  similarity: number;
  points: LatLon[];
  walks?: Walk[];
  activity?: Activity;
  on_foot?: Stretch[];
  rotation_deg?: number | null;
}

/**
 * A message's attachment: a photo or video sent first with POST
 * /me/message-media (the file's bytes as the body, Content-Type image/jpeg,
 * image/png, video/mp4 or video/quicktime), or a drawing. One of the two.
 */
export type MessageAttachmentRequest =
  | { media_id: string; drawing?: undefined }
  | { drawing: MessageDrawing; media_id?: undefined };

/** POST /me/message-media (201): the file kept, to send within the hour. */
export interface MessageMedia {
  id: string;
  kind: "photo" | "video";
  /** As shown: a photo at most 1080 px on its longer side. */
  width: number | null;
  height: number | null;
  /** A video's length. */
  duration_ms: number | null;
  bytes: number;
}

/** A drawing as the conversation shows it; GET /messages/{id}/drawing has
 * it whole, as a MessageDrawing. */
export interface MessageDrawingCard {
  title: string | null;
  shape: string | null;
  word: string | null;
  style: LetterStyle | null;
  distance_m: number;
  route_m: number;
  activity: string;
  rotation_deg: number | null;
  /** At most 64 points of its line. */
  preview: LatLon[];
}

/** What a message carries besides its text. */
export interface MessageAttachment {
  kind: MessageAttachmentKind;
  /** A photo's or a video's: GET /message-media/{media_id}, with the key
   * and the token. Null for a drawing and a video expired. */
  media_id: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  /** A video's first picture: GET /message-media/{media_id}/poster. */
  poster: boolean;
  /** A video MESSAGE_VIDEO_DAYS after its message: «This video has expired.» */
  expired: boolean;
  drawing: MessageDrawingCard | null;
}

/**
 * What may be attached in a conversation now. "video" leaves while the
 * server is full of them (POST /me/message-media is then 507).
 */
export interface AttachmentsAllowed {
  kinds: MessageAttachmentKind[];
  video_max_s: number;
  video_max_bytes: number;
  photo_max_bytes: number;
}
/**
 * A photo of a drawing on a profile (TASK-324): GET /users/{public_id}/photos.
 * Read as DrawingPhoto from `url`; a tap opens its drawing.
 */
export interface UserPhoto extends DrawingPhoto {
  drawing_id: string;
  /** The drawing's; null: none, named by its day. */
  title: string | null;
  /** When the drawing's run began, ISO 8601. */
  started_at: string;
}

/** A page of a profile's photos, the latest run first (TASK-324). */
export interface UserPhotosPage {
  photos: UserPhoto[];
  /** The `cursor` of the next page; null on the last one. */
  next: string | null;
}
