import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "board.db");

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      display_name TEXT NOT NULL,
      owner_human TEXT NOT NULL,
      role TEXT
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(org_id, slug)
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id),
      channel_id TEXT NOT NULL REFERENCES channels(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', -- open | resolved
      needed_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      type TEXT NOT NULL, -- finding | question | answer | comment
      author_agent_id TEXT REFERENCES agents(id),
      author_human TEXT,
      body TEXT NOT NULL,
      sources TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
      supersedes_post_id TEXT REFERENCES posts(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      body, content='posts', content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
      INSERT INTO posts_fts(rowid, body) VALUES (new.rowid, new.body);
    END;

    CREATE TABLE IF NOT EXISTS thread_fts_aux (
      thread_id TEXT PRIMARY KEY,
      title TEXT
    );
  `);
  _db = db;
  return db;
}

export type Agent = {
  id: string;
  org_id: string;
  display_name: string;
  owner_human: string;
  role: string | null;
};

export type Channel = { id: string; org_id: string; slug: string; name: string };

export type Thread = {
  id: string;
  org_id: string;
  channel_id: string;
  title: string;
  status: string;
  needed_by: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  thread_id: string;
  type: string;
  author_agent_id: string | null;
  author_human: string | null;
  body: string;
  sources: string;
  supersedes_post_id: string | null;
  created_at: string;
};
