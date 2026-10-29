"""The towns' photos for «NEARBY TOWNS» (TASK-283, ADR-0243). No network:
Wikidata's and Commons' answers are cut from those of 2026-10-11 around
Moreda de Álava."""

from __future__ import annotations

import io
import json
import threading
import time
import urllib.parse
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from route_engine.network import FileSource

from shaperoute_api.app import create_app
from shaperoute_api.city_photos import (
    IDEA_ITEMS,
    MAX_ASKED,
    MAX_AUTHOR,
    PHOTO_WIDTH,
    QUIET_AFTER_FAILURE_S,
    RECHECK_S,
    CityPhotoBody,
    CityPhotos,
    PlacePhotosBody,
    credit_of,
    idea_items,
    image_of,
    install_city_photos,
    jpeg_of,
    parse_image_info,
)

HERE = Path(__file__).parent
MOREDA = "Q1442886"
OYON = "Q581589"
LAGUARDIA = "Q24008400"
NOWHERE = "Q999"


def claim(file: str, rank: str = "normal") -> dict[str, Any]:
    return {
        "mainsnak": {
            "snaktype": "value",
            "property": "P18",
            "datavalue": {"value": file, "type": "string"},
            "datatype": "commonsMedia",
        },
        "type": "statement",
        "rank": rank,
    }


def meta(**fields: str) -> dict[str, Any]:
    return {
        key: {"value": value, "source": "commons-desc-page"}
        for key, value in fields.items()
    }


CC_BY_SA = meta(
    Artist='<a href="//commons.wikimedia.org/wiki/User:LBM1948" '
    'title="User:LBM1948">LBM1948</a>',
    LicenseShortName="CC BY-SA 4.0",
    License="cc-by-sa-4.0",
    AttributionRequired="true",
)
PUBLIC_DOMAIN = meta(
    Artist='<a href="//commons.wikimedia.org/wiki/User:Deivid">Deivid</a>',
    LicenseShortName="Public domain",
    License="pd",
    AttributionRequired="false",
)


def thumb(file: str) -> str:
    name = urllib.parse.quote(file.replace(" ", "_"))
    return (
        f"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/{name}/500px-{name}"
    )


def jpeg(width: int, height: int, colour: str = "orange") -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(out, "JPEG")
    return out.getvalue()


class Wiki:
    """Wikidata and Commons: an item's images, a file's licence."""

    def __init__(
        self,
        images: dict[str, list[dict[str, Any]]],
        files: dict[str, dict[str, Any]],
        pictures: dict[str, bytes] | None = None,
    ) -> None:
        self.images = images
        self.files = files
        self.pictures = pictures or {}
        self.urls: list[str] = []
        self.down = False

    def get_json(self, url: str) -> Any:
        self.urls.append(url)
        if self.down:
            raise OSError("no answer")
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        if query["action"] == ["wbgetclaims"]:
            [item] = query["entity"]
            return {"claims": {"P18": self.images[item]} if item in self.images else {}}
        titles = query["titles"][0].split("|")
        pages: dict[str, Any] = {}
        normalized = []
        for n, title in enumerate(titles):
            name = title.replace("_", " ")
            if name != title:
                normalized.append({"from": title, "to": name})
            file = name.removeprefix("File:")
            if file not in self.files:
                pages[str(-n - 1)] = {"ns": 6, "title": name, "missing": ""}
                continue
            pages[str(n)] = {
                "ns": 6,
                "title": name,
                "imageinfo": [
                    {"thumburl": thumb(file), "extmetadata": self.files[file]}
                ],
            }
        body: dict[str, Any] = {"query": {"pages": pages}}
        if normalized:
            body["query"]["normalized"] = normalized
        return body

    def get_bytes(self, url: str) -> bytes:
        self.urls.append(url)
        if self.down or url not in self.pictures:
            raise OSError("no answer")
        return self.pictures[url]


def around_moreda() -> Wiki:
    return Wiki(
        {
            MOREDA: [claim("Moreda_1.jpg")],
            OYON: [claim("Iglesia de Oyón.jpg")],
            # GFDL only: free, but it asks for its whole text beside the photo.
            LAGUARDIA: [claim("Laguardia.jpg")],
        },
        {
            "Moreda 1.jpg": CC_BY_SA,
            "Iglesia de Oyón.jpg": PUBLIC_DOMAIN,
            "Laguardia.jpg": meta(LicenseShortName="GFDL", License="gfdl"),
        },
        {
            thumb("Moreda 1.jpg"): jpeg(500, 325),
            thumb("Iglesia de Oyón.jpg"): jpeg(500, 667),
        },
    )


def photos_of(
    wiki: Wiki,
    folder: Path | None,
    now: list[float] | None = None,
    later: list[Callable[[], None]] | None = None,
) -> CityPhotos:
    """The pictures ahead wait in `later`, to be taken when the test says."""
    clock = now or [1_000_000.0]
    return CityPhotos(
        folder,
        wiki.get_json,
        wiki.get_bytes,
        clock=lambda: clock[0],
        # The fakes answer at once: a busy machine never runs out of time.
        wait_s=30.0,
        later=(later if later is not None else []).append,
    )


def test_the_photo_of_an_item_with_its_credit() -> None:
    wiki = around_moreda()
    found = photos_of(wiki, None).photos([MOREDA, OYON, LAGUARDIA, NOWHERE])
    assert found == {
        MOREDA: CityPhotoBody(
            url=f"/city-photos/{MOREDA}.jpg", credit="© LBM1948 · CC BY-SA 4.0"
        ),
        # Public domain asks for nothing: nothing is written on it.
        OYON: CityPhotoBody(url=f"/city-photos/{OYON}.jpg", credit=None),
    }


def test_wikimedia_hears_only_the_items_and_the_files() -> None:
    wiki = around_moreda()
    photos_of(wiki, None).photos([MOREDA, OYON, LAGUARDIA, NOWHERE])
    asked = [urllib.parse.parse_qs(urllib.parse.urlsplit(u).query) for u in wiki.urls]
    entities = sorted(q["entity"][0] for q in asked if "entity" in q)
    assert entities == sorted([MOREDA, OYON, LAGUARDIA, NOWHERE])
    # Commons once, for all the files.
    [files] = [q["titles"][0] for q in asked if "titles" in q]
    assert sorted(files.split("|")) == [
        "File:Iglesia de Oyón.jpg",
        "File:Laguardia.jpg",
        "File:Moreda_1.jpg",
    ]
    for query in asked:
        assert set(query) <= {
            "action",
            "entity",
            "property",
            "format",
            "prop",
            "iiprop",
            "iiurlwidth",
            "iiextmetadatafilter",
            "titles",
        }


def test_what_is_not_an_item_is_not_asked() -> None:
    wiki = around_moreda()
    assert photos_of(wiki, None).photos(["Q0", "moreda", "Q1 OR 1=1", ""]) == {}
    assert wiki.urls == []


def test_an_item_is_asked_once_then_kept_on_disk(tmp_path: Path) -> None:
    wiki = around_moreda()
    photos = photos_of(wiki, tmp_path)
    first = photos.photos([MOREDA, NOWHERE])
    asked = len(wiki.urls)
    assert photos.photos([MOREDA, NOWHERE]) == first
    assert len(wiki.urls) == asked
    # A new start of the API: from the folder, nothing asked.
    again = photos_of(wiki, tmp_path)
    assert again.photos([MOREDA, NOWHERE]) == first
    assert len(wiki.urls) == asked
    kept = json.loads((tmp_path / f"{MOREDA}.json").read_text())
    assert kept["file"] == "Moreda_1.jpg"


def test_after_a_month_the_item_is_asked_again(tmp_path: Path) -> None:
    wiki = around_moreda()
    now = [1_000_000.0]
    photos = photos_of(wiki, tmp_path, now)
    photos.photos([MOREDA])
    assert photos.picture(MOREDA) is not None
    # Its image changed on Wikidata: the next month, the new one.
    wiki.images[MOREDA] = [claim("Iglesia de Oyón.jpg")]
    now[0] += RECHECK_S - 1
    assert photos.photos([MOREDA])[MOREDA].credit == "© LBM1948 · CC BY-SA 4.0"
    now[0] += 1
    assert photos.photos([MOREDA])[MOREDA].credit is None
    # The picture of the old photo is gone with it.
    assert not (tmp_path / f"{MOREDA}.jpg").exists()


def test_without_an_answer_no_photo_and_not_asked_again_for_a_while() -> None:
    wiki = around_moreda()
    wiki.down = True
    now = [1_000_000.0]
    photos = photos_of(wiki, None, now)
    assert photos.photos([MOREDA]) == {}
    asked = len(wiki.urls)
    assert photos.photos([MOREDA]) == {}
    assert len(wiki.urls) == asked
    wiki.down = False
    now[0] += QUIET_AFTER_FAILURE_S
    assert MOREDA in photos.photos([MOREDA])


def test_an_item_wikidata_did_not_answer_for_stays_unknown() -> None:
    wiki = around_moreda()
    real = wiki.get_json

    def flaky(url: str) -> Any:
        if OYON in url:
            raise OSError("no answer")
        return real(url)

    photos = CityPhotos(None, flaky, wiki.get_bytes, wait_s=30.0)
    assert set(photos.photos([MOREDA, OYON])) == {MOREDA}
    # Not remembered as without a photo: asked again, it has one.
    photos._fetch_json = real
    assert set(photos.photos([MOREDA, OYON])) == {MOREDA, OYON}


def test_the_pictures_are_taken_before_the_phone_asks(tmp_path: Path) -> None:
    wiki = around_moreda()
    later: list[Callable[[], None]] = []
    photos = photos_of(wiki, tmp_path, later=later)
    photos.photos([MOREDA, OYON, LAGUARDIA, NOWHERE])
    assert not any(u.startswith("https://upload.") for u in wiki.urls)
    [take] = later
    take()
    assert (tmp_path / f"{MOREDA}.jpg").exists()
    assert (tmp_path / f"{OYON}.jpg").exists()
    # Then Commons is not needed any more.
    wiki.down = True
    assert photos.picture(MOREDA) == (tmp_path / f"{MOREDA}.jpg").read_bytes()


def test_a_slow_answer_is_there_for_the_next_to_ask() -> None:
    wiki = around_moreda()
    go = threading.Event()

    def slow(url: str) -> Any:
        go.wait(timeout=10)
        return wiki.get_json(url)

    photos = CityPhotos(None, slow, wiki.get_bytes, wait_s=0.05)
    assert photos.photos([MOREDA]) == {}
    # Still being asked: not asked twice.
    assert photos.photos([MOREDA]) == {}
    go.set()
    deadline = time.monotonic() + 10
    while MOREDA not in photos.photos([MOREDA]) and time.monotonic() < deadline:
        time.sleep(0.01)
    assert MOREDA in photos.photos([MOREDA])
    assert sum(MOREDA in url for url in wiki.urls) == 1


def test_pictures_being_taken_never_keep_a_list_from_its_photos(
    tmp_path: Path,
) -> None:
    """TASK-288: the pictures are taken in threads of their own, not in
    those that ask Wikimedia for a list."""
    files = {f"Q{n}": f"Town {n}.jpg" for n in (11, 12, 13)}
    wiki = Wiki(
        {item: [claim(file)] for item, file in files.items()},
        {file: PUBLIC_DOMAIN for file in files.values()},
        {thumb(file): jpeg(500, 300) for file in files.values()},
    )
    go = threading.Event()

    def slow_picture(url: str) -> bytes:
        go.wait(timeout=30)
        return wiki.get_bytes(url)

    photos = CityPhotos(tmp_path, wiki.get_json, slow_picture, wait_s=10.0)
    try:
        # Two lists whose pictures are being taken, and wait.
        assert set(photos.photos(["Q11"])) == {"Q11"}
        assert set(photos.photos(["Q12"])) == {"Q12"}
        # The next list has its photo all the same.
        assert set(photos.photos(["Q13"])) == {"Q13"}
    finally:
        go.set()


def test_the_preferred_image_and_never_a_deprecated_one() -> None:
    body = {
        "claims": {
            "P18": [
                claim("Old.jpg", "deprecated"),
                claim("First.jpg"),
                claim("Best.jpg", "preferred"),
            ]
        }
    }
    assert image_of(body) == "Best.jpg"
    assert image_of({"claims": {"P18": [claim("Old.jpg", "deprecated")]}}) is None
    assert image_of({"claims": {}}) is None
    assert image_of({"error": {"code": "no-such-entity"}}) is None
    assert image_of("nonsense") is None


@pytest.mark.parametrize(
    ("licence", "usable"),
    [
        ("cc-by-4.0", True),
        ("cc-by-sa-3.0", True),
        ("cc-by-sa-2.0-de", True),
        ("cc0", True),
        ("pd", True),
        ("gfdl", False),
        ("fal", False),
        ("", False),
    ],
)
def test_only_a_licence_that_lets_anyone_use_it(licence: str, usable: bool) -> None:
    assert credit_of(meta(License=licence, Artist="X"))[0] is usable


def test_the_credit_in_words() -> None:
    assert credit_of(CC_BY_SA) == (True, "© LBM1948 · CC BY-SA 4.0")
    assert credit_of(PUBLIC_DOMAIN) == (True, None)
    assert credit_of(meta(License="cc0", Artist="Zarateman")) == (True, None)
    # Entities and more than a name.
    many = meta(
        License="cc-by-3.0",
        LicenseShortName="CC BY 3.0",
        Artist="<span>Jos&eacute; Ruiz</span>\n<br/> &amp; friends",
    )
    assert credit_of(many) == (True, "© José Ruiz & friends · CC BY 3.0")
    # No author: where the photo comes from. The licence is always last.
    nobody = meta(License="cc-by-sa-4.0", LicenseShortName="CC BY-SA 4.0")
    assert credit_of(nobody) == (True, "Wikimedia Commons · CC BY-SA 4.0")
    long = meta(License="cc-by-4.0", LicenseShortName="CC BY 4.0", Artist="A" * 200)
    credit = credit_of(long)[1]
    assert credit is not None and credit.startswith("© A")
    assert credit.endswith(" · CC BY 4.0")
    assert len(credit.removeprefix("© ").split(" · ")[0]) == MAX_AUTHOR


def test_a_file_commons_does_not_have_has_no_photo() -> None:
    body = {
        "query": {"pages": {"-1": {"ns": 6, "title": "File:Gone.jpg", "missing": ""}}}
    }
    assert parse_image_info(body) == {}
    assert parse_image_info({"error": "x"}) == {}


def test_the_picture_is_taken_once_and_reduced(tmp_path: Path) -> None:
    wiki = around_moreda()
    wiki.pictures[thumb("Moreda 1.jpg")] = jpeg(1200, 800)
    photos = photos_of(wiki, tmp_path)
    photos.photos([MOREDA])
    picture = photos.picture(MOREDA)
    assert picture is not None
    image = Image.open(io.BytesIO(picture))
    assert (image.format, image.size) == ("JPEG", (PHOTO_WIDTH, 333))
    downloads = [u for u in wiki.urls if u.startswith("https://upload.")]
    assert photos.picture(MOREDA) == picture
    assert [u for u in wiki.urls if u.startswith("https://upload.")] == downloads
    assert len(downloads) == 1
    assert (tmp_path / f"{MOREDA}.jpg").read_bytes() == picture


def test_nothing_of_the_file_is_kept() -> None:
    out = io.BytesIO()
    exif = Image.Exif()
    exif[0x010F] = "Camera maker"
    Image.new("RGB", (400, 300), "blue").save(out, "JPEG", exif=exif)
    kept = Image.open(io.BytesIO(jpeg_of(out.getvalue())))
    assert dict(kept.getexif()) == {}
    assert kept.size == (400, 300)


def test_a_transparent_picture_becomes_a_jpeg() -> None:
    out = io.BytesIO()
    Image.new("RGBA", (300, 200), (0, 0, 0, 0)).save(out, "PNG")
    kept = Image.open(io.BytesIO(jpeg_of(out.getvalue())))
    assert kept.format == "JPEG"
    assert kept.getpixel((10, 10)) == (255, 255, 255)


def client_with(
    photos: CityPhotos, allowed: frozenset[str] = frozenset()
) -> TestClient:
    app = create_app(FileSource(HERE))
    install_city_photos(app, photos, allowed)
    return TestClient(app)


def test_the_endpoint_gives_the_picture(tmp_path: Path) -> None:
    photos = photos_of(around_moreda(), tmp_path)
    photos.photos([MOREDA, NOWHERE])
    client = client_with(photos)
    response = client.get(f"/city-photos/{MOREDA}.jpg")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(response.content)).size == (500, 325)
    # A town without a photo, one never named, and what is not a town.
    for name in [f"{NOWHERE}.jpg", f"{LAGUARDIA}.jpg", f"{MOREDA}.png", "..%2F.env"]:
        assert client.get(f"/city-photos/{name}").status_code == 404


def test_the_endpoint_says_when_commons_did_not_give_it(tmp_path: Path) -> None:
    wiki = around_moreda()
    photos = photos_of(wiki, tmp_path)
    photos.photos([MOREDA])
    wiki.down = True
    response = client_with(photos).get(f"/city-photos/{MOREDA}.jpg")
    assert response.status_code == 503
    wiki.down = False
    assert client_with(photos).get(f"/city-photos/{MOREDA}.jpg").status_code == 200


# The ideas of «Ask for a route» (TASK-329, ADR-0287): their places' photos,
# for those items only.


def entities(wiki: Wiki) -> list[str]:
    asked = [urllib.parse.parse_qs(urllib.parse.urlsplit(u).query) for u in wiki.urls]
    return sorted(q["entity"][0] for q in asked if "entity" in q)


def test_the_photos_of_the_ideas_places(tmp_path: Path) -> None:
    wiki = around_moreda()
    ideas = frozenset({MOREDA, OYON, LAGUARDIA})
    client = client_with(photos_of(wiki, tmp_path), ideas)
    response = client.get("/place-photos", params={"items": f"{MOREDA},{LAGUARDIA}"})
    assert response.status_code == 200
    assert response.json() == {
        "photos": {
            MOREDA: {
                "url": f"/city-photos/{MOREDA}.jpg",
                "credit": "© LBM1948 · CC BY-SA 4.0",
            }
        }
    }
    # Its picture from our API, as a town's.
    assert client.get(f"/city-photos/{MOREDA}.jpg").status_code == 200


def test_an_item_that_is_not_an_idea_s_is_never_asked(tmp_path: Path) -> None:
    wiki = around_moreda()
    client = client_with(photos_of(wiki, tmp_path), frozenset({OYON}))
    response = client.get("/place-photos", params={"items": f"{MOREDA},{OYON}"})
    assert set(response.json()["photos"]) == {OYON}
    assert entities(wiki) == [OYON]
    # Nor is its picture there to take.
    assert client.get(f"/city-photos/{MOREDA}.jpg").status_code == 404


@pytest.mark.parametrize(
    "items",
    [
        "",
        ",",
        "Q1,moreda",
        "Q1 OR 1=1",
        ",".join(f"Q{n}" for n in range(1, MAX_ASKED + 2)),
    ],
)
def test_only_a_few_items_are_asked_for(items: str) -> None:
    wiki = around_moreda()
    client = client_with(photos_of(wiki, None), frozenset({"Q1"}))
    assert client.get("/place-photos", params={"items": items}).status_code == 422
    assert wiki.urls == []


def test_without_the_list_no_place_has_a_photo() -> None:
    wiki = around_moreda()
    client = client_with(photos_of(wiki, None))
    response = client.get("/place-photos", params={"items": MOREDA})
    assert response.json() == {"photos": {}}
    assert wiki.urls == []


def test_the_ideas_items_read_from_their_file(tmp_path: Path) -> None:
    path = tmp_path / "idea_items.json"
    path.write_text(json.dumps({"items": [MOREDA, "moreda", 7, OYON]}), "utf-8")
    assert idea_items(path) == {MOREDA, OYON}
    path.write_text("{", "utf-8")
    assert idea_items(path) == frozenset()
    assert idea_items(tmp_path / "none.json") == frozenset()
    # The file the tool writes, beside the API.
    assert idea_items(IDEA_ITEMS)
    kept = json.loads(IDEA_ITEMS.read_text("utf-8"))["items"]
    assert sorted(kept) == sorted(idea_items(IDEA_ITEMS)) == kept


def test_the_shared_fixture_is_a_body_of_the_api() -> None:
    contract = HERE.parents[2] / "packages" / "shared-types" / "fixtures"
    body = json.loads((contract / "place-photos.json").read_text("utf-8"))
    assert PlacePhotosBody.model_validate(body).model_dump(mode="json") == body
