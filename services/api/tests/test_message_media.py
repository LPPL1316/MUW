"""The attachments of the private messages in a real PostgreSQL (TASK-333,
ADR-0289): a photo, a video or a drawing in an `open` conversation, none
in a request; the files on disk, read only by the two of the conversation;
a photo made again without its EXIF, a video without its place; the limits
of a day, the server's cap, a video expired after 30 days; the hourly round
that takes away the files no row keeps, after a block, a message deleted,
an account deleted; a report that shows the attachment on its link's
page; an app of before that reads «[Photo]»; the push with what it
carries. The bodies are the examples of packages/shared-types/fixtures."""

from __future__ import annotations

import io
from collections.abc import Iterator
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from route_engine.network import FileSource
from test_media_files import PLACE, box, video
from test_messages import (
    FAST_HASHER,
    Headers,
    WallClock,
    _load,
    page,
    pid,
    report,
    rows,
    send,
    sent,
    signed_up,
)
from test_push import FakeExpo, push_on, put_token
from test_report_email import FakeResend, setup_with, token_of

import shaperoute_api.message_media as message_media
from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.media_files import STRAY_AFTER_S, MediaFolder
from shaperoute_api.message_media import (
    EXPIRED,
    FULL,
    NOT_MEDIA,
    TOO_MANY_VIDEOS,
    VIDEO_TOO_LONG,
    MessageMedia,
    MessageMediaBody,
    install_message_media,
)
from shaperoute_api.messages import (
    ATTACHMENT_IN_REQUEST,
    NO_UPLOAD,
    MessageRequestBody,
    MessagesBody,
)
from shaperoute_api.push import Pusher
from shaperoute_api.report_email import LINK_PATH, ReportEmails, install_report_email

BOB_PHONE = "ExponentPushToken[phone-of-bob]"
WITH = {"with": "attachments"}


class DiskClock:
    """The seconds the round compares the files' times with: years after
    the test writes them, so none is too new for it to take."""

    def __init__(self) -> None:
        self.s = 4_000_000_000.0

    def __call__(self) -> float:
        return self.s


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def disk() -> DiskClock:
    return DiskClock()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def folder(tmp_path: Path) -> MediaFolder:
    return MediaFolder(tmp_path / "media" / "messages")


@pytest.fixture
def media(
    database: Database, folder: MediaFolder, wall: WallClock, disk: DiskClock
) -> MessageMedia:
    return MessageMedia(database, folder, 10**9, wall, clock_s=disk)


@pytest.fixture
def resend() -> FakeResend:
    return FakeResend()


@pytest.fixture
def client(
    database: Database,
    wall: WallClock,
    expo: FakeExpo,
    media: MessageMedia,
    resend: FakeResend,
) -> Iterator[TestClient]:
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
        run_places=PlaceNames(None),
    )
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    install_report_email(
        app,
        ReportEmails(database, setup_with(resend), now=wall, run=lambda job: job()),
    )
    install_message_media(app, media)
    yield TestClient(app)


def photo_bytes(fmt: str = "JPEG", side: int = 1600) -> bytes:
    """A photo with the phone that took it in its EXIF, as a phone keeps
    it; a PNG without."""
    picture = Image.new("RGB", (side, side * 3 // 4), (200, 120, 40))
    out = io.BytesIO()
    if fmt == "JPEG":
        exif = Image.Exif()
        exif[0x010F] = "PhoneMaker"  # Make
        picture.save(out, fmt, exif=exif.tobytes())
    else:
        picture.save(out, fmt)
    return out.getvalue()


def upload(
    client: TestClient, who: Headers, data: bytes, media_type: str = "image/jpeg"
) -> Any:
    return client.post(
        "/me/message-media",
        content=data,
        headers={**who, "Content-Type": media_type},
    )


def uploaded(client: TestClient, who: Headers, data: bytes, media_type: str) -> str:
    answer = upload(client, who, data, media_type)
    assert answer.status_code == 201, answer.text
    return str(answer.json()["id"])


def attach(
    client: TestClient, who: Headers, to: Headers, attachment: Any, text: str = ""
) -> Any:
    answer = client.post(
        f"/conversations/{pid(client, to)}/messages",
        params=WITH,
        json={"text": text, "attachment": attachment},
        headers=who,
    )
    client.app.state.accounts.now.later()  # type: ignore[attr-defined]
    return answer


def talking(client: TestClient) -> tuple[Headers, Headers]:
    """Ada and Bob in a conversation open to both: Ada wrote, Bob accepted."""
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    sent(client, ada, bob, "Hi Bob!")
    assert client.put(
        f"/conversations/{pid(client, ada)}/accept", headers=bob
    ).is_success
    return ada, bob


def files(folder: MediaFolder) -> list[str]:
    return sorted(name for name, _ in folder.names())


def later(disk: DiskClock, wall: WallClock, **delta: float) -> None:
    """Time passes for the database and for the files."""
    step = timedelta(**delta)
    wall.t += step
    disk.s += step.total_seconds()


DRAWING = _load("favorite-request.json")


# --- The contract ---


def test_the_examples_are_the_bodies() -> None:
    body = _load("message-media.json")
    assert set(body) == set(MessageMediaBody.model_fields)
    MessageMediaBody.model_validate(body)
    MessagesBody.model_validate(_load("message-attachments.json"))
    MessageRequestBody.model_validate(_load("message-attachment-request.json"))


# --- A photo ---


def test_a_photo_goes_to_the_other_without_its_exif(
    client: TestClient, folder: MediaFolder
) -> None:
    ada, bob = talking(client)
    cy = signed_up(client, "cleo")
    asked = upload(client, ada, photo_bytes(), "image/jpeg")
    assert asked.status_code == 201, asked.text
    body = asked.json()
    assert (body["kind"], body["width"], body["height"]) == ("photo", 1080, 810)
    # Before it is sent only Ada reads it.
    assert client.get(f"/message-media/{body['id']}", headers=ada).status_code == 200
    assert client.get(f"/message-media/{body['id']}", headers=bob).status_code == 404
    message = attach(client, ada, bob, {"media_id": body["id"]}, "The river")
    assert message.status_code == 201, message.text
    attachment = message.json()["attachment"]
    assert attachment["kind"] == "photo" and attachment["media_id"] == body["id"]
    got = client.get(f"/message-media/{body['id']}", headers=bob)
    assert got.status_code == 200
    assert got.headers["content-type"] == "image/jpeg"
    kept = Image.open(io.BytesIO(got.content))
    assert kept.size == (1080, 810)
    assert not kept.getexif()
    assert b"PhoneMaker" not in got.content
    # A third member, as for an id that is not there.
    assert client.get(f"/message-media/{body['id']}", headers=cy).status_code == 404
    assert client.get(f"/message-media/{uuid4()}", headers=bob).status_code == 404
    assert len(files(folder)) == 1
    # A PNG is made a JPEG too.
    png = upload(client, ada, photo_bytes("PNG", 400), "image/png")
    assert png.status_code == 201 and png.json()["width"] == 400


def test_a_page_shows_the_photo_and_says_what_may_be_attached(
    client: TestClient,
) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": media_id})
    seen = page(client, bob, ada, **WITH)
    assert seen["attachments"]["kinds"] == ["photo", "video", "drawing"]
    assert seen["attachments"]["video_max_s"] == 60
    assert seen["attachments"]["video_max_bytes"] == 40_000_000
    last = seen["messages"][0]
    assert (last["text"], last["attachment"]["media_id"]) == ("", media_id)
    listed = client.get("/me/conversations", params=WITH, headers=bob).json()
    assert listed["conversations"][0]["last"]["attachment"]["kind"] == "photo"


def test_an_app_of_before_reads_what_the_message_carries(client: TestClient) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": media_id}, "The river")
    attach(client, ada, bob, {"drawing": DRAWING})
    texts = [m["text"] for m in page(client, bob, ada)["messages"]]
    assert texts[:2] == ["[Drawing]", "[Photo] The river"]
    listed = client.get("/me/conversations", headers=bob).json()
    assert listed["conversations"][0]["last"]["text"] == "[Drawing]"


# --- Who may attach, what ---


def test_a_request_is_text_only(client: TestClient, database: Database) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    media_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    refused = attach(client, ada, bob, {"media_id": media_id}, "Look")
    assert refused.status_code == 409
    assert refused.json()["error"]["message"] == ATTACHMENT_IN_REQUEST
    assert attach(client, ada, bob, {"drawing": DRAWING}).status_code == 409
    assert page(client, ada, bob, **WITH)["attachments"] is None
    # The request itself is text, as before; still nothing attached.
    assert send(client, ada, bob, "Hi Bob!").status_code == 201
    assert rows(database, "SELECT attachment FROM messages") == [{"attachment": None}]
    # Bob sees the request with nothing to attach until he accepts.
    assert page(client, bob, ada, **WITH)["attachments"] is None


def test_an_upload_is_sent_once_and_by_who_made_it(client: TestClient) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    stolen = attach(client, bob, ada, {"media_id": media_id})
    assert stolen.status_code == 404
    assert stolen.json()["error"]["message"] == NO_UPLOAD
    assert attach(client, ada, bob, {"media_id": media_id}).status_code == 201
    assert attach(client, ada, bob, {"media_id": media_id}).status_code == 404


def test_an_attachment_is_one_thing(client: TestClient) -> None:
    ada, bob = talking(client)
    both = {"media_id": str(uuid4()), "drawing": DRAWING}
    assert attach(client, ada, bob, both).status_code == 422
    assert attach(client, ada, bob, {}).status_code == 422
    # Without an attachment, a message still needs words.
    assert send(client, ada, bob, "  ").status_code == 422


def test_what_is_not_a_photo_or_a_video_is_refused(client: TestClient) -> None:
    ada, _ = talking(client)
    refused = upload(client, ada, b"GIF89a", "image/gif")
    assert refused.status_code == 422
    assert refused.json()["error"]["message"] == NOT_MEDIA
    assert upload(client, ada, b"not a jpeg", "image/jpeg").status_code == 422
    assert upload(client, ada, b"not a video", "video/mp4").status_code == 422
    # The key and a token, as everywhere.
    assert upload(client, {}, photo_bytes(), "image/jpeg").status_code == 401


# --- A video ---


def test_a_video_goes_without_its_place(
    client: TestClient, folder: MediaFolder
) -> None:
    ada, bob = talking(client)
    answer = upload(client, ada, video(seconds=24.5), "video/mp4")
    assert answer.status_code == 201, answer.text
    body = answer.json()
    assert (body["kind"], body["duration_ms"]) == ("video", 24500)
    assert (body["width"], body["height"]) == (960, 540)
    poster = client.put(
        f"/me/message-media/{body['id']}/poster",
        content=photo_bytes(side=500),
        headers={**ada, "Content-Type": "image/jpeg"},
    )
    assert poster.status_code == 204, poster.text
    attach(client, ada, bob, {"media_id": body["id"]})
    shown = page(client, bob, ada, **WITH)["messages"][0]["attachment"]
    assert (shown["poster"], shown["expired"], shown["duration_ms"]) == (
        True,
        False,
        24500,
    )
    got = client.get(f"/message-media/{body['id']}", headers=bob)
    assert got.status_code == 200
    assert got.headers["content-type"] == "video/mp4"
    assert PLACE not in got.content
    assert len(got.content) == len(video(seconds=24.5))
    # A player asks for parts.
    part = client.get(
        f"/message-media/{body['id']}", headers={**bob, "Range": "bytes=0-99"}
    )
    assert part.status_code == 206 and len(part.content) == 100
    first = client.get(f"/message-media/{body['id']}/poster", headers=bob)
    assert first.status_code == 200 and first.headers["content-type"] == "image/jpeg"
    assert files(folder) == sorted([f"{body['id']}.mp4", f"{body['id']}.poster.jpg"])


def test_a_mov_stays_quicktime(client: TestClient) -> None:
    ada, _ = talking(client)
    media_id = uploaded(client, ada, video(brand=b"qt  "), "video/quicktime")
    got = client.get(f"/message-media/{media_id}", headers=ada)
    assert got.headers["content-type"] == "video/quicktime"


def test_a_video_too_long_or_too_large_is_refused(
    client: TestClient, folder: MediaFolder, monkeypatch: pytest.MonkeyPatch
) -> None:
    ada, _ = talking(client)
    too_long = upload(client, ada, video(seconds=61), "video/mp4")
    assert too_long.status_code == 422
    assert too_long.json()["error"]["message"] == VIDEO_TOO_LONG
    assert upload(client, ada, video(seconds=60), "video/mp4").status_code == 201
    monkeypatch.setattr(message_media, "VIDEO_MAX_BYTES", 500)
    assert upload(client, ada, video(), "video/mp4").status_code == 422
    assert len(files(folder)) == 1


def test_only_a_video_of_ones_own_has_a_first_picture(client: TestClient) -> None:
    ada, bob = talking(client)
    photo_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    video_id = uploaded(client, ada, video(), "video/mp4")
    jpeg = {"Content-Type": "image/jpeg"}
    poster = photo_bytes(side=400)
    on_photo = client.put(
        f"/me/message-media/{photo_id}/poster", content=poster, headers={**ada, **jpeg}
    )
    assert on_photo.status_code == 422
    others = client.put(
        f"/me/message-media/{video_id}/poster", content=poster, headers={**bob, **jpeg}
    )
    assert others.status_code == 404
    assert (
        client.get(f"/message-media/{video_id}/poster", headers=ada).status_code == 404
    )


# --- The limits ---


def test_a_day_has_its_videos(
    client: TestClient, wall: WallClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(message_media, "VIDEOS_A_DAY", 2)
    ada, _ = talking(client)
    for _ in range(2):
        assert upload(client, ada, video(), "video/mp4").status_code == 201
        wall.later(60)
    refused = upload(client, ada, video(), "video/mp4")
    assert refused.status_code == 429
    assert refused.json()["error"]["message"] == TOO_MANY_VIDEOS
    assert int(refused.headers["Retry-After"]) == 24 * 3600 - 120
    # Photos have their own count.
    assert upload(client, ada, photo_bytes(), "image/jpeg").status_code == 201
    wall.later(24 * 3600)
    assert upload(client, ada, video(), "video/mp4").status_code == 201


def test_a_full_server_takes_no_more_videos(
    client: TestClient, media: MessageMedia
) -> None:
    ada, bob = talking(client)
    # Larger than a photo: a tenth of it holds one.
    large = video() + box(b"free", bytes(400_000))
    first = upload(client, ada, large, "video/mp4").json()
    media.cap = first["bytes"]
    assert page(client, ada, bob, **WITH)["attachments"]["kinds"] == [
        "photo",
        "drawing",
    ]
    full = upload(client, ada, video(), "video/mp4")
    assert full.status_code == 507
    assert full.json()["error"]["message"] == FULL
    # A photo still goes, within a tenth more.
    assert upload(client, ada, photo_bytes(), "image/jpeg").status_code == 201


def test_without_a_folder_only_drawings_are_attached(
    client: TestClient,
) -> None:
    client.app.state.message_media = None  # type: ignore[attr-defined]
    ada, bob = talking(client)
    assert page(client, ada, bob, **WITH)["attachments"]["kinds"] == ["drawing"]
    assert upload(client, ada, photo_bytes(), "image/jpeg").status_code == 404
    assert attach(client, ada, bob, {"drawing": DRAWING}).status_code == 201


# --- Gone ---


def test_a_video_expires_after_30_days(
    client: TestClient,
    folder: MediaFolder,
    media: MessageMedia,
    wall: WallClock,
    disk: DiskClock,
) -> None:
    ada, bob = talking(client)
    video_id = uploaded(client, ada, video(), "video/mp4")
    photo_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": video_id}, "Sunrise")
    attach(client, ada, bob, {"media_id": photo_id})
    later(disk, wall, days=30)
    gone = client.get(f"/message-media/{video_id}", headers=bob)
    assert gone.status_code == 410
    assert gone.json()["error"]["message"] == EXPIRED
    shown = page(client, bob, ada, **WITH)["messages"][1]["attachment"]
    assert (shown["kind"], shown["expired"], shown["media_id"]) == (
        "video",
        True,
        None,
    )
    assert shown["duration_ms"] == 24000
    assert media.sweep() == 1
    assert files(folder) == [f"{photo_id}.jpg"]
    assert client.get(f"/message-media/{photo_id}", headers=bob).status_code == 200


def test_the_round_takes_what_no_row_keeps(
    client: TestClient,
    database: Database,
    folder: MediaFolder,
    media: MessageMedia,
    wall: WallClock,
    disk: DiskClock,
) -> None:
    ada, bob = talking(client)
    unsent = uploaded(client, ada, photo_bytes(), "image/jpeg")
    kept = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": kept})
    folder.write("stray.mp4", b"left by a crash")
    # Within the hour an upload waits to be sent.
    later(disk, wall, minutes=30)
    assert media.sweep() == 1
    assert len(files(folder)) == 2
    later(disk, wall, minutes=31)
    assert media.sweep() == 1
    assert files(folder) == [f"{kept}.jpg"]
    assert rows(database, "SELECT id FROM message_media") == [{"id": UUID(kept)}]
    assert attach(client, ada, bob, {"media_id": unsent}).status_code == 404


def test_a_deleted_message_takes_its_file(
    client: TestClient, folder: MediaFolder, media: MessageMedia, disk: DiskClock
) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    message = attach(client, ada, bob, {"media_id": media_id}).json()
    assert client.delete(f"/messages/{message['id']}", headers=ada).status_code == 204
    # Nobody reads it from now on; the round takes the file.
    assert client.get(f"/message-media/{media_id}", headers=bob).status_code == 404
    assert client.get(f"/message-media/{media_id}", headers=ada).status_code == 404
    disk.s += STRAY_AFTER_S
    assert media.sweep() == 1
    assert files(folder) == []


def test_a_block_takes_the_files_of_the_conversation(
    client: TestClient, folder: MediaFolder, media: MessageMedia, disk: DiskClock
) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, video(), "video/mp4")
    attach(client, ada, bob, {"media_id": media_id})
    blocked = client.put(f"/users/{pid(client, ada)}/block", headers=bob)
    assert blocked.is_success, blocked.text
    assert client.get(f"/message-media/{media_id}", headers=bob).status_code == 404
    assert client.get(f"/message-media/{media_id}", headers=ada).status_code == 404
    disk.s += STRAY_AFTER_S
    assert media.sweep() == 1
    assert files(folder) == []


def test_a_deleted_account_takes_its_files(
    client: TestClient,
    database: Database,
    folder: MediaFolder,
    media: MessageMedia,
    disk: DiskClock,
) -> None:
    ada, bob = talking(client)
    attach(client, ada, bob, {"media_id": uploaded(client, ada, video(), "video/mp4")})
    attach(
        client,
        bob,
        ada,
        {"media_id": uploaded(client, bob, photo_bytes(), "image/jpeg")},
    )
    assert client.delete("/me", headers=ada).status_code == 204
    assert rows(database, "SELECT id FROM message_media") == []
    disk.s += STRAY_AFTER_S
    assert media.sweep() == 2
    assert files(folder) == []


# --- Reported ---


def test_a_reported_photo_is_shown_on_the_page_of_the_link(
    client: TestClient, database: Database, resend: FakeResend
) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    message = attach(client, ada, bob, {"media_id": media_id}).json()
    assert report(client, bob, message["id"]).status_code == 204
    email = resend.emails()[-1]
    assert "With a photo" in email["text"]
    token = token_of(email["html"])
    asked = client.get(LINK_PATH, params={"t": token})
    assert asked.status_code == 200
    assert f"{LINK_PATH}?t={token}&amp;part=media" in asked.text
    shown = client.get(LINK_PATH, params={"t": token, "part": "media"})
    assert shown.status_code == 200 and shown.headers["content-type"] == "image/jpeg"
    # «Hide»: Bob no longer reads it, Ada still does.
    assert client.post(LINK_PATH, params={"t": token}).status_code == 200
    assert client.get(f"/message-media/{media_id}", headers=bob).status_code == 404
    assert client.get(f"/message-media/{media_id}", headers=ada).status_code == 200
    # A wrong token shows nothing.
    assert client.get(LINK_PATH, params={"t": "x", "part": "media"}).status_code == 404


def test_a_reported_drawing_is_drawn_on_the_page(
    client: TestClient, resend: FakeResend
) -> None:
    ada, bob = talking(client)
    message = attach(client, ada, bob, {"drawing": DRAWING}).json()
    assert report(client, bob, message["id"]).status_code == 204
    email = resend.emails()[-1]
    assert "With a drawing: star, 5.0 km" in email["text"]
    asked = client.get(LINK_PATH, params={"t": token_of(email["html"])})
    assert "<polyline" in asked.text
    # A drawing has no file.
    assert (
        client.get(
            LINK_PATH, params={"t": token_of(email["html"]), "part": "media"}
        ).status_code
        == 404
    )


# --- A drawing ---


def test_a_drawing_goes_whole_and_is_shown_light(client: TestClient) -> None:
    ada, bob = talking(client)
    cy = signed_up(client, "cleo")
    many = {**DRAWING, "points": [[46.0 + i / 10_000, 11.1] for i in range(500)]}
    message = attach(client, ada, bob, {"drawing": many}, "Let's run this")
    assert message.status_code == 201, message.text
    card = page(client, bob, ada, **WITH)["messages"][0]["attachment"]["drawing"]
    assert (card["shape"], card["distance_m"], card["activity"]) == (
        "star",
        5000,
        "running",
    )
    assert len(card["preview"]) == 64
    whole = client.get(f"/messages/{message.json()['id']}/drawing", headers=bob)
    assert whole.status_code == 200
    assert len(whole.json()["points"]) == 500
    assert whole.json()["similarity"] == DRAWING["similarity"]
    assert (
        client.get(f"/messages/{message.json()['id']}/drawing", headers=cy).status_code
        == 404
    )
    text_only = sent(client, ada, bob, "And this?")
    assert (
        client.get(f"/messages/{text_only['id']}/drawing", headers=bob).status_code
        == 404
    )


def test_a_drawing_out_of_the_world_is_refused(client: TestClient) -> None:
    ada, bob = talking(client)
    wrong = {**DRAWING, "points": [[95.0, 11.1], [46.0, 11.1]]}
    assert attach(client, ada, bob, {"drawing": wrong}).status_code == 422


# --- Push ---


def test_the_push_says_what_the_message_carries(
    client: TestClient, expo: FakeExpo
) -> None:
    ada, bob = talking(client)
    push_on(client, bob)
    put_token(client, bob, BOB_PHONE)
    photo_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": photo_id})
    attach(
        client,
        ada,
        bob,
        {"media_id": uploaded(client, ada, video(), "video/mp4")},
        "Sunrise\non the lake",
    )
    attach(client, ada, bob, {"drawing": DRAWING})
    bodies = [m["body"] for m in expo.sent]
    assert bodies[-3:] == [
        "ada: 📷 Photo",
        "ada: 🎬 Sunrise on the lake",
        "ada: 🗺️ Drawing",
    ]
    assert expo.sent[-1]["data"]["kind"] == "message"


# --- A full space (part D, the user's choice of 2026-10-29) ---


def large_video(extra: int = 400_000) -> bytes:
    """A video larger than a photo, so a cap can count them."""
    return video() + box(b"free", bytes(extra))


def test_a_full_space_takes_the_videos_of_the_oldest_messages_away(
    client: TestClient, folder: MediaFolder, media: MessageMedia
) -> None:
    ada, bob = talking(client)
    sent = []
    for _ in range(3):
        media_id = uploaded(client, ada, large_video(), "video/mp4")
        attach(client, ada, bob, {"media_id": media_id})
        sent.append(media_id)
    photo_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": photo_id})
    # Room for what is there now, and not one video more.
    media.cap = media.used()
    assert "video" in page(client, bob, ada, **WITH)["attachments"]["kinds"]
    newest = upload(client, ada, large_video(), "video/mp4")
    assert newest.status_code == 201, newest.text
    # The oldest went, and only it; the photo stays.
    oldest, *kept = sent
    assert client.get(f"/message-media/{oldest}", headers=bob).status_code == 410
    for media_id in kept + [photo_id]:
        assert client.get(f"/message-media/{media_id}", headers=bob).status_code == 200
    assert f"{oldest}.mp4" not in files(folder)
    shown = [
        m["attachment"]
        for m in page(client, bob, ada, **WITH)["messages"]
        if m["attachment"] and m["attachment"]["kind"] == "video"
    ]
    assert [a["expired"] for a in reversed(shown)] == [True, False, False]
    assert media.used() <= media.cap


def test_room_is_made_only_of_the_videos_of_messages(
    client: TestClient, folder: MediaFolder, media: MessageMedia, disk: DiskClock
) -> None:
    ada, bob = talking(client)
    # A post's video lives beside, in a folder of its own (ADR-0292).
    posts = MediaFolder(folder.root.parent / "posts")
    posts.write("post-video.mp4", large_video())
    photo_id = uploaded(client, ada, photo_bytes(), "image/jpeg")
    attach(client, ada, bob, {"media_id": photo_id})
    unsent = uploaded(client, ada, large_video(), "video/mp4")
    old_video = uploaded(client, ada, large_video(), "video/mp4")
    attach(client, ada, bob, {"media_id": old_video})
    size = len(large_video())
    # Asked for far more than there is: only the video of a message goes.
    assert media.free_videos(10**12) == size
    assert media.free_videos(10**12) == 0
    assert media.free_videos(0) == 0
    assert [name for name, _ in posts.names()] == ["post-video.mp4"]
    assert client.get(f"/message-media/{photo_id}", headers=bob).status_code == 200
    # Nothing left to take away: a full space refuses a new video.
    media.cap = media.used()
    assert upload(client, ada, large_video(), "video/mp4").status_code == 507
    assert "video" not in page(client, bob, ada, **WITH)["attachments"]["kinds"]
    # The upload not sent yet was left alone: it still goes.
    assert attach(client, ada, bob, {"media_id": unsent}).status_code == 201
    # The round leaves the posts' folder alone too.
    disk.s += 10**6
    media.sweep()
    assert [name for name, _ in posts.names()] == ["post-video.mp4"]


def test_a_stop_half_way_never_leaves_a_row_keeping_a_gone_file(
    client: TestClient,
    database: Database,
    folder: MediaFolder,
    media: MessageMedia,
    disk: DiskClock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ada, bob = talking(client)
    media_id = uploaded(client, ada, large_video(), "video/mp4")
    attach(client, ada, bob, {"media_id": media_id})

    # The database cannot be reached: nothing changes, on disk either.
    class Down:
        def connect(self) -> Any:
            raise RuntimeError("database down")

    real = media.database
    monkeypatch.setattr(media, "database", Down())
    with pytest.raises(RuntimeError):
        media.free_videos(1)
    monkeypatch.setattr(media, "database", real)
    assert f"{media_id}.mp4" in files(folder)
    assert rows(database, "SELECT stored FROM message_media") == [{"stored": True}]

    # Stopped after the database said so, before the disk followed.
    def stopped(self: MediaFolder, name: str) -> None:
        raise OSError("stopped here")

    monkeypatch.setattr(MediaFolder, "remove", stopped)
    assert media.free_videos(1) == len(large_video())
    monkeypatch.undo()
    assert rows(database, "SELECT stored FROM message_media") == [{"stored": False}]
    # The file is still there, kept by no row: nobody reads it any more…
    assert f"{media_id}.mp4" in files(folder)
    assert client.get(f"/message-media/{media_id}", headers=bob).status_code == 410
    # …and the hourly round takes it.
    disk.s += 10**6
    assert media.sweep() == 1
    assert files(folder) == []
