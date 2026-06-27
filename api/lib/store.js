import { createClient } from '@libsql/client';

const BLOB_PATH = 'blog-comments.json';

function storageNotConfigured() {
  const err = new Error(
    'Comments storage is not configured. Add a Vercel Blob store to this project, or set LIBSQL_URL for Turso.'
  );
  err.code = 'STORAGE_NOT_CONFIGURED';
  return err;
}

function useBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function useLibsqlStorage() {
  return Boolean(process.env.LIBSQL_URL);
}

function getLibsqlClient() {
  const url = process.env.LIBSQL_URL;
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  return authToken
    ? createClient({ url, authToken })
    : createClient({ url });
}

let libsqlClient;
let libsqlInitialized = false;

async function initLibsql() {
  if (libsqlInitialized) return libsqlClient;

  libsqlClient = getLibsqlClient();
  await libsqlClient.execute(`
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
  await libsqlClient.execute(`
    CREATE INDEX IF NOT EXISTS idx_comments_post_verified
    ON comments (post_slug, verified, created_at)
  `);

  libsqlInitialized = true;
  return libsqlClient;
}

async function getLocalLibsqlClient() {
  if (libsqlInitialized) return libsqlClient;

  libsqlClient = createClient({ url: 'file:data/comments.db' });
  await initLibsqlTables(libsqlClient);
  libsqlInitialized = true;
  return libsqlClient;
}

async function initLibsqlTables(db) {
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
}

async function readBlobStore() {
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
  if (blobs.length === 0) {
    return { comments: [], nextId: 1 };
  }

  const response = await fetch(blobs[0].url);
  if (!response.ok) {
    throw new Error('Failed to read comments store.');
  }

  const data = await response.json();
  return {
    comments: Array.isArray(data.comments) ? data.comments : [],
    nextId: Number.isInteger(data.nextId) ? data.nextId : 1,
  };
}

async function writeBlobStore(data) {
  const { put } = await import('@vercel/blob');
  await put(BLOB_PATH, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function resolveBackend() {
  if (useBlobStorage()) return 'blob';
  if (useLibsqlStorage()) return 'libsql';
  if (!process.env.VERCEL) return 'local';
  throw storageNotConfigured();
}

export async function listVerifiedComments(postSlug) {
  const backend = resolveBackend();

  if (backend === 'blob') {
    const store = await readBlobStore();
    return store.comments
      .filter((comment) => comment.post_slug === postSlug && comment.verified === 1)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(({ id, author_name, body, created_at }) => ({ id, author_name, body, created_at }));
  }

  const db = backend === 'local' ? await getLocalLibsqlClient() : await initLibsql();
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
  const backend = resolveBackend();

  if (backend === 'blob') {
    const store = await readBlobStore();
    const createdAt = new Date().toISOString();
    store.comments.push({
      id: store.nextId,
      post_slug: postSlug,
      author_name: authorName,
      author_email: authorEmail.toLowerCase().trim(),
      body,
      verified: 0,
      verification_token: token,
      created_at: createdAt,
      verified_at: null,
    });
    store.nextId += 1;
    await writeBlobStore(store);
    return;
  }

  const db = backend === 'local' ? await getLocalLibsqlClient() : await initLibsql();
  await db.execute({
    sql: `
      INSERT INTO comments (post_slug, author_name, author_email, body, verification_token)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [postSlug, authorName, authorEmail.toLowerCase().trim(), body, token],
  });
}

export async function verifyComment(token) {
  const backend = resolveBackend();

  if (backend === 'blob') {
    const store = await readBlobStore();
    const comment = store.comments.find((entry) => entry.verification_token === token);

    if (!comment) {
      return { ok: false, reason: 'not_found' };
    }

    if (comment.verified === 1) {
      return { ok: true, already: true };
    }

    comment.verified = 1;
    comment.verified_at = new Date().toISOString();
    await writeBlobStore(store);
    return { ok: true, already: false };
  }

  const db = backend === 'local' ? await getLocalLibsqlClient() : await initLibsql();
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
