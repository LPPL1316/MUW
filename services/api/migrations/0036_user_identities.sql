-- The Apple and Google accounts that open a MuW account (TASK-322,
-- ADR-0282, docs/DATABASE.md). A migration already in main is never
-- edited: write the next one.

-- One row for each Apple or Google account that signed in. `subject`: the
-- id the provider gives it (`sub` of its token), which never changes.
-- `email`: the address the provider guaranteed at the last sign-in.
-- `apple_refresh_token`: Apple's token of the first sign-in, kept only to
-- tell Apple when the account is deleted (DELETE /me); NULL for Google, and
-- for Apple when the exchange of the code failed. `users` does not change:
-- an account made this way has a random password nobody knows.
CREATE TABLE user_identities (
    provider text NOT NULL CHECK (provider IN ('apple', 'google')),
    subject text NOT NULL,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email text NOT NULL,
    apple_refresh_token text,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (provider, subject)
);
-- The identities of an account, read when it is deleted.
CREATE INDEX user_identities_user_idx ON user_identities (user_id);
