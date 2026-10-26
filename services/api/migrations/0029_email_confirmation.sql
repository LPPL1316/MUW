-- The confirmed email of an account and the address it is moving to
-- (TASK-300, ADR-0261, docs/DATABASE.md). A migration already in main is
-- never edited: write the next one.

ALTER TABLE users
    -- Whether the owner opened the link of the email sent to the address
    -- it has now. False for the accounts of before too (the user's choice:
    -- they are not confirmed, and get no email for it on their own).
    ADD COLUMN email_confirmed boolean NOT NULL DEFAULT false,
    -- The address asked for in «Settings», which the account gets only
    -- once its link is opened; none while nothing is asked. Not unique:
    -- the first to confirm it has it.
    ADD COLUMN pending_email text;
