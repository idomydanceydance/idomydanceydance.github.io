(function () {
  const section = document.getElementById('comments');
  if (!section) return;

  const postSlug = section.dataset.postSlug;
  const apiBase = section.dataset.apiBase || '/api/comments';
  const listEl = document.getElementById('comments-list');
  const emptyEl = document.getElementById('comments-empty');
  const form = document.getElementById('comment-form');
  const statusEl = document.getElementById('comment-status');

  const DB_NAME = 'blog-comments-cache';
  const DB_VERSION = 1;
  const STORE = 'comments';

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function cacheGet(key) {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async function cacheSet(key, value) {
    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* cache is optional */
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function renderComments(comments) {
    listEl.innerHTML = '';

    if (!comments.length) {
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    comments.forEach((comment) => {
      const item = document.createElement('li');
      item.innerHTML = `
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(comment.author_name)}</span>
          <time class="comment-date" datetime="${escapeHtml(comment.created_at)}">${formatDate(comment.created_at)}</time>
        </div>
        <p class="comment-body">${escapeHtml(comment.body)}</p>
      `;
      listEl.appendChild(item);
    });
  }

  async function loadComments() {
    const cacheKey = `post:${postSlug}`;
    const cached = await cacheGet(cacheKey);
    if (cached) renderComments(cached);

    try {
      const response = await fetch(`${apiBase}?post=${encodeURIComponent(postSlug)}`);
      if (!response.ok) throw new Error('Failed to load comments');
      const data = await response.json();
      const comments = data.comments || [];
      renderComments(comments);
      await cacheSet(cacheKey, comments);
    } catch {
      if (!cached) {
        emptyEl.textContent = 'Comments are unavailable right now. Try again later.';
        emptyEl.hidden = false;
      }
    }
  }

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `comment-status ${type || ''}`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const formData = new FormData(form);
    const payload = {
      postSlug,
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      body: String(formData.get('body') || '').trim(),
    };

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not submit comment.');
      }

      form.reset();
      setStatus(data.message, 'success');
    } catch (err) {
      setStatus(err.message || 'Could not submit comment.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  loadComments();
})();
