-- The email sent to a member who has not opened the app for two weeks
-- (TASK-284, ADR-0244, docs/DATABASE.md). A migration already in main is
-- never edited: write the next one.

ALTER TABLE users
    -- «Email when I'm away» of «Settings»: on for every account, those of
    -- before too (the user's choice: every member), until its owner turns
    -- it off in «Settings», at sign-up or with the link of the email.
    ADD COLUMN notify_away boolean NOT NULL DEFAULT true,
    -- When the last of these emails was sent: none again before the app is
    -- used after it.
    ADD COLUMN away_emailed_at timestamptz,
    -- The language of the app at sign-up, for the texts of the emails;
    -- absent for the accounts of before, and then the phone's or English.
    ADD COLUMN language text CHECK (language IN ('en', 'de', 'it', 'es', 'fr'));
