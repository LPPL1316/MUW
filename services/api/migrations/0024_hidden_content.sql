-- Content hidden by whoever runs MuW, from the link of a report's email
-- (TASK-291, ADR-0251, docs/DATABASE.md). A migration already in main is
-- never edited: write the next one.

-- When a drawing, a comment or a whole member was hidden; NULL when shown.
-- Hidden from the others only: its author still sees it as before. A
-- hidden member is kept apart from everyone, as across a block
-- (follows.apart_sql): profile, search, drawings, comments, reactions.
ALTER TABLE drawings ADD COLUMN hidden_at timestamptz;
ALTER TABLE comments ADD COLUMN hidden_at timestamptz;
ALTER TABLE users ADD COLUMN hidden_at timestamptz;

-- The links of the emails already used: each acts once. `nonce` is the
-- random id inside the signed link; a link expires after a week, so a row
-- older than that can go.
CREATE TABLE report_links_used (
    nonce uuid PRIMARY KEY,
    used_at timestamptz NOT NULL
);
