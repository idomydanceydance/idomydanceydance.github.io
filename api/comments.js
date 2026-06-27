import { createToken, insertPendingComment, listVerifiedComments } from './lib/db.js';
import { sendVerificationEmail } from './lib/email.js';
import { json, readJson, siteOrigin } from './lib/http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, siteOrigin(req));
      const postSlug = url.searchParams.get('post');

      if (!postSlug) {
        json(res, 400, { error: 'Missing post slug.' });
        return;
      }

      const comments = await listVerifiedComments(postSlug);
      json(res, 200, { comments });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const postSlug = String(body.postSlug || '').trim();
      const authorName = String(body.name || '').trim();
      const authorEmail = String(body.email || '').trim();
      const commentBody = String(body.body || '').trim();

      if (!postSlug || !authorName || !authorEmail || !commentBody) {
        json(res, 400, { error: 'Name, email, comment, and post are required.' });
        return;
      }

      if (authorName.length > 80) {
        json(res, 400, { error: 'Name is too long.' });
        return;
      }

      if (!EMAIL_RE.test(authorEmail)) {
        json(res, 400, { error: 'Enter a valid email address.' });
        return;
      }

      if (commentBody.length > 4000) {
        json(res, 400, { error: 'Comment is too long (max 4000 characters).' });
        return;
      }

      const token = createToken();
      await insertPendingComment({
        postSlug,
        authorName,
        authorEmail,
        body: commentBody,
        token,
      });

      const verifyUrl = `${siteOrigin(req)}/api/verify?token=${token}`;
      const emailResult = await sendVerificationEmail({
        to: authorEmail,
        name: authorName,
        verifyUrl,
      });

      json(res, 201, {
        ok: true,
        message: emailResult.sent
          ? 'Check your inbox for a verification link. Your comment will appear once verified.'
          : 'Comment saved. Verification email could not be sent — please try again later.',
      });
      return;
    }

    json(res, 405, { error: 'Method not allowed.' });
  } catch (err) {
    console.error('[comments]', err);
    json(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
