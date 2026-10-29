-- Attachments of the private messages: a photo, a video or a drawing
-- (TASK-333, ADR-0289, docs/DATABASE.md). A migration already in main is
-- never edited: write the next one.

-- What a message carries besides its text, if anything. A drawing is a
-- copy of the route, whole (`drawing`, the body of a favorite) and as the
-- conversation shows it (`drawing_card`: its names, metres and at most 64
-- points). A photo or a video is a row of message_media. With an
-- attachment the text may be empty.
ALTER TABLE messages
    ADD COLUMN attachment text CHECK (attachment IN ('photo', 'video', 'drawing')),
    ADD COLUMN drawing jsonb,
    ADD COLUMN drawing_card jsonb;
ALTER TABLE messages ADD CONSTRAINT messages_drawing_check
    CHECK ((attachment IS NOT DISTINCT FROM 'drawing') = (drawing IS NOT NULL)
        AND (drawing IS NULL) = (drawing_card IS NULL));
ALTER TABLE messages DROP CONSTRAINT messages_text_check;
ALTER TABLE messages ADD CONSTRAINT messages_text_check
    CHECK (length(text) <= 1000 AND (length(text) >= 1 OR attachment IS NOT NULL));

-- The photos and videos sent, as files under data/media/messages named by
-- the row's id (media_files.py): never in the database, nor in its copies.
-- A row is born with the upload, without a message; sending the message
-- links it. One never linked is deleted after an hour; a video stops being
-- `stored` 30 days after its message, and its file goes. Deleting the
-- message, its conversation or either account deletes the row; the
-- hourly round removes the files no row keeps.
CREATE TABLE message_media (
    -- The file's name too: random.
    id uuid PRIMARY KEY,
    owner_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id uuid UNIQUE REFERENCES messages (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('photo', 'video')),
    -- What the file is served as: image/jpeg, video/mp4, video/quicktime.
    media_type text NOT NULL,
    bytes integer NOT NULL CHECK (bytes > 0),
    -- As shown: a video turned by its track is measured turned.
    width integer CHECK (width > 0),
    height integer CHECK (height > 0),
    duration_ms integer CHECK (duration_ms > 0),
    -- A video's first picture, a JPEG the phone made; NULL without one.
    poster_bytes integer CHECK (poster_bytes > 0),
    created_at timestamptz NOT NULL,
    stored boolean NOT NULL DEFAULT true,
    CHECK ((kind = 'video') = (duration_ms IS NOT NULL)),
    CHECK (kind = 'video' OR poster_bytes IS NULL)
);
-- An account's uploads of the last day, counted for its daily limits.
CREATE INDEX message_media_of_owner ON message_media (owner_id, kind, created_at);
-- The uploads never sent, for the hourly round.
CREATE INDEX message_media_unsent ON message_media (created_at)
    WHERE message_id IS NULL;
