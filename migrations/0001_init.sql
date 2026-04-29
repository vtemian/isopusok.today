-- isopusok.today initial schema.
-- One row per vote. identity_hash = HMAC_SHA256(SALT, ip || ":" || fingerprint).

CREATE TABLE votes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  verdict         INTEGER NOT NULL CHECK (verdict IN (0, 1)),
  identity_hash   TEXT NOT NULL,
  ua_family       TEXT
);

CREATE INDEX idx_votes_ts        ON votes(ts);
CREATE INDEX idx_votes_identity  ON votes(identity_hash, ts);
