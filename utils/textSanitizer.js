// utils/textSanitizer.js
// Kills the random "Â" (NBSP mis-decode), smart quotes, em-dashes, stray BOM,
// and forces clean paragraph breaks so text isn't one big blob.

const NBSP = /\u00A0/g;         // non-breaking space (often shows as "Â ")
const BOM = /^\uFEFF/;          // byte-order mark
const EM_DASH = /\u2014/g;      // —
const EN_DASH = /\u2013/g;      // –
const SMART_L = /\u2018|\u2019/g; // ‘ ’
const SMART_R = /\u201C|\u201D/g; // “ ”
const ELLIPSIS = /\u2026/g;     // …

function stripWeirdUnicode(s) {
  return String(s || '')
    .replace(BOM, '')
    .replace(NBSP, ' ')
    .replace(ELLIPSIS, '...')
    .replace(EM_DASH, '—') // keep em-dash, but normalize later if needed
    .replace(EN_DASH, '-')
    .replace(SMART_L, "'")
    .replace(SMART_R, '"');
}

/**
 * Converts double newlines and list markers into consistent paragraph breaks.
 * Ensures every sentence block is separated for readability.
 */
function normalizeParagraphs(s) {
  let t = stripWeirdUnicode(s);

  // If the model returned bullets, make sure they render as separate lines.
  t = t
    // Convert Windows newlines to \n
    .replace(/\r\n/g, '\n')
    // Collapse 3+ blank lines to exactly 2
    .replace(/\n{3,}/g, '\n\n')
    // Ensure bullet prefixes start on a new line
    .replace(/\s*[\u2022•\-]\s+/g, (m) => `\n${m.trim()} `);

  // If it's one giant line, try splitting on sentence endings for readability.
  if (!/\n/.test(t) && t.length > 220) {
    t = t.replace(/([.!?])\s+/g, '$1\n');
  }

  // Remove accidental spaces before newlines
  t = t.replace(/[ \t]+\n/g, '\n');

  // Final trim
  return t.trim();
}

/**
 * For SSE specifically: make sure there are no stray CRs or illegal control chars.
 */
function sanitizeForSSE(s) {
  // Remove characters that can break SSE framing
  return normalizeParagraphs(s)
    .replace(/\u0000/g, '')   // NUL
    .replace(/\u000B/g, '')   // VT
    .replace(/\u000C/g, '')   // FF
    .replace(/\u001C-\u001F/g, ''); // info separators
}

module.exports = {
  sanitizeForSSE,
  normalizeParagraphs
};
