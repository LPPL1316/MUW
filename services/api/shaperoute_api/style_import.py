"""Loads a MuW Style post into the database, once the user approved it
(TASK-384, ADR-0326, docs/STYLE.md).

    python -m shaperoute_api.style_import MS-001.json MS-001.jpg
    python -m shaperoute_api.style_import --hide MS-001

The JSON is the post as style_posts.py keeps it (the form of
tests/fixtures/style/MS-001.json): its theme and gender, the title in the
five languages, what made the photo, when it comes out, and its dots, each
with a page of the shop's own site. Nothing else: a field more or less is
an error. The photo, a JPEG, goes to data/media/style/<id>.jpg; the post
waits there for its publish_at.

A post already loaded is never overwritten: a new id, or --hide and a new
one. Hidden is not deleted, so its counts stay. The address of the
database comes only from SHAPEROUTE_DATABASE_URL.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from psycopg import errors as pg_errors
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from shaperoute_api.db import Database
from shaperoute_api.muw_routes import LANGUAGES
from shaperoute_api.style_links import Retailer, StyleLinkError, checked_page
from shaperoute_api.style_posts import DEFAULT_IMAGE_DIR, ID_PATTERN, Gender, Theme

MAX_TITLE_LENGTH = 80
MAX_TAGS = 8
MAX_IMAGE_BYTES = 3_000_000
JPEG_START = b"\xff\xd8\xff"


class StyleImportError(ValueError):
    """A post that cannot be loaded; says why."""


class StyleTagFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    item: str = Field(min_length=1, max_length=40)
    brand: str = Field(min_length=1, max_length=80)
    product_name: str = Field(min_length=1, max_length=200)
    price_eur: float | None = Field(default=None, gt=0, lt=1_000_000)
    price_seen_at: datetime | None = None
    retailer: Retailer
    url: str

    @field_validator("price_seen_at")
    @classmethod
    def _aware(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("price_seen_at: with its time zone")
        return value


class StylePostFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=ID_PATTERN)
    theme: Theme
    gender: Gender
    title: dict[str, str]
    image_tool: str = Field(min_length=1, max_length=80)
    publish_at: datetime
    tags: list[StyleTagFile] = Field(min_length=1, max_length=MAX_TAGS)

    @field_validator("title")
    @classmethod
    def _five_languages(cls, value: dict[str, str]) -> dict[str, str]:
        if set(value) != LANGUAGES:
            raise ValueError(f"title: in {', '.join(sorted(LANGUAGES))}")
        for language, text in value.items():
            if not text.strip() or len(text) > MAX_TITLE_LENGTH:
                raise ValueError(
                    f"title.{language}: 1 to {MAX_TITLE_LENGTH} characters"
                )
        return value

    @field_validator("publish_at")
    @classmethod
    def _aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("publish_at: with its time zone")
        return value


def parse_post(body: Any) -> StylePostFile:
    """The post of a file; StyleImportError saying what is wrong."""
    try:
        post = StylePostFile.model_validate(body)
    except ValidationError as exc:
        raise StyleImportError(str(exc)) from None
    for tag in post.tags:
        try:
            checked_page(tag.retailer, tag.url)
        except StyleLinkError as exc:
            raise StyleImportError(str(exc)) from None
    return post


def checked_image(data: bytes) -> bytes:
    if not data.startswith(JPEG_START):
        raise StyleImportError("image: a JPEG")
    if len(data) > MAX_IMAGE_BYTES:
        raise StyleImportError(f"image: at most {MAX_IMAGE_BYTES} bytes")
    return data


def load(database: Database, post: StylePostFile, image: bytes, images: Path) -> Path:
    """The photo written and the post with its dots in the database; the
    photo's path. Nothing written for a post already there."""
    images.mkdir(parents=True, exist_ok=True)
    name = f"{post.id}.jpg"
    path = images / name
    if path.exists():
        raise StyleImportError(f"{post.id}: its photo is already there")
    partial = images / f".{name}.part"
    partial.write_bytes(checked_image(image))
    try:
        with database.connect() as conn:
            conn.execute(
                "INSERT INTO style_posts (id, theme, gender, title, image,"
                " image_tool, publish_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (
                    post.id,
                    post.theme,
                    post.gender,
                    Jsonb(post.title),
                    name,
                    post.image_tool,
                    post.publish_at,
                ),
            )
            for tag in post.tags:
                conn.execute(
                    "INSERT INTO post_product_tags (post_id, x, y, item, brand,"
                    " product_name, price_eur, price_seen_at, retailer, url)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (
                        post.id,
                        tag.x,
                        tag.y,
                        tag.item,
                        tag.brand,
                        tag.product_name,
                        tag.price_eur,
                        tag.price_seen_at,
                        tag.retailer,
                        tag.url,
                    ),
                )
        partial.rename(path)
    except pg_errors.UniqueViolation:
        partial.unlink(missing_ok=True)
        raise StyleImportError(f"{post.id}: already loaded") from None
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    return path


def hide(database: Database, post_id: str, now: datetime) -> bool:
    """Whether a post shown or waiting was hidden."""
    with database.connect() as conn:
        row = conn.execute(
            "UPDATE style_posts SET hidden_at = %s WHERE id = %s"
            " AND hidden_at IS NULL RETURNING id",
            (now, post_id),
        ).fetchone()
    return row is not None


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.style_import",
        description="Load an approved MuW Style post, or hide one.",
    )
    parser.add_argument("post", nargs="?", type=Path, help="the post, a JSON file")
    parser.add_argument("image", nargs="?", type=Path, help="its photo, a JPEG")
    parser.add_argument("--hide", metavar="ID", help="hide this post instead")
    parser.add_argument(
        "--images",
        type=Path,
        default=DEFAULT_IMAGE_DIR,
        help=f"where the photos are kept (default: {DEFAULT_IMAGE_DIR})",
    )
    args = parser.parse_args(argv)
    database = Database.from_env(os.environ)
    if database is None:
        print("SHAPEROUTE_DATABASE_URL is not set", file=sys.stderr)
        return 2
    if args.hide:
        hidden = hide(database, args.hide, datetime.now(UTC))
        print(f"{args.hide}: {'hidden' if hidden else 'not found or hidden already'}")
        return 0 if hidden else 1
    if args.post is None or args.image is None:
        parser.error("a post and its photo, or --hide ID")
    try:
        post = parse_post(json.loads(args.post.read_text(encoding="utf-8")))
        path = load(database, post, args.image.read_bytes(), args.images)
    except (StyleImportError, json.JSONDecodeError) as exc:
        print(f"not loaded: {exc}", file=sys.stderr)
        return 1
    print(f"{post.id}: loaded, photo {path}, out at {post.publish_at.isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
