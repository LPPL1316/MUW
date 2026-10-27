-- What the members write from «Send feedback» in «Settings» (TASK-308,
-- ADR-0268, docs/API.md, «Feedback», docs/DATABASE.md). A migration
-- already in main is never edited: write the next one.

-- One row per message. No endpoint reads them: each one is emailed to
-- whoever runs MuW (feedback.py). The app's version and the phone's system
-- when the app says them. Deleting the account deletes its messages.
CREATE TABLE feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text text NOT NULL,
    app_version text,
    platform text CHECK (platform IN ('ios', 'android')),
    created_at timestamptz NOT NULL
);

-- The messages of one account in the last day, for the limit.
CREATE INDEX feedback_user_idx ON feedback (user_id, created_at);
