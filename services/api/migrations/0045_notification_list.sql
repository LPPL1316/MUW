-- The bell's list: what push.py told each account, kept for it to read in
-- the app (TASK-367 part C, ADR-0311, docs/DATABASE.md). A migration already
-- in main is never edited: write the next one.

-- One row for each event push.py lets through (not one's own but for its
-- own kinds, the first of the day), whatever the switches of «Settings»
-- say: the list is read in the app, not sent. Not the private messages:
-- they have their own tab. The text is written when the list is read, in
-- the account's language; what is no longer true then is left out
-- (notification_list.py). Gone after notification_list.KEPT_DAYS, with the
-- account, with the account who acted, with the drawing or the comment.
CREATE TABLE notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    actor_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (length(kind) <= 40),
    -- The drawing of a reaction, a comment, a tag; the comment itself.
    drawing_id uuid REFERENCES drawings (id) ON DELETE CASCADE,
    comment_id uuid REFERENCES comments (id) ON DELETE CASCADE,
    -- What tells two events of the same kind and people apart (push.py's
    -- PushEvent.same, and the challenge, group run or contest): the same
    -- event again takes the place of the one before.
    same text NOT NULL CHECK (length(same) <= 400),
    -- The rest of push.py's event, for its text and what the app opens: a
    -- challenge, a group run, a contest, a number, names by language.
    extra jsonb NOT NULL DEFAULT '{}',
    at timestamptz NOT NULL,
    read_at timestamptz,
    UNIQUE (recipient_id, actor_id, kind, same)
);

-- The list of an account, the newest first; the rows too old to keep; the
-- rows of an account, a drawing or a comment deleted.
CREATE INDEX notifications_recipient ON notifications (recipient_id, id DESC);
CREATE INDEX notifications_at ON notifications (at);
CREATE INDEX notifications_actor ON notifications (actor_id);
CREATE INDEX notifications_drawing ON notifications (drawing_id)
    WHERE drawing_id IS NOT NULL;
CREATE INDEX notifications_comment ON notifications (comment_id)
    WHERE comment_id IS NOT NULL;
