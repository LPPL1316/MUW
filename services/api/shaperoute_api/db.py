"""The database: where it is, and its schema brought up to date (TASK-114,
ADR-0115, docs/DATABASE.md).

PostgreSQL with PostGIS, reached with psycopg 3 and SQL written by hand. Its
address comes only from the environment (SHAPEROUTE_DATABASE_URL): it holds
a password, so it never goes on the command line. Without it the API runs as
before, with no accounts.

The schema is the numbered SQL files in services/api/migrations, applied in
order when the API starts, each in its own transaction and recorded in
schema_migrations. A file already applied is never run again, so a migration
in main is never edited: the next one is written instead.

The running API lends its requests a few connections kept open (TASK-288 B,
ADR-0249): a new one costs a password handshake, most of a quick request's
time. Each goes back to the pool as a new session's: no transaction, no SET,
no temporary table left for the next request. A block opened inside another
on the same thread gets a connection of its own, as before the pool.
"""

from __future__ import annotations

import logging
import os
import re
import threading
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from pathlib import Path

import psycopg
from psycopg.rows import DictRow, dict_row
from psycopg_pool import ConnectionPool

DATABASE_VARIABLE = "SHAPEROUTE_DATABASE_URL"
MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"
MIGRATION_NAME = re.compile(r"^(\d{4})_[a-z0-9_]+\.sql$")
# Two APIs starting together on one database: one applies, the other waits.
MIGRATION_LOCK = 114_0001
CONNECT_TIMEOUT_S = 5
# The pool of the API (docs/tasks/TASK-288.md, «Parte B», has the numbers):
# one process, at most 40 requests at once in AnyIO's threads, 4 vCPU shared
# with the route engine. Two stay open for the usual few phones; past about
# 2 × 4 + 1 queries at once PostgreSQL only queues them on the CPU; ten are
# about 100 MB of the server's 8 GB and a tenth of PostgreSQL's 100.
POOL_MIN_SIZE = 2
POOL_MAX_SIZE = 10
# A request waits this long for a free connection, then fails: queries take
# milliseconds, so ten busy seconds mean something is stuck.
POOL_WAIT_S = 10.0
# Past the two kept open, an idle connection closes after ten minutes; each
# is replaced after an hour.
POOL_MAX_IDLE_S = 10 * 60.0
POOL_MAX_LIFETIME_S = 60 * 60.0
# The pools this thread holds a connection of (Database.connect). Sending a
# run to Strava keeps the run locked while it reads the token, in a second
# block: from the pool, ten such requests would each wait for a second
# connection that none of them gives back.
_holding = threading.local()

DictConnection = psycopg.Connection[DictRow]


class MigrationError(ValueError):
    """The migrations folder has a file that cannot be applied in order."""


def migrations(directory: Path = MIGRATIONS_DIR) -> list[Path]:
    """The SQL files in the order they are applied, each number once."""
    files = sorted(p for p in directory.iterdir() if p.suffix == ".sql")
    seen: dict[str, Path] = {}
    for path in files:
        match = MIGRATION_NAME.match(path.name)
        if match is None:
            raise MigrationError(
                f"{path.name}: a migration is named NNNN_what.sql, in lower case"
            )
        number = match.group(1)
        if number in seen:
            raise MigrationError(
                f"{path.name} and {seen[number].name} have the same number"
            )
        seen[number] = path
    return files


def new_session(conn: DictConnection) -> None:
    """A connection given back to the pool as a new session: no SET, no
    temporary table, no lock, cursor, prepared statement or LISTEN of the
    request before. The pool lends it with no transaction open (it rolls
    back one left open), and DISCARD ALL runs outside one."""
    conn.autocommit = True
    try:
        conn.execute("DISCARD ALL")
    finally:
        conn.autocommit = False


@dataclass(frozen=True)
class Database:
    """A PostgreSQL address. Without a pool each call opens its own
    connection (the tests, a tool); the API lends them from one (pooled)."""

    url: str
    pool: ConnectionPool[DictConnection] | None = field(
        default=None, compare=False, repr=False
    )

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> Database | None:
        url = environ.get(DATABASE_VARIABLE, "").strip()
        return cls(url) if url else None

    def pooled(
        self,
        min_size: int = POOL_MIN_SIZE,
        max_size: int = POOL_MAX_SIZE,
        wait_s: float = POOL_WAIT_S,
    ) -> Database:
        """The same database with its pool open: min_size connections ready,
        or psycopg_pool.PoolTimeout (an OperationalError) within
        CONNECT_TIMEOUT_S. Closed by close()."""
        # The pool says each connection it lends at INFO: two lines a request.
        logging.getLogger("psycopg.pool").setLevel(logging.WARNING)
        pool = ConnectionPool(
            self.url,
            connection_class=DictConnection,
            # No prepared statements: DISCARD ALL drops them in PostgreSQL,
            # and psycopg would go on using them. A request today runs each
            # query once or twice, below psycopg's threshold of five.
            kwargs={
                "row_factory": dict_row,
                "connect_timeout": CONNECT_TIMEOUT_S,
                "prepare_threshold": None,
            },
            min_size=min_size,
            max_size=max_size,
            timeout=wait_s,
            max_idle=POOL_MAX_IDLE_S,
            max_lifetime=POOL_MAX_LIFETIME_S,
            # A connection is tried before it is lent: one PostgreSQL closed
            # (a restart) is replaced, and the request does not fail.
            check=ConnectionPool.check_connection,
            reset=new_session,
            name="api",
            open=False,
        )
        try:
            pool.open(wait=True, timeout=CONNECT_TIMEOUT_S)
        except BaseException:
            pool.close()
            raise
        return replace(self, pool=pool)

    def close(self) -> None:
        """The pool's connections closed, when there is a pool; then
        connect() raises psycopg_pool.PoolClosed."""
        if self.pool is not None:
            self.pool.close()

    @contextmanager
    def connect(self) -> Iterator[DictConnection]:
        """One transaction: committed if the block ends, rolled back if it
        raises. From the pool, the connection goes back to it either way, as
        a new session; with every one busy for POOL_WAIT_S,
        psycopg_pool.PoolTimeout. Inside another block of this thread, a
        connection of its own."""
        held: set[int] = _holding.__dict__.setdefault("pools", set())
        if self.pool is not None and id(self.pool) not in held:
            held.add(id(self.pool))
            try:
                with self.pool.connection() as conn:
                    yield conn
            finally:
                held.discard(id(self.pool))
            return
        with psycopg.connect(
            self.url, row_factory=dict_row, connect_timeout=CONNECT_TIMEOUT_S
        ) as conn:
            yield conn

    def migrate(self, directory: Path = MIGRATIONS_DIR) -> list[str]:
        """Apply the migrations not applied yet; their names, in order."""
        files = migrations(directory)
        applied: list[str] = []
        with psycopg.connect(
            self.url, autocommit=True, connect_timeout=CONNECT_TIMEOUT_S
        ) as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                " version text PRIMARY KEY,"
                " applied_at timestamptz NOT NULL DEFAULT now())"
            )
            for path in files:
                with conn.transaction():
                    conn.execute("SELECT pg_advisory_xact_lock(%s)", (MIGRATION_LOCK,))
                    done = conn.execute(
                        "SELECT 1 FROM schema_migrations WHERE version = %s",
                        (path.stem,),
                    ).fetchone()
                    if done is not None:
                        continue
                    # No parameters: psycopg sends the file as it is, several
                    # statements included.
                    conn.execute(path.read_text(encoding="utf-8").encode())
                    conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES (%s)",
                        (path.stem,),
                    )
                applied.append(path.stem)
        return applied
