"""MuW Style (TASK-384, ADR-0326, docs/STYLE.md, docs/API.md, «Style»).

Posts of MuW with a photo made with AI and dots on it, one for each item:
touched, a dot opens its product, and «Shop» opens the shop. They are apart
from GET /feed and from drawings, as the routes of MuW (ADR-0310): an app
already published never asks for them and sees nothing new.

- GET /style: the posts shown, newest first, by theme and gender, a page at
  a time (`before`, the id of the last one).
- GET /style/{id}: one; GET /style/{id}/image: its photo, a JPEG.
- POST /style/tags/{id}/open: a product opened, 204.
- POST /style/tags/{id}/shop: «Shop» touched, the link to open.

A post is shown from its publish_at, until it is hidden, and only with at
least one dot of a product still sold. A price read more than PRICE_DAYS
ago is not said: the app says «See price».

The two counts are one more for the dot on that day, and nothing else: no
account, no address, no phone is written (ADR-0326 point 3). Past
MAX_COUNTS_PER_HOUR from one network address, counted in memory as the
feedback's, a touch is answered as always and not counted.

No account is needed to see them. Without the database, 503, as the rest
of what the accounts' database holds.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from shaperoute_api.access import RateLimiter
from shaperoute_api.accounts import ACCOUNT_ERRORS, Accounts, accounts_of
from shaperoute_api.db import Database
from shaperoute_api.schemas import ErrorBody
from shaperoute_api.style_links import StyleLinkError, StyleLinks

log = logging.getLogger(__name__)

# Under --media-dir's default, as the photos of the messages (ADR-0289).
DEFAULT_IMAGE_DIR = Path("data/media/style")
CACHE_CONTROL = "public, max-age=86400"

Theme = Literal["running", "trail", "bike", "gym", "athleisure"]
Gender = Literal["women", "men"]
ID_PATTERN = r"^MS-[0-9]{3,5}$"

DEFAULT_LIMIT = 20
MAX_LIMIT = 50
PRICE_DAYS = 7
MAX_COUNTS_PER_HOUR = 120
HOUR_S = 3600.0

NO_POST = "No Style post with this id."
NO_TAG = "No product with this id."


class StyleTagBody(BaseModel):
    """A dot on the photo and its product."""

    id: int
    x: float = Field(ge=0, le=1, description="From the left of the photo, 0–1.")
    y: float = Field(ge=0, le=1, description="From the top of the photo, 0–1.")
    item: str
    brand: str
    product_name: str
    retailer: str
    price_eur: float | None = Field(
        description=f"None when read more than {PRICE_DAYS} days ago or never."
    )
    price_seen_on: date | None


class StylePostBody(BaseModel):
    """packages/shared-types/fixtures/style-post.json."""

    id: str
    theme: Theme
    gender: Gender
    title: dict[str, str]
    image_url: str
    image_tool: str
    published_at: datetime
    tags: list[StyleTagBody]


class StylePageBody(BaseModel):
    """packages/shared-types/fixtures/style-page.json."""

    posts: list[StylePostBody]
    before: str | None = Field(description="Ask with ?before= for the next page.")


class StyleShopBody(BaseModel):
    """POST /style/tags/{id}/shop: what the app opens in the browser."""

    url: str


# --- In the database ---

POST_COLUMNS = "p.id, p.theme, p.gender, p.title, p.image_tool, p.publish_at"
SHOWN = (
    "p.hidden_at IS NULL AND p.publish_at <= %(now)s AND EXISTS ("
    " SELECT 1 FROM post_product_tags t WHERE t.post_id = p.id AND t.active)"
)


@dataclass
class StylePosts:
    """The posts of MuW Style, in the database of the accounts."""

    database: Database
    now: Callable[[], datetime]
    links: StyleLinks
    images: Path = DEFAULT_IMAGE_DIR

    def page(
        self,
        theme: Theme | None,
        gender: Gender | None,
        before: str | None,
        limit: int,
    ) -> StylePageBody:
        """The posts shown, newest first; after `before` when given."""
        now = self.now()
        where = [SHOWN]
        params: dict[str, Any] = {"now": now, "limit": limit + 1}
        if theme is not None:
            where.append("p.theme = %(theme)s")
            params["theme"] = theme
        if gender is not None:
            where.append("p.gender = %(gender)s")
            params["gender"] = gender
        with self.database.connect() as conn:
            if before is not None:
                # The last post of the page before: one hidden since is still
                # a place to go on from.
                last = conn.execute(
                    "SELECT publish_at, id FROM style_posts WHERE id = %s", (before,)
                ).fetchone()
                if last is None:
                    raise HTTPException(422, "before: the id of a Style post")
                where.append("(p.publish_at, p.id) < (%(at)s, %(id)s)")
                params.update(at=last["publish_at"], id=last["id"])
            rows = conn.execute(
                f"SELECT {POST_COLUMNS} FROM style_posts p WHERE {' AND '.join(where)}"
                " ORDER BY p.publish_at DESC, p.id DESC LIMIT %(limit)s",
                params,
            ).fetchall()
            more = len(rows) > limit
            rows = rows[:limit]
            tags = self._tags(conn, [row["id"] for row in rows], now)
        posts = [self._post(row, tags.get(row["id"], [])) for row in rows]
        return StylePageBody(posts=posts, before=posts[-1].id if more else None)

    def one(self, post_id: str) -> StylePostBody:
        now = self.now()
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT {POST_COLUMNS} FROM style_posts p"
                f" WHERE p.id = %(id)s AND {SHOWN}",
                {"id": post_id, "now": now},
            ).fetchone()
            if row is None:
                raise HTTPException(404, NO_POST)
            tags = self._tags(conn, [post_id], now)
        return self._post(row, tags.get(post_id, []))

    def image(self, post_id: str) -> bytes:
        """The photo of a post shown; 404 otherwise, or without its file."""
        with self.database.connect() as conn:
            row = conn.execute(
                f"SELECT p.image FROM style_posts p WHERE p.id = %(id)s AND {SHOWN}",
                {"id": post_id, "now": self.now()},
            ).fetchone()
        if row is None:
            raise HTTPException(404, NO_POST)
        try:
            return (self.images / row["image"]).read_bytes()
        except FileNotFoundError:
            log.warning("style: the photo of %s is missing", post_id)
            raise HTTPException(404, NO_POST) from None

    def count(self, tag_id: int, column: Literal["opens", "shops"]) -> str:
        """One more for the dot today, and what «Shop» opens; 404 for a dot
        not shown, and nothing counted."""
        page = self.shown_tag(tag_id)
        with self.database.connect() as conn:
            conn.execute(
                f"INSERT INTO product_tag_clicks (tag_id, day, {column})"
                " VALUES (%s, %s, 1) ON CONFLICT (tag_id, day)"
                f" DO UPDATE SET {column} = product_tag_clicks.{column} + 1",
                (tag_id, self.now().date()),
            )
        return page

    def shown_tag(self, tag_id: int) -> str:
        """The link of a dot shown, or 404."""
        with self.database.connect() as conn:
            row = conn.execute(
                "SELECT t.retailer, t.url FROM post_product_tags t"
                " JOIN style_posts p ON p.id = t.post_id"
                f" WHERE t.id = %(tag)s AND t.active AND {SHOWN}",
                {"tag": tag_id, "now": self.now()},
            ).fetchone()
        if row is None:
            raise HTTPException(404, NO_TAG)
        try:
            return self.links.link(row["retailer"], row["url"])
        except StyleLinkError:
            # style_import.py checks every page: a row changed by hand.
            log.warning("style: the page of tag %s is not the shop's", tag_id)
            raise HTTPException(404, NO_TAG) from None

    def _tags(
        self, conn: Any, post_ids: list[str], now: datetime
    ) -> dict[str, list[StyleTagBody]]:
        if not post_ids:
            return {}
        rows = conn.execute(
            "SELECT id, post_id, x, y, item, brand, product_name, retailer,"
            " price_eur, price_seen_at FROM post_product_tags"
            " WHERE post_id = ANY(%s) AND active ORDER BY post_id, id",
            (post_ids,),
        ).fetchall()
        fresh = now - timedelta(days=PRICE_DAYS)
        tags: dict[str, list[StyleTagBody]] = {}
        for row in rows:
            seen = row["price_seen_at"]
            known = row["price_eur"] is not None and seen is not None and seen >= fresh
            tags.setdefault(row["post_id"], []).append(
                StyleTagBody(
                    id=row["id"],
                    x=row["x"],
                    y=row["y"],
                    item=row["item"],
                    brand=row["brand"],
                    product_name=row["product_name"],
                    retailer=row["retailer"],
                    price_eur=float(row["price_eur"]) if known else None,
                    price_seen_on=seen.date() if known else None,
                )
            )
        return tags

    @staticmethod
    def _post(row: Any, tags: list[StyleTagBody]) -> StylePostBody:
        return StylePostBody(
            id=row["id"],
            theme=row["theme"],
            gender=row["gender"],
            title=row["title"],
            image_url=f"/style/{row['id']}/image",
            image_tool=row["image_tool"],
            published_at=row["publish_at"].astimezone(UTC),
            tags=tags,
        )


def style_posts_of(
    request: Request, accounts: Annotated[Accounts, Depends(accounts_of)]
) -> StylePosts:
    """In the database of the accounts, on the same clock."""
    state = request.app.state
    return StylePosts(
        accounts.database, accounts.now, state.style_links, state.style_images
    )


Posts = Annotated[StylePosts, Depends(style_posts_of)]


# --- The endpoints ---


def style_routes() -> APIRouter:
    router = APIRouter(tags=["style"], responses=ACCOUNT_ERRORS)
    by_address = RateLimiter(MAX_COUNTS_PER_HOUR, HOUR_S)

    def counted(request: Request) -> bool:
        address = request.client.host if request.client else "unknown"
        return by_address.wait_s(address) == 0

    @router.get("/style")
    def list_style(
        posts: Posts,
        theme: Theme | None = None,
        gender: Gender | None = None,
        before: Annotated[str | None, Query(pattern=ID_PATTERN)] = None,
        limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    ) -> StylePageBody:
        return posts.page(theme, gender, before, limit)

    @router.get("/style/{post_id}", responses={404: {"model": ErrorBody}})
    def get_style(post_id: str, posts: Posts) -> StylePostBody:
        return posts.one(post_id)

    @router.get(
        "/style/{post_id}/image",
        response_class=Response,
        responses={200: {"content": {"image/jpeg": {}}}, 404: {"model": ErrorBody}},
    )
    def get_style_image(post_id: str, posts: Posts) -> Response:
        return Response(
            posts.image(post_id),
            media_type="image/jpeg",
            headers={"Cache-Control": CACHE_CONTROL},
        )

    @router.post(
        "/style/tags/{tag_id}/open",
        status_code=204,
        responses={404: {"model": ErrorBody}},
    )
    def open_tag(tag_id: int, posts: Posts, request: Request) -> Response:
        if counted(request):
            posts.count(tag_id, "opens")
        else:
            posts.shown_tag(tag_id)
        return Response(status_code=204)

    @router.post("/style/tags/{tag_id}/shop", responses={404: {"model": ErrorBody}})
    def shop_tag(tag_id: int, posts: Posts, request: Request) -> StyleShopBody:
        if counted(request):
            return StyleShopBody(url=posts.count(tag_id, "shops"))
        return StyleShopBody(url=posts.shown_tag(tag_id))

    return router


def install_style_posts(
    app: FastAPI,
    links: StyleLinks | None = None,
    images: Path = DEFAULT_IMAGE_DIR,
) -> None:
    """MuW Style; after install_accounts, which sets the database and the
    errors. The Awin ids from the environment unless given."""
    app.state.style_links = links if links is not None else StyleLinks.from_env()
    app.state.style_images = images
    app.include_router(style_routes())
