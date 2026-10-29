"""Start the API: python -m shaperoute_api [--lan] [--port 8000] [--ai-model ...]
[--request-log].

The key and the limit come from the environment, never from the command
line, which stays in the shell history (SHAPEROUTE_API_KEY and
SHAPEROUTE_RATE_LIMIT, docs/DEPLOY.md); so does the address of the accounts'
database, which holds a password (SHAPEROUTE_DATABASE_URL, docs/DATABASE.md).
"""

from __future__ import annotations

import argparse
import logging
import socket
from collections.abc import Sequence
from pathlib import Path

import psycopg
import uvicorn
from route_engine.shapes import SUPPORTED_SHAPES
from shaperoute_ai.ollama import DEFAULT_MODEL, DEFAULT_URL, OllamaModel
from shaperoute_ai.reading import ShapeReader
from shaperoute_ai.theme_reading import ThemeReader

from shaperoute_api.access import KEY_HEADER, KEY_VARIABLE, Access, AccessConfigError
from shaperoute_api.access_log import hide_query_strings
from shaperoute_api.account_email import (
    AccountEmails,
    AccountLinks,
    install_account_email,
)
from shaperoute_api.accounts import Accounts
from shaperoute_api.activity_graphs import ActivityGraphs
from shaperoute_api.app import create_app
from shaperoute_api.away_email import KEY_VARIABLE as RESEND_KEY
from shaperoute_api.away_email import (
    AwayConfigError,
    AwayEmails,
    AwaySetup,
    DailyRound,
    install_away_email,
)
from shaperoute_api.cities import CitySearch
from shaperoute_api.city_photos import PHOTOS_FOLDER, CityPhotos, install_city_photos
from shaperoute_api.db import DATABASE_VARIABLE, Database, MigrationError
from shaperoute_api.feedback import (
    FeedbackConfigError,
    FeedbackEmails,
    FeedbackSetup,
    install_feedback_email,
)
from shaperoute_api.insights import Insights
from shaperoute_api.insights.events import DEFAULT_DIR as INSIGHTS_DIR
from shaperoute_api.insights.events import OFF_VARIABLE as INSIGHTS_OFF
from shaperoute_api.insights.events import EventLog
from shaperoute_api.insights.events import wanted as insights_wanted
from shaperoute_api.insights.vocabulary import DEFAULT_PATH as VOCABULARY
from shaperoute_api.insights.vocabulary import Vocabulary
from shaperoute_api.kept_routes import install_kept_routes
from shaperoute_api.media_files import MediaConfigError
from shaperoute_api.message_media import (
    SweepRound,
    install_message_media,
    message_media_from,
)
from shaperoute_api.nearby_cities import NearbyCities, install_nearby_cities
from shaperoute_api.notice_email import (
    NoticeEmails,
    NoticeSetup,
    install_notice_email,
)
from shaperoute_api.phone_zone_api import install_phone_zones
from shaperoute_api.places import KEY_VARIABLE as PLACES_KEY
from shaperoute_api.places import PlaceSearch
from shaperoute_api.recommended import DEFAULT_DIR as CATALOG_DIR
from shaperoute_api.recommended import RecommendedCatalog
from shaperoute_api.report_email import TO_VARIABLE as REPORTS_TO
from shaperoute_api.report_email import (
    ReportConfigError,
    ReportEmails,
    ReportSetup,
    install_report_email,
)
from shaperoute_api.request_log import DEFAULT_DIR, ON_VARIABLE, RequestLog, wanted
from shaperoute_api.route_archive import RouteArchive
from shaperoute_api.route_store import STORE_FOLDER, RouteStore
from shaperoute_api.themed import StopFinder, ThemedJobs
from shaperoute_api.water_spots import read_spots

DEFAULT_PORT = 8000


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api",
        description="Serve the route engine over HTTP (docs/API.md).",
    )
    parser.add_argument(
        "--lan",
        action="store_true",
        help="answer the whole local network (the phone), not only this PC",
    )
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=Path("data/cache"),
        help="where road graphs are cached (default: data/cache, like the CLI)",
    )
    parser.add_argument(
        "--ai-model",
        default=DEFAULT_MODEL,
        help=f"the Ollama model that reads shape words (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--ai-url",
        default=DEFAULT_URL,
        help=f"where Ollama answers (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--media-dir",
        type=Path,
        default=Path("data/media"),
        help=(
            "where the photos and videos of the messages are kept"
            " (default: data/media; never in the database)"
        ),
    )
    parser.add_argument(
        "--request-log",
        action="store_true",
        help=(
            f"record each route request, start included, to redo it with "
            f"python -m shaperoute_api.replay (also {ON_VARIABLE}=1)"
        ),
    )
    parser.add_argument(
        "--request-log-dir",
        type=Path,
        default=DEFAULT_DIR,
        help=f"where the request log is written (default: {DEFAULT_DIR})",
    )
    parser.add_argument(
        "--no-route-store",
        action="store_true",
        help=(
            f"draw a city's examples each time, instead of keeping them in "
            f"{STORE_FOLDER}/ of the cache folder for the next to ask"
        ),
    )
    parser.add_argument(
        "--catalog-dir",
        type=Path,
        default=CATALOG_DIR,
        help=f"the recommended routes, one file per city (default: {CATALOG_DIR})",
    )
    parser.add_argument(
        "--no-insights",
        action="store_true",
        help=f"do not record search events (also {INSIGHTS_OFF}=0); "
        "they are recorded by default (TASK-130)",
    )
    parser.add_argument(
        "--insights-dir",
        type=Path,
        default=INSIGHTS_DIR,
        help=f"where search events are written (default: {INSIGHTS_DIR})",
    )
    parser.add_argument(
        "--vocabulary",
        type=Path,
        default=VOCABULARY,
        help="the learned vocabulary (default: the one in the repository)",
    )
    return parser.parse_args(argv)


def lan_address() -> str | None:
    """This PC's address on the local network, the one the phone must use."""
    # Connecting a UDP socket sends nothing: it only picks the interface that
    # would reach outside, which is the Wi-Fi one. 192.0.2.1 is never used.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        try:
            probe.connect(("192.0.2.1", 80))
        except OSError:
            return None
        address: str = probe.getsockname()[0]
        return address


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    try:
        access = Access.from_env()
        away_setup = AwaySetup.from_env()
        notice_setup = NoticeSetup.from_env()
        report_setup = ReportSetup.from_env()
        feedback_setup = FeedbackSetup.from_env()
    except (
        AccessConfigError,
        AwayConfigError,
        ReportConfigError,
        FeedbackConfigError,
    ) as exc:
        raise SystemExit(str(exc)) from None
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(message)s")
    # GET /places carries the position: not in the access log (ADR-0096).
    hide_query_strings()
    # Accounts (TASK-114): the schema brought up to date before the first
    # request. A database set but out of reach stops the API: better than
    # accounts that fail one request at a time.
    database = Database.from_env()
    migrated: list[str] = []
    if database is not None:
        try:
            migrated = database.migrate()
            # The requests share a few open connections (TASK-288 B).
            database = database.pooled()
        except (psycopg.Error, MigrationError) as exc:
            raise SystemExit(f"Database ({DATABASE_VARIABLE}): {exc}") from None
    accounts = None if database is None else Accounts(database)
    reader = ShapeReader(OllamaModel(args.ai_model, args.ai_url), SUPPORTED_SHAPES)
    request_log = RequestLog(args.request_log_dir) if wanted(args.request_log) else None
    places = PlaceSearch.from_env()
    recommended = RecommendedCatalog.from_dir(args.catalog_dir)
    # The zones of each activity's network, foot and bike (TASK-190).
    graphs = ActivityGraphs.from_cache(args.cache_dir)
    source = graphs.for_activity("running")
    cities = CitySearch(places.key)
    # A city's examples, kept once drawn (ADR-0136): beside the zones. And
    # the «Paddle» shapes of the lakes' and beaches' points (TASK-246 B).
    route_store = (
        None
        if args.no_route_store
        else RouteStore(
            args.cache_dir / STORE_FOLDER,
            water=[spot.point for spot in read_spots()],
        )
    )
    # Every route drawn, kept in the database for whoever asks it nearby
    # (ADR-0256), with the files behind it; without a database, the files.
    archive = (
        route_store if database is None else RouteArchive(database, behind=route_store)
    )
    # Search events, on by default (the user's choice, ADR-0101), and the
    # learned vocabulary: tables, then it, then the AI.
    insights = Insights(
        EventLog(args.insights_dir) if insights_wanted(args.no_insights) else None,
        Vocabulary.load(args.vocabulary),
    )
    # The photos of the towns nearby (TASK-283), beside the zones; those of
    # the places a themed route passes by too (TASK-329).
    photos = CityPhotos(args.cache_dir / PHOTOS_FOLDER)
    # Themed routes (TASK-129): the places with the key of the place search,
    # the AI only for words the tables do not know.
    themed = ThemedJobs(
        source,
        StopFinder(places.key),
        cities=cities,
        insights=insights,
        ai=ThemeReader(OllamaModel(args.ai_model, args.ai_url)),
        photos=photos,
    )
    app = create_app(
        graphs,
        reader=reader,
        request_log=request_log,
        places=places,
        recommended=recommended,
        themed=themed,
        cities=cities,
        insights=insights,
        accounts=accounts,
        route_store=archive,
    )
    # The towns near the user, under "Near me" in "Explore" (TASK-236), with
    # their photos (TASK-283).
    install_nearby_cities(app, NearbyCities(places.key, photos=photos), route_store)
    # The towns' examples already kept, read ahead by the app (TASK-316):
    # from the centres' files only, never the archive of users' starts.
    install_kept_routes(app, route_store)
    install_city_photos(app, photos)
    # The cached zones, for the phone that draws on them (TASK-214).
    install_phone_zones(app, args.cache_dir)
    # The email to who has not opened the app for two weeks (TASK-284): off
    # without the database, Resend's key, the links' secret and the domain.
    away = (
        None
        if database is None or away_setup is None
        else AwayEmails(database, away_setup)
    )
    install_away_email(app, away)
    if away is not None:
        DailyRound(away).start()
    # The daily email of the notices (TASK-262 B): on with the away email;
    # its round lives with the app.
    notices = (
        None
        if database is None or notice_setup is None
        else NoticeEmails(database, notice_setup)
    )
    install_notice_email(app, notices)
    # Each new report emailed to whoever runs MuW, with a link that hides
    # (TASK-291): off without the database, Resend and the address.
    report_emails = (
        None
        if database is None or report_setup is None
        else ReportEmails(database, report_setup)
    )
    install_report_email(app, report_emails)
    # The photos and videos of the messages (TASK-333), files under
    # --media-dir with their rows in the database, and the hourly round
    # that takes away those no longer kept: off without the database.
    try:
        message_media = (
            None
            if accounts is None
            else message_media_from(accounts.database, args.media_dir, accounts.now)
        )
    except MediaConfigError as exc:
        raise SystemExit(str(exc)) from None
    install_message_media(app, message_media)
    if message_media is not None:
        SweepRound(message_media).start()
    # Each message of «Send feedback» emailed to whoever runs MuW (TASK-308):
    # off without Resend and the address; the messages are kept either way.
    feedback_emails = None if feedback_setup is None else FeedbackEmails(feedback_setup)
    install_feedback_email(app, feedback_emails)
    # The emails of the accounts (TASK-300): the link that confirms an
    # address and the one that chooses a new password. Off as the one above.
    account_emails = (
        None
        if accounts is None or away_setup is None
        else AccountEmails(
            accounts,
            away_setup.resend,
            AccountLinks(away_setup.links.secret, away_setup.links.base_url),
        )
    )
    install_account_email(app, account_emails)
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    here = f"http://127.0.0.1:{args.port}"
    print(f"API docs on this PC: {here}/docs")
    print(f"Shape words read by {args.ai_model} in Ollama, {args.ai_url}")
    if access.key is None:
        print(f"No API key ({KEY_VARIABLE} not set): only for the home network")
    else:
        print(f"API key required in the {KEY_HEADER} header ({KEY_VARIABLE})")
    if access.posts_per_minute:
        print(f"At most {access.posts_per_minute} POSTs a minute from each client")
    if places.key is None:
        print(f"Place search off ({PLACES_KEY} not set): the app asks Photon")
    else:
        print(f"Places suggested by Geoapify ({PLACES_KEY})")
    print(f"{len(recommended)} recommended routes from {args.catalog_dir}")
    if insights.on:
        print(
            f"Search events in {args.insights_dir}, vocabulary "
            f"v{insights.vocab.version} (--no-insights to stop)"
        )
    else:
        print(f"Search events not recorded; vocabulary v{insights.vocab.version}")
    if accounts is None:
        print(f"Accounts off ({DATABASE_VARIABLE} not set): sign-up answers 503")
    else:
        done = ", ".join(migrated) if migrated else "none, schema up to date"
        print(f"Accounts in PostgreSQL ({DATABASE_VARIABLE}); migrations: {done}")
    if away is None:
        print(f"No email to who is away ({RESEND_KEY} and the rest not set)")
    else:
        at = away.setup.at.strftime("%H:%M")
        print(f"Email to who is away for 14 days: every day at {at} UTC")
    if notices is not None:
        at = notices.setup.at.strftime("%H:%M")
        print(f"Email of the notices: every day at {at} UTC, to who has it on")
    if report_emails is None:
        print(f"Reports are not emailed ({REPORTS_TO} and the rest not set)")
    else:
        print(f"Each new report is emailed ({REPORTS_TO})")
    if feedback_emails is None:
        print("Feedback is kept, not emailed (RESEND_API_KEY and the address not set)")
    else:
        print("Each message of «Send feedback» is emailed")
    if account_emails is None:
        print("Addresses are not confirmed and no password is reset by email")
    else:
        print("Addresses confirmed and passwords reset by email (Resend)")
    if request_log is None:
        print("Route requests are not recorded (--request-log records them)")
    else:
        print(f"Route requests recorded, start included, in {request_log.path}")
    if route_store is None:
        print("A city's examples are drawn each time (--no-route-store)")
    else:
        folder = args.cache_dir / STORE_FOLDER
        print(f"A city's examples are kept once drawn: {len(route_store)} in {folder}")
        print(
            f"Paddle shapes kept from {route_store.water_points} points on the "
            f"water: {route_store.kept_on_water()}"
        )
    if args.lan:
        address = lan_address() or "<this PC's address>"
        print(f"From the phone, same Wi-Fi: http://{address}:{args.port}/health")
    try:
        uvicorn.run(app, host=host, port=args.port)
    finally:
        # The app's end closes the pool; this, when the app never started.
        if database is not None:
            database.close()


if __name__ == "__main__":
    main()
