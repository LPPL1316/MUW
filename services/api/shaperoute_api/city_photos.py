"""The photos of the towns near the user, on their cards in «Explore»
(TASK-283, ADR-0243, docs/API.md).

A town of GET /nearby-cities has its Wikidata item when OpenStreetMap names
one (Geoapify gives it). Its photo is the item's image (P18), a file of
Wikimedia Commons. Only a photo whose licence lets anyone use it is kept:
CC BY, CC BY-SA, CC0, public domain. The credit its licence asks for,
author and licence, goes with it, and the app writes it on the photo (the
user's choice); a licence that asks for nothing has no credit.

Wikidata and Commons hear only the item and the name of its file, never
where the user is. The API takes the picture once, at most PHOTO_WIDTH
pixels wide, and saves it again as JPEG (nothing of the file's metadata is
kept); the app reads it from GET /city-photos/{item}.jpg, so the phone
never asks Wikimedia. What is known of an item, a photo or none, is kept in
a folder beside the zones and looked at again after RECHECK_S.

The towns' list waits at most WAIT_S for the photos of a place new to the
API; what comes later is kept for the next to ask. The pictures of the
photos found are taken right after, before the phone asks for them.

The places a themed route passes by have theirs the same way (TASK-329,
ADR-0287): in the route's answer when the API planned it, and from GET
/place-photos for the ideas of «Ask for a route», planned once by
tools/themed_ideas.py. That one answers only the items of the ideas, which
the tool lists in data/idea_items.json: the API never asks Wikimedia for
an item someone just names.
"""

from __future__ import annotations

import functools
import html
import io
import json
import re
import threading
import time
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, HTTPException, Query, Response
from PIL import Image, ImageOps
from pydantic import BaseModel

from shaperoute_api.schemas import ErrorBody

# The folder of the cache folder where the photos are kept.
PHOTOS_FOLDER = "city_photos"

WIKIDATA_URL = "https://www.wikidata.org/w/api.php"
COMMONS_URL = "https://commons.wikimedia.org/w/api.php"
# Wikimedia asks every client to say who it is and where to reach them.
USER_AGENT = "MuW-API/1.0 (https://getmuw.app/support/)"
IMAGE = "P18"
# Half a phone wide at three pixels a point: a card is about 160 points.
PHOTO_WIDTH = 500
JPEG_QUALITY = 80
# A thumbnail 500 pixels wide is far less; anything more is not one.
MAX_DOWNLOAD_BYTES = 5_000_000
MAX_PIXELS = 4_000_000
# Behind a transparent picture: a JPEG has no transparency.
BACKGROUND = (255, 255, 255)
# Each request to Wikimedia; after a failure, none for a while.
TIMEOUT_S = 4.0
QUIET_AFTER_FAILURE_S = 600.0
# How long the towns' list waits for photos not known yet: asking Wikidata
# and Commons takes 1-3 s (2026-10-11). Those that come later are kept for
# the next to ask.
WAIT_S = 2.0
# A town's photo changes seldom: looked at again after a month.
RECHECK_S = 30 * 24 * 3600.0
# Six towns a list: their items asked side by side.
WORKERS = 6
# Commons answers at most 50 files a request.
MAX_TITLES = 50
# The licences that let anyone use a photo, as Commons names them.
FREE_LICENCES = ("cc-by-", "cc0", "pd")
# An author's name, as long as the card has room for, and a little more.
MAX_AUTHOR = 60
ITEM = re.compile(r"Q[1-9][0-9]{0,11}")
PHOTO_PATH = re.compile(r"(Q[1-9][0-9]{0,11})\.jpg")
# The items of the ideas' places, as tools/themed_ideas.py writes them.
IDEA_ITEMS = Path(__file__).resolve().parent / "data" / "idea_items.json"
# As many as a themed route has places (themed.MAX_STOPS).
MAX_ASKED = 15

NO_PHOTO = "This town has no photo."
NOT_FETCHED = "The town's photo could not be fetched; try again."
NOT_ITEMS = f"Ask for at most {MAX_ASKED} Wikidata items, e.g. items=Q42,Q64."

FetchJson = Callable[[str], Any]
"""Gets a URL and returns its JSON; raises on any failure."""
FetchBytes = Callable[[str], bytes]
"""Gets a URL and returns its bytes; raises on any failure."""


class CityPhotoBody(BaseModel):
    """A town's photo: where the API gives it, and what to write on it."""

    url: str
    """On the API, e.g. "/city-photos/Q1442886.jpg"."""
    credit: str | None
    """"© LBM1948 · CC BY-SA 4.0"; null when the licence asks for nothing."""


class PlacePhotosBody(BaseModel):
    """The answer of GET /place-photos: the photos of the items that have
    one, by item."""

    photos: dict[str, CityPhotoBody]


@dataclass(frozen=True)
class Known:
    """What is known of an item: its photo's file, or None for none."""

    file: str | None
    thumb: str | None
    credit: str | None
    checked: float
    """When it was asked, in seconds since the epoch."""


def is_item(value: object) -> bool:
    return isinstance(value, str) and ITEM.fullmatch(value) is not None


def idea_items(path: Path = IDEA_ITEMS) -> frozenset[str]:
    """The items GET /place-photos answers: none when the file is not
    there or does not read."""
    try:
        body = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return frozenset()
    items = body.get("items") if isinstance(body, dict) else None
    if not isinstance(items, list):
        return frozenset()
    return frozenset(i for i in items if is_item(i))


def _request(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": USER_AGENT})


def wiki_json(url: str) -> Any:
    with urllib.request.urlopen(_request(url), timeout=TIMEOUT_S) as response:
        return json.load(response)


def wiki_bytes(url: str) -> bytes:
    with urllib.request.urlopen(_request(url), timeout=TIMEOUT_S) as response:
        data: bytes = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ValueError("not a thumbnail: too large")
    return data


def claims_url(item: str) -> str:
    params = {
        "action": "wbgetclaims",
        "entity": item,
        "property": IMAGE,
        "format": "json",
    }
    return f"{WIKIDATA_URL}?{urllib.parse.urlencode(params)}"


def image_info_url(files: Iterable[str]) -> str:
    params = {
        "action": "query",
        "format": "json",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": str(PHOTO_WIDTH),
        "iiextmetadatafilter": "Artist|LicenseShortName|License|AttributionRequired",
        "titles": "|".join(f"File:{file}" for file in files),
    }
    return f"{COMMONS_URL}?{urllib.parse.urlencode(params)}"


def image_of(body: Any) -> str | None:
    """The file of an item's image from Wikidata's claims: the preferred
    one, else the first; never a deprecated one."""
    claims = body.get("claims") if isinstance(body, dict) else None
    images = claims.get(IMAGE) if isinstance(claims, dict) else None
    files: list[tuple[int, str]] = []
    for claim in images if isinstance(images, list) else []:
        if not isinstance(claim, dict) or claim.get("rank") == "deprecated":
            continue
        snak = claim.get("mainsnak")
        value = snak.get("datavalue") if isinstance(snak, dict) else None
        file = value.get("value") if isinstance(value, dict) else None
        if isinstance(file, str) and file.strip():
            first = 0 if claim.get("rank") == "preferred" else 1
            files.append((first, file.strip()))
    return min(files, key=lambda f: f[0])[1] if files else None


def plain(text: str) -> str:
    """Commons' HTML as words: no tags, no entities, one space."""
    words = html.unescape(re.sub(r"<[^>]*>", " ", text))
    return " ".join(words.split())


def credit_of(metadata: dict[str, Any]) -> tuple[bool, str | None]:
    """Whether the photo may be used, and the credit its licence asks for."""

    def value(key: str) -> str:
        field = metadata.get(key)
        raw = field.get("value") if isinstance(field, dict) else None
        return plain(raw) if isinstance(raw, str) else ""

    licence = value("License").lower()
    if not licence.startswith(FREE_LICENCES):
        return False, None
    if licence.startswith(("cc0", "pd")) or value("AttributionRequired") == "false":
        return True, None
    name = value("LicenseShortName") or licence.upper()
    author = value("Artist")
    if len(author) > MAX_AUTHOR:
        author = author[: MAX_AUTHOR - 1].rstrip() + "…"
    # The licence last, always: the app shortens what comes before it.
    return True, f"© {author} · {name}" if author else f"Wikimedia Commons · {name}"


def parse_image_info(body: Any) -> dict[str, tuple[str, str | None]]:
    """For each file asked whose licence lets anyone use it, its thumbnail
    and its credit; by the name it was asked with."""
    query = body.get("query") if isinstance(body, dict) else None
    if not isinstance(query, dict):
        return {}
    # Commons answers "File:Moreda 1.jpg" for "File:Moreda_1.jpg".
    asked = {
        entry["to"]: entry["from"]
        for entry in query.get("normalized") or []
        if isinstance(entry, dict) and "to" in entry and "from" in entry
    }
    pages = query.get("pages")
    found: dict[str, tuple[str, str | None]] = {}
    for page in pages.values() if isinstance(pages, dict) else []:
        infos = page.get("imageinfo") if isinstance(page, dict) else None
        info = infos[0] if isinstance(infos, list) and infos else None
        if not isinstance(info, dict) or not isinstance(page.get("title"), str):
            continue
        thumb = info.get("thumburl")
        metadata = info.get("extmetadata")
        if not isinstance(thumb, str) or not thumb.startswith("https://"):
            continue
        usable, credit = credit_of(metadata if isinstance(metadata, dict) else {})
        if usable:
            title = asked.get(page["title"], page["title"])
            found[title.removeprefix("File:")] = (thumb, credit)
    return found


def jpeg_of(image: bytes) -> bytes:
    """The picture upright, at most PHOTO_WIDTH pixels wide, as a JPEG with
    nothing of the file it came from."""
    picture = Image.open(io.BytesIO(image))
    if picture.width * picture.height > MAX_PIXELS:
        raise ValueError("not a thumbnail: too many pixels")
    picture = ImageOps.exif_transpose(picture)
    if picture.mode in ("RGBA", "LA", "P") and (
        picture.mode != "P" or "transparency" in picture.info
    ):
        layer = picture.convert("RGBA")
        flat = Image.new("RGB", layer.size, BACKGROUND)
        flat.paste(layer, mask=layer.getchannel("A"))
        picture = flat
    else:
        picture = picture.convert("RGB")
    if picture.width > PHOTO_WIDTH:
        height = round(picture.height * PHOTO_WIDTH / picture.width)
        picture = picture.resize(
            (PHOTO_WIDTH, max(height, 1)), Image.Resampling.LANCZOS
        )
    out = io.BytesIO()
    picture.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def photo_url(item: str) -> str:
    return f"/city-photos/{item}.jpg"


class CityPhotos:
    """The towns' photos: what is known of each item, in memory and in
    `folder`, and their pictures there once asked for."""

    def __init__(
        self,
        folder: Path | None,
        fetch_json: FetchJson = wiki_json,
        fetch_bytes: FetchBytes = wiki_bytes,
        clock: Callable[[], float] = time.time,
        wait_s: float = WAIT_S,
        later: Callable[[Callable[[], None]], None] | None = None,
    ) -> None:
        """`later` runs what can wait, the pictures taken ahead: in the
        background, unless a test says otherwise."""
        self.folder = folder
        self._fetch_json = fetch_json
        self._fetch_bytes = fetch_bytes
        self._clock = clock
        self._wait_s = wait_s
        self._later = later
        self._known: dict[str, Known] = {}
        self._quiet_until = 0.0
        self._lock = threading.Lock()
        self._pictures: dict[str, threading.Lock] = {}
        self._asking: set[str] = set()
        # Asking Wikimedia, which a list waits for, and taking the pictures,
        # which nobody waits for, each in threads of its own: a slow picture
        # never keeps a list from its photos (TASK-288).
        self._background = ThreadPoolExecutor(max_workers=2)
        self._downloads = ThreadPoolExecutor(max_workers=2)

    def photos(self, items: Iterable[str]) -> dict[str, CityPhotoBody]:
        """The photos of `items` that have one, by item. Those not known are
        asked now, for at most `wait_s`: what comes later is there for the
        next to ask. When Wikimedia does not answer, they have none this
        time and are not asked again for a while."""
        wanted = list(dict.fromkeys(i for i in items if is_item(i)))
        now = self._clock()
        known = {item: self._recall(item) for item in wanted}
        with self._lock:
            stale = [
                item
                for item, kept in known.items()
                if (kept is None or now - kept.checked >= RECHECK_S)
                and item not in self._asking
            ]
            if now < self._quiet_until:
                stale = []
            self._asking.update(stale)
        if stale:
            asked = self._background.submit(self._ask_and_fetch, stale, now)
            try:
                known.update(asked.result(timeout=self._wait_s))
            except FutureTimeout:
                pass
        return {
            item: CityPhotoBody(url=photo_url(item), credit=kept.credit)
            for item, kept in known.items()
            if kept is not None and kept.file is not None
        }

    def picture(self, item: str) -> bytes | None:
        """The JPEG of `item`'s photo, taken from Commons the first time;
        None when it has none. Raises when Commons does not give it."""
        kept = self._recall(item)
        if kept is None or kept.thumb is None:
            return None
        with self._lock:
            lock = self._pictures.setdefault(item, threading.Lock())
        with lock:
            path = self._path(item, ".jpg")
            if path is not None and path.exists():
                return path.read_bytes()
            jpeg = jpeg_of(self._fetch_bytes(kept.thumb))
            if path is not None:
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(".part")
                temporary.write_bytes(jpeg)
                temporary.replace(path)
            return jpeg

    def _ask_and_fetch(self, items: list[str], now: float) -> dict[str, Known]:
        """`_ask`, then the pictures of the photos found, taken before the
        phone asks for them; never raises."""
        try:
            found = self._ask(items, now)
        except Exception:
            with self._lock:
                self._quiet_until = now + QUIET_AFTER_FAILURE_S
            return {}
        finally:
            with self._lock:
                self._asking.difference_update(items)
        photos = [item for item, kept in found.items() if kept.file is not None]
        if photos and self.folder is not None:
            fetch = functools.partial(self._fetch_pictures, photos)
            if self._later is None:
                self._downloads.submit(fetch)
            else:
                self._later(fetch)
        return found

    def _fetch_pictures(self, items: list[str]) -> None:
        for item in items:
            try:
                self.picture(item)
            except Exception:
                # The phone's own request tries again.
                continue

    def _claims(self, item: str) -> Any:
        """Wikidata's answer for `item`; None when there was none."""
        try:
            return self._fetch_json(claims_url(item))
        except Exception:
            return None

    def _ask(self, items: list[str], now: float) -> dict[str, Known]:
        """What Wikimedia says of `items`, remembered; an item Wikidata did
        not answer for stays unknown. Raises when nothing answered."""
        with ThreadPoolExecutor(max_workers=min(WORKERS, len(items))) as pool:
            bodies = list(pool.map(self._claims, items))
        answered = {
            item: body
            for item, body in zip(items, bodies, strict=True)
            if body is not None
        }
        if not answered:
            raise ConnectionError("Wikidata did not answer")
        files = {item: image_of(body) for item, body in answered.items()}
        named = list(dict.fromkeys(f for f in files.values() if f is not None))
        infos: dict[str, tuple[str, str | None]] = {}
        for start in range(0, len(named), MAX_TITLES):
            chunk = named[start : start + MAX_TITLES]
            infos.update(parse_image_info(self._fetch_json(image_info_url(chunk))))
        found: dict[str, Known] = {}
        for item, file in files.items():
            info = infos.get(file) if file is not None else None
            kept = (
                Known(None, None, None, now)
                if file is None or info is None
                else Known(file, info[0], info[1], now)
            )
            self._remember(item, kept)
            found[item] = kept
        return found

    def _path(self, item: str, suffix: str) -> Path | None:
        return None if self.folder is None else self.folder / f"{item}{suffix}"

    def _recall(self, item: str) -> Known | None:
        with self._lock:
            kept = self._known.get(item)
        if kept is not None:
            return kept
        path = self._path(item, ".json")
        if path is None or not path.exists():
            return None
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            kept = Known(
                file=raw["file"],
                thumb=raw["thumb"],
                credit=raw["credit"],
                checked=float(raw["checked"]),
            )
        except (OSError, ValueError, KeyError, TypeError):
            return None
        with self._lock:
            self._known[item] = kept
        return kept

    def _remember(self, item: str, kept: Known) -> None:
        with self._lock:
            before = self._known.get(item)
            self._known[item] = kept
        path = self._path(item, ".json")
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        if before is None or before.file != kept.file:
            # Another photo, or none: the picture of the old one goes.
            picture = self._path(item, ".jpg")
            if picture is not None:
                picture.unlink(missing_ok=True)
        temporary = path.with_suffix(".part")
        temporary.write_text(json.dumps(asdict(kept)), encoding="utf-8")
        temporary.replace(path)


def install_city_photos(
    app: FastAPI, photos: CityPhotos, allowed: frozenset[str] | None = None
) -> None:
    """GET /city-photos/{item}.jpg: the pictures GET /nearby-cities and the
    themed routes name; GET /place-photos: the photos of the ideas' places,
    `allowed` (data/idea_items.json unless a test says otherwise)."""
    app.include_router(
        city_photo_routes(photos, idea_items() if allowed is None else allowed)
    )


def city_photo_routes(
    photos: CityPhotos, allowed: frozenset[str] = frozenset()
) -> APIRouter:
    router = APIRouter()

    @router.get("/place-photos", responses={422: {"model": ErrorBody}})
    def place_photos(
        items: Annotated[str, Query(max_length=MAX_ASKED * 14)],
    ) -> PlacePhotosBody:
        asked = [i.strip() for i in items.split(",") if i.strip()]
        if not asked or len(asked) > MAX_ASKED or not all(map(is_item, asked)):
            raise HTTPException(422, NOT_ITEMS)
        # Only the ideas' items: another has no photo here, and Wikimedia
        # never hears of it.
        return PlacePhotosBody(photos=photos.photos(i for i in asked if i in allowed))

    @router.get(
        "/city-photos/{name}",
        response_class=Response,
        responses={
            200: {"content": {"image/jpeg": {}}},
            404: {"model": ErrorBody},
            503: {"model": ErrorBody},
        },
    )
    def city_photo(name: str) -> Response:
        match = PHOTO_PATH.fullmatch(name)
        if match is None:
            raise HTTPException(404, NO_PHOTO)
        try:
            jpeg = photos.picture(match.group(1))
        except Exception:
            raise HTTPException(503, NOT_FETCHED) from None
        if jpeg is None:
            raise HTTPException(404, NO_PHOTO)
        # The same item is the same photo for a month: the phone keeps it.
        return Response(
            jpeg,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=86400"},
        )

    return router
