// utils/textSanitizer.js
// Purpose: remove mojibake (“Â”), smart quotes, odd bullets, BOM;
// enforce paragraphs & readable bullets; safe for JSON & SSE.

const NBSP = /\u00A0/g;          // non-breaking space (often shows as “Â ”)
const BOM = /^\uFEFF/;           // byte-order mark
const EM_DASH = /\u2014/g;       // —
const EN_DASH = /\u2013/g;       // –
const SMART_QUOTES_S = /\u2018|\u2019/g; // ‘ ’
const SMART_QUOTES_D = /\u201C|\u201D/g; // “ ”
const ELLIPSIS = /\u2026/g;      // …

function stripWeirdUnicode(s) {
  return String(s || '')
    .replace(BOM, '')
    .replace(NBSP, ' ')
    .replace(ELLIPSIS, '...')
    .replace(EM_DASH, '—')
    .replace(EN_DASH, '-')
    .replace(SMART_QUOTES_S, "'")
    .replace(SMART_QUOTES_D, '"');
}

/**
 * normalizeParagraphs:
 * - converts CRLF→LF
 * - collapses 3+ blank lines to 2
 * - ensures bullets are lined up, converts leading "*" to "•"
 * - inserts paragraph breaks if the text is one long run
 * - trims trailing spaces before newlines
 */
function normalizeParagraphs(s) {
  let t = stripWeirdUnicode(s);

  // Convert CRLF to LF
  t = t.replace(/\r\n/g, '\n');

  // Convert markdown/star bullets to real bullets at line starts
  t = t
    // " * text" or "* text" -> "• text"
    .replace(/(^|\n)\s*\*\s+/g, '$1• ')
    // "- text" at line start stays "-", but ensure line break
    .replace(/(^|\n)\s*-\s+/g, '$1- ');

  // If model returned everything on one line, split into sentences
  if (!/\n/.test(t) && t.length > 220) {
    t = t.replace(/([.!?])\s+/g, '$1\n');
  }

  // Collapse 3+ newlines to exactly 2
  t = t.replace(/\n{3,}/g, '\n\n');

  // Remove spaces/tabs before newline
  t = t.replace(/[ \t]+\n/g, '\n');

  // Ensure there’s a blank line between paragraph blocks that end with a colon
  // and the next content (common in “Law:”/“Use:” endings)
  t = t.replace(/:\n(?!\n)/g, ':\n\n');

  return t.trim();
}

function sanitizeForSSE(s) {
  // remove control chars that can break SSE
  return normalizeParagraphs(s)
    .replace(/\u0000/g, '')
    .replace(/\u000B/g, '')
    .replace(/\u000C/g, '')
    .replace(/[\u001C-\u001F]/g, '');
}

module.exports = {
  normalizeParagraphs,
  sanitizeForSSE
};
