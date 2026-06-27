import { verifyComment } from './lib/db.js';
import { siteOrigin } from './lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Method not allowed');
    return;
  }

  try {
    const url = new URL(req.url, siteOrigin(req));
    const token = url.searchParams.get('token');

    if (!token) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage('Invalid link', 'This verification link is missing a token.'));
      return;
    }

    const result = await verifyComment(token);

    if (!result.ok) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage('Link not found', 'This verification link is invalid or has expired.'));
      return;
    }

    const message = result.already
      ? 'Your comment was already verified. Thanks for reading.'
      : 'Your email is verified and your comment is now live. Thanks for joining the conversation.';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage('Comment verified', message, true));
  } catch (err) {
    console.error('[verify]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(renderPage('Something went wrong', 'Please try again later.'));
  }
}

function renderPage(title, message, success = false) {
  const accent = success ? '#00bcd4' : '#888';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 10vh auto; padding: 0 24px; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; color: ${accent}; }
    a { color: #00bcd4; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <p><a href="/">← Back to blog</a></p>
</body>
</html>`;
}
