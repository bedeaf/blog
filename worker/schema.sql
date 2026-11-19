CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(slug, status, created_at);

CREATE TABLE IF NOT EXISTS views (
  slug TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS view_hits (
  key TEXT PRIMARY KEY,
  day INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_view_hits_day ON view_hits(day);
