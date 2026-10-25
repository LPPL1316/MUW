-- The email of the notices: once a day, what happened to an account with
-- «Email notifications» on (TASK-262 part B, ADR-0226, docs/DATABASE.md).
-- A migration already in main is never edited: write the next one.

-- One row per event, kept only for an account with the switch on, until
-- the day's email takes it. The event itself is read again when the email
-- is written: what is not true any more is left out.
CREATE TABLE email_notices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    actor_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind text NOT NULL
        CHECK (kind IN ('follow_request', 'follow_accepted', 'reaction',
                        'comment', 'tag')),
    -- The drawing of a reaction, a comment, a tag; the comment itself.
    drawing_id uuid REFERENCES drawings (id) ON DELETE CASCADE,
    comment_id uuid REFERENCES comments (id) ON DELETE CASCADE,
    at timestamptz NOT NULL,
    CHECK ((kind IN ('follow_request', 'follow_accepted')) = (drawing_id IS NULL)),
    CHECK ((kind = 'comment') = (comment_id IS NOT NULL)),
    -- The same event once: a reaction changed, a request asked again.
    UNIQUE NULLS NOT DISTINCT (recipient_id, actor_id, kind, drawing_id, comment_id)
);
CREATE INDEX email_notices_actor_idx ON email_notices (actor_id);

-- The day of the last email of the notices: one a day at most, even with
-- two rounds at once or after a restart.
ALTER TABLE users
    ADD COLUMN notices_emailed_at timestamptz;
