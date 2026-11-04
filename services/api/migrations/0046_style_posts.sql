-- MuW Style (TASK-384, ADR-0326, docs/STYLE.md, docs/DATABASE.md): posts of
-- MuW with a photo made with AI and dots that open a product with «Shop».
-- Apart from drawings and GET /feed: no run, no account, no times. A
-- migration already in main is never edited: write the next one.

-- One post, loaded with style_import.py once the user approved it. Shown
-- from publish_at, until hidden_at: a post is hidden, never deleted, so its
-- counts stay. The photo is a file under data/media/style, never in here.
CREATE TABLE style_posts (
    id text PRIMARY KEY CHECK (id ~ '^MS-[0-9]{3,5}$'),
    theme text NOT NULL
        CHECK (theme IN ('running', 'trail', 'bike', 'gym', 'athleisure')),
    gender text NOT NULL CHECK (gender IN ('women', 'men')),
    -- The title in the five languages of the app, as style_import.py checks.
    title jsonb NOT NULL,
    image text NOT NULL CHECK (image ~ '^MS-[0-9]{3,5}\.jpg$'),
    -- What made the photo (ADR-0326: Google Imagen / Gemini).
    image_tool text NOT NULL CHECK (length(image_tool) BETWEEN 1 AND 80),
    publish_at timestamptz NOT NULL,
    hidden_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX style_posts_shown ON style_posts (publish_at DESC, id DESC)
    WHERE hidden_at IS NULL;

-- A dot on the photo: where it is (0–1 from the top left), the product and
-- the shop's page. The page is the shop's own; the affiliate link is made
-- from it when «Shop» is touched (style_links.py). A product sold out is
-- active = false, and its dot is not shown.
CREATE TABLE post_product_tags (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id text NOT NULL REFERENCES style_posts (id) ON DELETE CASCADE,
    x double precision NOT NULL CHECK (x >= 0 AND x <= 1),
    y double precision NOT NULL CHECK (y >= 0 AND y <= 1),
    item text NOT NULL CHECK (length(item) BETWEEN 1 AND 40),
    brand text NOT NULL CHECK (length(brand) BETWEEN 1 AND 80),
    product_name text NOT NULL CHECK (length(product_name) BETWEEN 1 AND 200),
    price_eur numeric(8, 2) CHECK (price_eur > 0),
    price_seen_at timestamptz,
    retailer text NOT NULL CHECK (retailer IN ('zalando', 'amazon', 'decathlon')),
    url text NOT NULL CHECK (url ~ '^https://' AND length(url) <= 1000),
    checked_at timestamptz,
    active boolean NOT NULL DEFAULT true
);
CREATE INDEX post_product_tags_post ON post_product_tags (post_id);

-- How many times a product was opened and «Shop» touched, per day. Nothing
-- of who: no account, no address, no phone (ADR-0326 point 3).
CREATE TABLE product_tag_clicks (
    tag_id bigint NOT NULL REFERENCES post_product_tags (id) ON DELETE CASCADE,
    day date NOT NULL,
    opens integer NOT NULL DEFAULT 0 CHECK (opens >= 0),
    shops integer NOT NULL DEFAULT 0 CHECK (shops >= 0),
    PRIMARY KEY (tag_id, day)
);
