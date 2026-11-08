import { randomUUID } from "crypto";
import { getDb, Agent, Channel, Thread, Post } from "./db";

const DEFAULT_ORG_ID = "org_demo";
const DEFAULT_ORG_NAME = "Demo Co";

export function ensureDemoOrg() {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM orgs WHERE id = ?").get(DEFAULT_ORG_ID);
  if (!existing) {
    db.prepare("INSERT INTO orgs (id, name) VALUES (?, ?)").run(DEFAULT_ORG_ID, DEFAULT_ORG_NAME);
  }
  return DEFAULT_ORG_ID;
}

export function getOrCreateAgent(displayName: string, ownerHuman: string, role?: string): Agent {
  const db = getDb();
  const orgId = ensureDemoOrg();
  const existing = db
    .prepare("SELECT * FROM agents WHERE org_id = ? AND display_name = ? AND owner_human = ?")
    .get(orgId, displayName, ownerHuman) as Agent | undefined;
  if (existing) return existing;
  const id = randomUUID();
  db.prepare(
    "INSERT INTO agents (id, org_id, display_name, owner_human, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, orgId, displayName, ownerHuman, role ?? null);
  return { id, org_id: orgId, display_name: displayName, owner_human: ownerHuman, role: role ?? null };
}

export function getOrCreateChannel(slug: string, name?: string): Channel {
  const db = getDb();
  const orgId = ensureDemoOrg();
  const existing = db
    .prepare("SELECT * FROM channels WHERE org_id = ? AND slug = ?")
    .get(orgId, slug) as Channel | undefined;
  if (existing) return existing;
  const id = randomUUID();
  db.prepare("INSERT INTO channels (id, org_id, slug, name) VALUES (?, ?, ?, ?)").run(
    id,
    orgId,
    slug,
    name ?? slug
  );
  return { id, org_id: orgId, slug, name: name ?? slug };
}

export function listChannels(): Channel[] {
  const db = getDb();
  const orgId = ensureDemoOrg();
  return db.prepare("SELECT * FROM channels WHERE org_id = ? ORDER BY name").all(orgId) as Channel[];
}

export function listThreads(channelSlug?: string): (Thread & { channel_slug: string; channel_name: string; post_count: number })[] {
  const db = getDb();
  const orgId = ensureDemoOrg();
  if (channelSlug) {
    return db
      .prepare(
        `SELECT t.*, c.slug as channel_slug, c.name as channel_name,
                (SELECT COUNT(*) FROM posts p WHERE p.thread_id = t.id) as post_count
         FROM threads t JOIN channels c ON c.id = t.channel_id
         WHERE t.org_id = ? AND c.slug = ?
         ORDER BY t.created_at DESC`
      )
      .all(orgId, channelSlug) as any;
  }
  return db
    .prepare(
      `SELECT t.*, c.slug as channel_slug, c.name as channel_name,
              (SELECT COUNT(*) FROM posts p WHERE p.thread_id = t.id) as post_count
       FROM threads t JOIN channels c ON c.id = t.channel_id
       WHERE t.org_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(orgId) as any;
}

export function createThread(opts: {
  channelSlug: string;
  channelName?: string;
  title: string;
  needed_by?: string | null;
}): Thread {
  const db = getDb();
  const orgId = ensureDemoOrg();
  const channel = getOrCreateChannel(opts.channelSlug, opts.channelName);
  const id = randomUUID();
  db.prepare(
    "INSERT INTO threads (id, org_id, channel_id, title, status, needed_by) VALUES (?, ?, ?, ?, 'open', ?)"
  ).run(id, orgId, channel.id, opts.title, opts.needed_by ?? null);
  return db.prepare("SELECT * FROM threads WHERE id = ?").get(id) as Thread;
}

export function addPost(opts: {
  threadId: string;
  type: "finding" | "question" | "answer" | "comment";
  authorAgentId?: string | null;
  authorHuman?: string | null;
  body: string;
  sources?: string[];
  supersedesPostId?: string | null;
  resolveThread?: boolean;
}): Post {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO posts (id, thread_id, type, author_agent_id, author_human, body, sources, supersedes_post_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    opts.threadId,
    opts.type,
    opts.authorAgentId ?? null,
    opts.authorHuman ?? null,
    opts.body,
    JSON.stringify(opts.sources ?? []),
    opts.supersedesPostId ?? null
  );
  if (opts.resolveThread) {
    db.prepare("UPDATE threads SET status = 'resolved' WHERE id = ?").run(opts.threadId);
  }
  return db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post;
}

export function getThread(threadId: string): {
  thread: Thread & { channel_slug: string; channel_name: string };
  posts: (Post & { author_display: string })[];
} | null {
  const db = getDb();
  const thread = db
    .prepare(
      `SELECT t.*, c.slug as channel_slug, c.name as channel_name
       FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?`
    )
    .get(threadId) as any;
  if (!thread) return null;
  const posts = db
    .prepare(
      `SELECT p.*, COALESCE(a.display_name, p.author_human, 'unknown') as author_display
       FROM posts p LEFT JOIN agents a ON a.id = p.author_agent_id
       WHERE p.thread_id = ? ORDER BY p.created_at ASC`
    )
    .all(threadId) as any;
  return { thread, posts };
}

export type SearchResult = {
  thread_id: string;
  thread_title: string;
  channel_slug: string;
  channel_name: string;
  thread_status: string;
  post_id: string;
  snippet: string;
  post_type: string;
  author_display: string;
  created_at: string;
};

export function searchBoard(query: string, channelSlug?: string, limit = 10): SearchResult[] {
  const db = getDb();
  const orgId = ensureDemoOrg();
  const ftsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `${t.replace(/[^a-zA-Z0-9]/g, "")}*`)
    .filter(Boolean)
    .join(" OR ");
  if (!ftsQuery) return [];
  const rows = db
    .prepare(
      `SELECT p.id as post_id, p.type as post_type, p.created_at,
              t.id as thread_id, t.title as thread_title, t.status as thread_status,
              c.slug as channel_slug, c.name as channel_name,
              COALESCE(a.display_name, p.author_human, 'unknown') as author_display,
              snippet(posts_fts, 0, '[', ']', '...', 20) as snippet
       FROM posts_fts
       JOIN posts p ON p.rowid = posts_fts.rowid
       JOIN threads t ON t.id = p.thread_id
       JOIN channels c ON c.id = t.channel_id
       LEFT JOIN agents a ON a.id = p.author_agent_id
       WHERE posts_fts MATCH ? AND t.org_id = ? ${channelSlug ? "AND c.slug = ?" : ""}
       ORDER BY p.created_at DESC
       LIMIT ?`
    )
    .all(...(channelSlug ? [ftsQuery, orgId, channelSlug, limit] : [ftsQuery, orgId, limit])) as any;
  return rows;
}

export function listOpenQuestions(): (Thread & { channel_slug: string; channel_name: string })[] {
  const db = getDb();
  const orgId = ensureDemoOrg();
  return db
    .prepare(
      `SELECT t.*, c.slug as channel_slug, c.name as channel_name
       FROM threads t JOIN channels c ON c.id = t.channel_id
       WHERE t.org_id = ? AND t.status = 'open'
         AND (SELECT p.type FROM posts p WHERE p.thread_id = t.id ORDER BY p.created_at ASC LIMIT 1) = 'question'
       ORDER BY t.needed_by IS NULL, t.needed_by ASC`
    )
    .all(orgId) as any;
}
