"""The photos and videos of the private messages (TASK-333, ADR-0289,
docs/API.md, «Messages», «Attachments»).

Sent in two steps: the file alone (POST /me/message-media, the bytes as
they are, not base64 in JSON), then the message with its id (messages.py).
An upload never sent goes after UNSENT_FOR. The files are on disk
(media_files.py, under data/media/messages), never in the database nor in
its copies; message_media has a row for each.

What is kept of a file:
- a photo made again as the photos of the drawings (fitted_jpeg: upright,
  at most 1080 px, JPEG, nothing of its EXIF);
- a video as the phone sent it, checked and without its metadata (where it
  was shot among them), at most VIDEO_MAX_S and VIDEO_MAX_BYTES; the phone
  makes it smaller before (ADR-0289, point 7) and sends its first picture
  (PUT …/poster), which the API keeps as a photo.

Each account sends at most VIDEOS_A_DAY videos and PHOTOS_A_DAY photos in a
day, and the server keeps at most SHAPEROUTE_MESSAGE_MEDIA_MAX_GB of them. A
video stops being kept VIDEO_DAYS after its message («This video has
expired»), or earlier when the space for videos is full: the videos of the
oldest messages go first to make room for a new one (`free_videos`, the
user's choice of 2026-10-29, ADR-0289 addition of part D; the videos of the
posts call it too, ADR-0292). A photo goes on until a tenth past the cap.
Only when no video of a message is left to take away is a new one refused
(507).

A file is read by who uploaded it and by the other member of its
message's conversation while that one sees the message (messages.SEEN: not
deleted from its view, not hidden from a report's email) and no block
stands between them. Deleting the message, the conversation or either
account deletes the row; the hourly round (`sweep`) takes from the disk
every file no row keeps.
"""

from __future__ import annotations

import logging
import math
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel
from route_engine.models import InvalidRequestError

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.db import Database
from shaperoute_api.drawing_photos import fitted_jpeg
from shaperoute_api.follows import apart_sql
from shaperoute_api.media_files import (
    MediaError,
    MediaFolder,
    cap_bytes,
    video_facts,
    without_metadata,
)
from shaperoute_api.messages import (
    PHOTO_MAX_BYTES,
    SEEN,
    VIDEO_DAYS,
    VIDEO_MAX_BYTES,
    VIDEO_MAX_S,
    AttachmentKind,
)
from shaperoute_api.schemas import ErrorBody

log = logging.getLogger(__name__)

MediaKind = Literal["photo", "video"]
# The videos of messages sent, still kept, the oldest message first: what
# free_videos takes away. `mm` with its message `m`.
OLDEST_VIDEOS = (
    "FROM message_media mm JOIN messages m ON m.id = mm.message_id"
    " WHERE mm.kind = 'video' AND mm.stored"
)
# What the phone sends, by its Content-Type.
KIND_OF: dict[str, MediaKind] = {
    "image/jpeg": "photo",
    "image/png": "photo",
    "video/mp4": "video",
    "video/quicktime": "video",
}
EXTENSION = {"image/jpeg": "jpg", "video/mp4": "mp4", "video/quicktime": "mov"}

FOLDER = "messages"
CAP_VARIABLE = "SHAPEROUTE_MESSAGE_MEDIA_MAX_GB"
DEFAULT_CAP_GB = 10
# Photos are small: they go on a tenth past the cap of the videos.
PHOTO_ROOM = 1.1
VIDEOS_A_DAY = 10
PHOTOS_A_DAY = 100
DAY = timedelta(days=1)
UNSENT_FOR = timedelta(hours=1)
SWEEP_EVERY_S = 3600
# The address of a file never changes: a day in the phone's own cache.
CACHE_CONTROL = "private, max-age=86400"

NOT_MEDIA = "Send a JPEG or PNG photo, or an MP4 or QuickTime video."
PHOTO_TOO_LARGE = f"A photo is at most {PHOTO_MAX_BYTES // 1_000_000} MB."
VIDEO_TOO_LARGE = f"A video is at most {VIDEO_MAX_BYTES // 1_000_000} MB."
VIDEO_TOO_LONG = f"A video is at most {VIDEO_MAX_S} seconds."
TOO_MANY_VIDEOS = "Too many videos today: try again tomorrow."
TOO_MANY_PHOTOS = "Too many photos today: try again tomorrow."
FULL = "Videos can't be sent right now: try again later."
NO_MEDIA = "No photo or video with this id."
NO_POSTER = "This video has no first picture."
EXPIRED = "This video has expired."
NOT_A_VIDEO = "Only a video has a first picture."


class MessageMediaBody(BaseModel):
    """POST /me/message-media: the file kept, to send with a message:
    packages/shared-types/fixtures/message-media.json."""

    id: UUID
    kind: MediaKind
    width: int | None
    height: int | None
    duration_ms: int | None
    bytes: int


@dataclass(frozen=True)
class Stored:
    """A file to answer with."""

    path: Path
    media_type: str


@dataclass
class MessageMedia:
    """The files under `folder`, their rows in the database of the
    accounts."""

    database: Database
    folder: MediaFolder
    cap: int
    now: Callable[[], datetime]
    clock_s: Callable[[], float] = field(default=time.time)

    def used(self) -> int:
        """Bytes kept, photos, videos and their first pictures."""
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT coalesce(sum(bytes + coalesce(poster_bytes, 0)), 0) AS n"
                " FROM message_media WHERE stored"
            ).fetchone()
        assert row is not None
        return int(row["n"])

    def freeable(self) -> int:
        """Bytes of the videos of messages sent that `free_videos` could take
        away."""
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT coalesce(sum(mm.bytes + coalesce(mm.poster_bytes, 0)), 0) AS n"
                f" {OLDEST_VIDEOS}"
            ).fetchone()
        assert row is not None
        return int(row["n"])

    def kinds(self) -> list[AttachmentKind]:
        """What may be uploaded now: a video while the server has room for
        it, once the videos of older messages are taken away if need be."""
        kept = self.used() - self.freeable()
        if kept >= self.cap * PHOTO_ROOM:
            return []
        return ["photo"] if kept >= self.cap else ["photo", "video"]

    def free_videos(self, needed_bytes: int) -> int:
        """Makes room for `needed_bytes`: the videos of the oldest messages
        stop being kept until that much is free, and are «expired» from then
        on. Never a photo, an upload not sent yet, nor a video of a post
        (another table, ADR-0292). The database says so first, in one
        statement; then the files leave the disk. A process stopped between
        the two leaves files no row keeps, which the hourly round takes; a
        row is never left keeping a file that is gone. The bytes freed: less
        than asked when there were no more."""
        if needed_bytes <= 0:
            return 0
        with self.database.connect() as conn:
            rows = conn.execute(
                "UPDATE message_media SET stored = false WHERE stored AND id IN ("
                " SELECT id FROM (SELECT mm.id, sum(mm.bytes"
                " + coalesce(mm.poster_bytes, 0)) OVER (ORDER BY m.created_at, mm.id)"
                " - (mm.bytes + coalesce(mm.poster_bytes, 0)) AS before"
                f" {OLDEST_VIDEOS}) oldest WHERE before < %s)"
                " RETURNING id, media_type, bytes + coalesce(poster_bytes, 0) AS size",
                (needed_bytes,),
            ).fetchall()
        freed = 0
        for row in rows:
            freed += int(row["size"])
            for name in (
                f"{row['id']}.{EXTENSION[row['media_type']]}",
                f"{row['id']}.poster.jpg",
            ):
                try:
                    self.folder.remove(name)
                except OSError:
                    # No row keeps it: the hourly round takes it.
                    log.exception("message media: %s not removed", name)
        if rows:
            log.info(
                "message media: %d video(s) of old messages taken away, %d bytes",
                len(rows),
                freed,
            )
        return freed

    def upload(self, user_id: int, media_type: str, data: bytes) -> MessageMediaBody:
        """The file kept for `user_id`, not yet in a message."""
        kind = KIND_OF.get(media_type)
        if kind is None:
            raise AccountError(422, "invalid_request", NOT_MEDIA)
        now = self.now()
        self._within_the_day(user_id, kind, now)
        if kind == "photo":
            try:
                photo = fitted_jpeg(data)
            except InvalidRequestError as exc:
                raise AccountError(422, "invalid_request", str(exc)) from None
            kept, media_type = photo.jpeg, "image/jpeg"
            width, height, duration_ms = photo.width, photo.height, None
        else:
            try:
                facts = video_facts(data)
                kept = without_metadata(data)
            except MediaError as exc:
                raise AccountError(422, "invalid_request", str(exc)) from None
            if facts.duration_ms > VIDEO_MAX_S * 1000:
                raise AccountError(422, "invalid_request", VIDEO_TOO_LONG)
            media_type = facts.media_type
            width, height, duration_ms = facts.width, facts.height, facts.duration_ms
        room = round(self.cap * (PHOTO_ROOM if kind == "photo" else 1))
        over = self.used() + len(kept) - room
        if over > 0 and self.free_videos(over) < over:
            log.warning("message media: the cap of %d bytes is reached", self.cap)
            raise HTTPException(507, FULL)
        media_id = uuid.uuid4()
        name = f"{media_id}.{EXTENSION[media_type]}"
        self.folder.write(name, kept)
        try:
            with self.database.connect() as conn:
                conn.execute(
                    "INSERT INTO message_media (id, owner_id, kind, media_type,"
                    " bytes, width, height, duration_ms, created_at)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (
                        media_id,
                        user_id,
                        kind,
                        media_type,
                        len(kept),
                        width,
                        height,
                        duration_ms,
                        now,
                    ),
                )
        except Exception:
            self.folder.remove(name)
            raise
        return MessageMediaBody(
            id=media_id,
            kind=kind,
            width=width,
            height=height,
            duration_ms=duration_ms,
            bytes=len(kept),
        )

    def _within_the_day(self, user_id: int, kind: MediaKind, now: datetime) -> None:
        """429 past the day's videos or photos of `user_id`, with the time
        until the oldest of them is a day old."""
        most = VIDEOS_A_DAY if kind == "video" else PHOTOS_A_DAY
        with self.database.connect() as conn:
            rows = conn.execute(
                "SELECT created_at FROM message_media WHERE owner_id = %s"
                " AND kind = %s AND created_at > %s ORDER BY created_at",
                (user_id, kind, now - DAY),
            ).fetchall()
        if len(rows) >= most:
            wait = rows[len(rows) - most]["created_at"] + DAY - now
            message = TOO_MANY_VIDEOS if kind == "video" else TOO_MANY_PHOTOS
            raise AccountError(
                429,
                "too_many_requests",
                message,
                max(1, math.ceil(wait.total_seconds())),
            )

    def put_poster(self, user_id: int, media_id: str, data: bytes) -> None:
        """The first picture of `user_id`'s video; 404 for anything else."""
        wanted = _uuid(media_id)
        with self.database.connect() as conn:
            row = (
                None
                if wanted is None
                else conn.execute(
                    "SELECT kind FROM message_media WHERE id = %s AND owner_id = %s"
                    " AND stored",
                    (wanted, user_id),
                ).fetchone()
            )
        if row is None:
            raise HTTPException(404, NO_MEDIA)
        if row["kind"] != "video":
            raise AccountError(422, "invalid_request", NOT_A_VIDEO)
        try:
            poster = fitted_jpeg(data)
        except InvalidRequestError as exc:
            raise AccountError(422, "invalid_request", str(exc)) from None
        self.folder.write(f"{wanted}.poster.jpg", poster.jpeg)
        with self.database.connect() as conn:
            conn.execute(
                "UPDATE message_media SET poster_bytes = %s WHERE id = %s",
                (len(poster.jpeg), wanted),
            )

    def stored(self, viewer_id: int, media_id: str, poster: bool = False) -> Stored:
        """The file, or its first picture, for one who may see it: 404 for
        anyone else, as for an id that is not there; 410 for a video
        expired."""
        wanted = _uuid(media_id)
        if wanted is None:
            raise HTTPException(404, NO_MEDIA)
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT mm.kind, mm.media_type, mm.stored, mm.poster_bytes,"
                " mm.owner_id, m.created_at AS sent_at,"
                " (mm.owner_id = %s OR EXISTS (SELECT 1 FROM conversation_members cm"
                " WHERE cm.conversation_id = m.conversation_id AND cm.user_id = %s"
                f" AND {SEEN} AND NOT {apart_sql('cm.user_id', 'cm.other_id')}))"
                " AS seen"
                " FROM message_media mm LEFT JOIN messages m ON m.id = mm.message_id"
                " WHERE mm.id = %s",
                (viewer_id, viewer_id, wanted),
            ).fetchone()
        if row is None or not row["seen"]:
            raise HTTPException(404, NO_MEDIA)
        sent_at: datetime | None = row["sent_at"]
        if not row["stored"] or (
            row["kind"] == "video"
            and sent_at is not None
            and sent_at <= self.now() - timedelta(days=VIDEO_DAYS)
        ):
            raise HTTPException(410, EXPIRED)
        if poster:
            if row["poster_bytes"] is None:
                raise HTTPException(404, NO_POSTER)
            path, media_type = self.folder.path(f"{wanted}.poster.jpg"), "image/jpeg"
        else:
            media_type = row["media_type"]
            path = self.folder.path(f"{wanted}.{EXTENSION[media_type]}")
        if not path.is_file():
            # Lost with a disk: the message stays, its file does not.
            raise HTTPException(404, NO_MEDIA)
        return Stored(path, media_type)

    def of_message(self, message_id: UUID, poster: bool = False) -> Stored | None:
        """The file of a message, or its first picture, for the page of a
        report's link (report_email.py), which has no member: None without
        one, or when it is gone."""
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT id, media_type, poster_bytes FROM message_media"
                " WHERE message_id = %s AND stored",
                (message_id,),
            ).fetchone()
        if row is None or (poster and row["poster_bytes"] is None):
            return None
        name = (
            f"{row['id']}.poster.jpg"
            if poster
            else f"{row['id']}.{EXTENSION[row['media_type']]}"
        )
        path = self.folder.path(name)
        if not path.is_file():
            return None
        return Stored(path, "image/jpeg" if poster else row["media_type"])

    def sweep(self) -> int:
        """The hourly round: uploads never sent and videos expired let go,
        then every file no row keeps taken from the disk; how many went."""
        now = self.now()
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM message_media WHERE message_id IS NULL"
                " AND created_at < %s",
                (now - UNSENT_FOR,),
            )
            conn.execute(
                "UPDATE message_media mm SET stored = false FROM messages m"
                " WHERE m.id = mm.message_id AND mm.kind = 'video' AND mm.stored"
                " AND m.created_at <= %s",
                (now - timedelta(days=VIDEO_DAYS),),
            )
            rows = conn.execute("SELECT id FROM message_media WHERE stored").fetchall()
        return self.folder.keep_only({str(row["id"]) for row in rows}, self.clock_s)


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


class SweepRound:
    """`sweep` every SWEEP_EVERY_S, in a thread of its own, for as long as
    the API runs."""

    def __init__(self, media: MessageMedia, every_s: float = SWEEP_EVERY_S) -> None:
        self.media = media
        self.every_s = every_s

    def start(self) -> None:
        threading.Thread(target=self._run, name="message-media", daemon=True).start()

    def _run(self) -> None:
        while True:
            time.sleep(self.every_s)
            try:
                removed = self.media.sweep()
                if removed:
                    log.info("message media: %d file(s) removed", removed)
            except Exception:
                log.exception("message media: the round failed")


# --- The endpoints ---


async def _body(request: Request, most: int, too_large: str) -> bytes:
    """The bytes sent, never more than `most`: 422 past them."""
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > most:
        raise AccountError(422, "invalid_request", too_large)
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > most:
            raise AccountError(422, "invalid_request", too_large)
        chunks.append(chunk)
    return b"".join(chunks)


def _media_type(request: Request) -> str:
    return request.headers.get("content-type", "").split(";")[0].strip().lower()


def media_of(
    request: Request, accounts: Annotated[Accounts, Depends(accounts_of)]
) -> MessageMedia:
    """The photos and videos; 404 on a server without their folder, as for
    an API before them."""
    media: MessageMedia | None = getattr(request.app.state, "message_media", None)
    if media is None:
        raise HTTPException(404, "Not Found")
    return media


Media = Annotated[MessageMedia, Depends(media_of)]
Me = Annotated[UserBody, Depends(current_user)]
ERRORS: dict[int | str, dict[str, object]] = {
    404: {"model": ErrorBody},
    410: {"model": ErrorBody},
}


def message_media_routes() -> APIRouter:
    router = APIRouter(tags=["messages"], responses=ACCOUNT_ERRORS)

    @router.post(
        "/me/message-media",
        status_code=201,
        responses={429: {"model": ErrorBody}, 507: {"model": ErrorBody}},
    )
    async def upload(request: Request, media: Media, user: Me) -> MessageMediaBody:
        media_type = _media_type(request)
        kind = KIND_OF.get(media_type)
        if kind is None:
            raise AccountError(422, "invalid_request", NOT_MEDIA)
        data = (
            await _body(request, PHOTO_MAX_BYTES, PHOTO_TOO_LARGE)
            if kind == "photo"
            else await _body(request, VIDEO_MAX_BYTES, VIDEO_TOO_LARGE)
        )
        # Making a photo smaller takes a moment: not in the event loop.
        return await run_in_threadpool(media.upload, user.id, media_type, data)

    @router.put(
        "/me/message-media/{media_id}/poster", status_code=204, responses=ERRORS
    )
    async def put_poster(
        media_id: str, request: Request, media: Media, user: Me
    ) -> Response:
        if KIND_OF.get(_media_type(request)) != "photo":
            raise AccountError(422, "invalid_request", NOT_MEDIA)
        data = await _body(request, PHOTO_MAX_BYTES, PHOTO_TOO_LARGE)
        await run_in_threadpool(media.put_poster, user.id, media_id, data)
        return Response(status_code=204)

    @router.get(
        "/message-media/{media_id}",
        response_class=FileResponse,
        responses={200: {"content": {"image/jpeg": {}, "video/mp4": {}}}, **ERRORS},
    )
    def get_media(media_id: str, media: Media, user: Me) -> FileResponse:
        # A FileResponse answers a Range too: a player may ask for parts.
        found = media.stored(user.id, media_id)
        return FileResponse(found.path, media_type=found.media_type, headers=_headers())

    @router.get(
        "/message-media/{media_id}/poster",
        response_class=FileResponse,
        responses={200: {"content": {"image/jpeg": {}}}, **ERRORS},
    )
    def get_poster(media_id: str, media: Media, user: Me) -> FileResponse:
        found = media.stored(user.id, media_id, poster=True)
        return FileResponse(found.path, media_type=found.media_type, headers=_headers())

    return router


def _headers() -> dict[str, str]:
    return {"Cache-Control": CACHE_CONTROL}


def install_message_media(app: FastAPI, media: MessageMedia | None) -> None:
    """The photos and videos of the messages; after install_messages. With
    no folder (None) the endpoints answer 404 and a conversation offers
    drawings only."""
    app.state.message_media = media
    app.include_router(message_media_routes())


def message_media_from(
    database: Database, root: Path, now: Callable[[], datetime]
) -> MessageMedia:
    """The files under `root`/messages, with the cap of the environment."""
    return MessageMedia(
        database,
        MediaFolder(root / FOLDER),
        cap_bytes(CAP_VARIABLE, DEFAULT_CAP_GB),
        now,
    )
