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

/** What a route is for: on foot, by bike on the roads a bike may ride,
 * one-way streets kept (TASK-190, ADR-0153), or paddling on a lake or the
 * sea within 1 km of the shore, a shape of the catalogue only (TASK-191,
 * ADR-0161). */
export const ACTIVITIES = ["running", "cycling", "paddling"] as const;
export type Activity = (typeof ACTIVITIES)[number];

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
}

/**
 * What an account chose about being notified (TASK-185): both off until
 * turned on. With «Push notifications» on the API sends push notifications
 * to the phones of the account (TASK-262); no email of the news is sent
 * yet.
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
 * account. It holds at once; the answer is the User.
 */
export interface ChangeEmailRequest {
  email: string;
  password: string;
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
}

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
/** Besides the map, the first picture of a drawing. */
export const DRAWING_MAX_PHOTOS = 3;

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

/** A member tagged in a drawing: never the email. */
export interface DrawingTag {
  public_id: string;
  username: string;
}

/** A photo of a drawing, besides its map (TASK-208). */
export interface DrawingPhoto {
  /** Its place, 1 to DRAWING_MAX_PHOTOS: a place emptied stays empty. */
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
  tags?: DrawingTag[];
  photos?: DrawingPhoto[];
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
  tags?: DrawingTag[];
  photos?: DrawingPhoto[];
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

/**
 * What a member reports with POST /reports (TASK-121, ADR-0228): a drawing
 * (a post of the feed), a comment, or a member.
 */
export const REPORT_KINDS = ["drawing", "comment", "user"] as const;
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
 * kept; 204. `id` is the drawing's id, the comment's id or the member's
 * public_id. PUT and DELETE /users/{public_id}/block keep two members
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

/** What a push notification tells of (TASK-262). */
export type PushKind =
  "follow_request" | "follow_accepted" | "reaction" | "comment" | "tag";

/**
 * The `data` of a push notification (TASK-262): what the app opens when it
 * is touched. A drawing for a reaction, a comment or a tag; the profile of
 * who acted for a follow request or a request accepted.
 */
export type PushData =
  | { kind: PushKind; drawing_id: string }
  | { kind: PushKind; public_id: string; username: string };
