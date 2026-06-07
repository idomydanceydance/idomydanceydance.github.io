/* =============================================================
   js/theme.js
   Theme toggle — shared across every page on all 3 domains.

   How icon paths work:
   - On theeliteiswe.github.io the icons live at /icons/
   - On theeliteiswe.vercel.app the icons liv at /icons/
   - On blog.nkosikhonadlamini.xyz the icons are served from
     the same repo (gh) so they also live at /icons/
   Using absolute paths from root so this works regardless of
   how deep in the directory tree the HTML file is.
   ============================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'nd-theme';
  const ICON_ROOT   = '/icons/';     /* served from repo root on both domains */

  const html   = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const icon   = document.getElementById('theme-icon');

  /* Resolve stored or system preference */
  function prefersDark() {
    return window.matchMedia &&
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function savedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) { /* noop */ }
    updateIcon(theme);
  }

  function updateIcon(theme) {
    if (!icon) return;
    const dark = theme === 'dark';
    icon.src = ICON_ROOT + (dark ? 'sun.svg' : 'moon.svg');
    icon.alt = dark ? 'Switch to day mode' : 'Switch to night mode';
  }

  /* Init: apply theme before first paint to avoid flash */
  const initial = savedTheme() || (prefersDark() ? 'dark' : 'light');
  setTheme(initial);

  /* Toggle on click */
  if (toggle) {
    toggle.addEventListener('click', function () {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  /* Sync across tabs */
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && e.newValue) {
      setTheme(e.newValue);
    }
  });
})();

