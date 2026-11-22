'use strict';
const fs = require('fs');
const path = require('path');

const SUPPORTED = ['en', 'fr'];
const DEFAULT_LANG = 'en';
const LOCALE_DIR = path.join(__dirname, '..', '..', 'locales');

const cache = new Map();

async function loadLocale(lang) {
  if (!cache.has(lang)) {
    const text = await fs.promises.readFile(path.join(LOCALE_DIR, `${lang}.json`), 'utf8');
    cache.set(lang, JSON.parse(text));
  }
  return cache.get(lang);
}

// Missing, repeated or unsupported ?lang= values fall back to English.
function pickLanguage(value) {
  if (typeof value !== 'string') return DEFAULT_LANG;
  const code = value.trim().toLowerCase().split('-')[0];
  return SUPPORTED.includes(code) ? code : DEFAULT_LANG;
}

function escapeHtml(text) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, (char) => replacements[char]);
}

function renderPage(t, lang, today) {
  const answers = Array.isArray(t.answers) ? t.answers : [];

  const questions = t.questions
    .map(
      (question, index) => `
      <div class="question">
        <label for="q${index + 1}"><span class="number">${index + 1}</span>${escapeHtml(question)}</label>
        <textarea id="q${index + 1}" name="q${index + 1}" rows="6" placeholder="${escapeHtml(t.placeholder)}">${escapeHtml(answers[index] || '')}</textarea>
      </div>`
    )
    .join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t.title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #fafaf7; --text: #16181d; --muted: #5d6470; --line: #d6d9df; --accent: #0b6e4f; --on-accent: #ffffff; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14171c; --text: #f1f2f4; --muted: #a3a9b3; --line: #2c323b; --accent: #5fd0a5; --on-accent: #0b1b15; }
  }
  body { margin: 0; background: var(--bg); color: var(--text); font: 22px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 820px; margin: 0 auto; padding: 96px 32px 160px; }
  nav { display: flex; gap: 24px; font-size: 20px; margin-bottom: 72px; }
  nav a { color: var(--muted); text-decoration: none; padding-bottom: 4px; }
  nav a[aria-current="true"] { color: var(--text); border-bottom: 2px solid var(--accent); }
  .date { color: var(--muted); font-size: 20px; margin: 0 0 16px; }
  h1 { font-size: 52px; line-height: 1.15; margin: 0 0 28px; font-weight: 650; }
  .instructions { color: var(--muted); margin: 0 0 80px; }
  .question { margin-bottom: 64px; }
  label { display: block; font-size: 26px; line-height: 1.4; margin-bottom: 20px; }
  .number { display: inline-block; min-width: 44px; color: var(--accent); font-weight: 700; }
  textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 20px; line-height: 1.7; padding: 24px; color: var(--text);
             background: transparent; border: 2px solid var(--line); border-radius: 14px; resize: vertical; overflow: hidden; }
  textarea:focus { outline: none; border-color: var(--accent); }
  button { font: inherit; font-weight: 600; padding: 20px 44px; border: 0; border-radius: 999px; cursor: pointer;
           background: var(--accent); color: var(--on-accent); }
  .thanks { font-size: 28px; margin-top: 48px; color: var(--accent); }
</style>
</head>
<body>
<main>
  <nav aria-label="Language">
    <a href="/feedback?lang=en"${lang === 'en' ? ' aria-current="true"' : ''}>English</a>
    <a href="/feedback?lang=fr"${lang === 'fr' ? ' aria-current="true"' : ''}>Fran&ccedil;ais</a>
  </nav>
  <p class="date">${escapeHtml(today)}</p>
  <h1>${escapeHtml(t.title)}</h1>
  <p class="instructions">${escapeHtml(t.instructions)}</p>
  <form id="feedback" data-thanks="${escapeHtml(t.thanks)}">${questions}
    <button type="submit">${escapeHtml(t.submit)}</button>
  </form>
  <p id="thanks" class="thanks" role="status" hidden></p>
</main>
<script>
  document.querySelectorAll('textarea').forEach(function (box) {
    function fit() {
      box.style.height = 'auto';
      box.style.height = box.scrollHeight + 'px';
    }
    box.addEventListener('input', fit);
    fit();
  });

  document.getElementById('feedback').addEventListener('submit', function (event) {
    event.preventDefault();
    var note = document.getElementById('thanks');
    note.textContent = this.dataset.thanks;
    note.hidden = false;
  });
</script>
</body>
</html>`;
}

// GET /feedback: picks the language, loads its locale file and sends the page.
async function page(req, res, next) {
  try {
    const lang = pickLanguage(req.query.lang);
    const t = await loadLocale(lang);
    const today = new Intl.DateTimeFormat(lang, { dateStyle: 'full' }).format(new Date());
    res.type('html').send(renderPage(t, lang, today));
  } catch (err) {
    next(err);
  }
}

module.exports = { page };