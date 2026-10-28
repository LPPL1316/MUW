-- Private messages between two members, with message requests (TASK-317,
-- ADR-0277, docs/DATABASE.md). A migration already in main is never
-- edited: write the next one.

-- One conversation for each pair of members, whoever wrote first: the two
-- accounts in order, the lower id first. Deleting either account deletes
-- it, with every message and both members' rows.
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    low_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    high_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    UNIQUE (low_id, high_id),
    CHECK (low_id < high_id)
);
-- The conversations of the higher id, read from its side too.
CREATE INDEX conversations_high_idx ON conversations (high_id);

-- Where each of the two stands in a conversation: two rows, made with it.
-- `accepted_at`: when this member let the other write freely (it accepted,
-- replied, wrote first, or followed the other when a message came); NULL,
-- what the other writes is a message request, one message at most.
-- `cleared_at`: the messages up to then are out of this member's view (it
-- deleted the request, or a block stood between the two). `read_at`: when
-- it last read the conversation, for the dot of the unread ones.
CREATE TABLE conversation_members (
    conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    other_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    accepted_at timestamptz,
    cleared_at timestamptz,
    read_at timestamptz,
    PRIMARY KEY (conversation_id, user_id),
    UNIQUE (user_id, other_id),
    CHECK (user_id <> other_id)
);

-- One row for each message: plain text as written, without spaces at
-- either end. Deleted by who wrote it (for both), with the conversation,
-- or once neither member sees it any more. `hidden_at`: hidden by whoever
-- runs MuW from a report's email (TASK-291, ADR-0251): who wrote it still
-- sees it, the other no longer.
CREATE TABLE messages (
    -- What DELETE /messages/{id} and a report are asked with: random.
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text text NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL,
    hidden_at timestamptz
);
-- The messages of a conversation, the latest first, a page at a time.
CREATE INDEX messages_of_conversation ON messages (conversation_id, created_at, id);
-- The messages of an account, deleted with it.
CREATE INDEX messages_of_sender ON messages (sender_id);

-- A message is reported too (TASK-317): the list of kinds of
-- 0020_moderation.sql, with 'message'.
ALTER TABLE reports DROP CONSTRAINT reports_kind_check;
ALTER TABLE reports ADD CONSTRAINT reports_kind_check
    CHECK (kind IN ('drawing', 'comment', 'user', 'message'));
