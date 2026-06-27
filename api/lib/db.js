import { createClient } from '@libsql/client';
import { randomBytes } from 'crypto';

let client;

function getClient() {
  if (client) return client;

  const url = process.env.LIBSQL_URL || 'file:data/comments.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;

  client = authToken
    ? createClient({ url, authToken })
    : createClient({ url });

  return client;
}

let initialized = false;

export async function initDb() {
  if (initialized) return getClient();

  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_slug TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      body TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at TEXT
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_comments_post_verified
    ON comments (post_slug, verified, created_at)
  `);

  initialized = true;
  return db;
}

export function createToken() {
  return randomBytes(32).toString('hex');
}

export async function listVerifiedComments(postSlug) {
  const db = await initDb();
  const result = await db.execute({
    sql: `
      SELECT id, author_name, body, created_at
      FROM comments
      WHERE post_slug = ? AND verified = 1
      ORDER BY datetime(created_at) ASC
    `,
    args: [postSlug],
  });
  return result.rows;
}

export async function insertPendingComment({ postSlug, authorName, authorEmail, body, token }) {
  const db = await initDb();
  await db.execute({
    sql: `
      INSERT INTO comments (post_slug, author_name, author_email, body, verification_token)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [postSlug, authorName, authorEmail.toLowerCase().trim(), body, token],
  });
}

export async function verifyComment(token) {
  const db = await initDb();
  const existing = await db.execute({
    sql: `SELECT id, verified FROM comments WHERE verification_token = ?`,
    args: [token],
  });

  if (existing.rows.length === 0) {
    return { ok: false, reason: 'not_found' };
  }

  if (existing.rows[0].verified === 1) {
    return { ok: true, already: true };
  }

  await db.execute({
    sql: `
      UPDATE comments
      SET verified = 1, verified_at = datetime('now')
      WHERE verification_token = ?
    `,
    args: [token],
  });

  return { ok: true, already: false };
}
