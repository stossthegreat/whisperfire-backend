// utils/textSanitizer.js
// Make mentor text clean, ASCII-safe, and paragraphed.
// Kills mojibake (Â), NBSP, BOM, smart quotes, markdown stars, and numbered labels.
// Ensures bullets are plain ASCII dashes (`- `), and paragraphs have blank lines.

const NBSP = /\u00A0/g;      // non-breaking space
const BOM = /^\uFEFF/;       // byte-order mark
const ANY_BULLET = /[\u2022\u25CF\u25E6\u2043]/g; // • ● ◦ ⁃
const SMART_SINGLES = /[\u2018\u2019]/g;  // ‘ ’
const SMART_DOUBLES = /[\u201C\u201D]/g;  // “ ”
const ELLIPSIS = /\u2026/g;               // …
const EM_DASH = /\u2014/g;                // —
const EN_DASH = /\u2013/g;                // –

function toAscii(s) {
  return String(s || '')
    .replace(BOM, '')
    .replace(NBSP, ' ')
    .replace(ELLIPSIS, '...')
    .replace(SMART_SINGLES, "'")
    .replace(SMART_DOUBLES, '"')
    .replace(EM_DASH, '--')
    .replace(EN_DASH, '-')
    .replace(ANY_BULLET, '-');
}

function stripMarkdownDecorations(s) {
  let t = s;

  // Kill code fences/backticks/asterisk bullets/underscores used as emphasis
  t = t.replace(/```[\s\S]*?```/g, '');
  t = t.replace(/^(\s*)\*{1,3}\s+/gm, '$1- ');
  t = t.replace(/\*{2,3}([^*]+)\*{2,3}/g, '$1');
  t = t.replace(/__([^_]+)__/g, '$1');
  t = t.replace(/_([^_]+)_/g, '$1');

  // Normalize headings like "## Title" -> "Title"
  t = t.replace(/^\s*#{1,6}\s*/gm, '');

  return t;
}

function stripNumberedLabels(s) {
  // Remove leading “Insight 1: …”, “Point 2) …”, “Tip 3 - …” etc. -> just the text
  return s.replace(
    /(^|\n)\s*(Insight|Insights|Tip|Tips|Point|Points|Lesson|Law|Rule)\s*\d+\s*[:.)-]\s*/gi,
    '$1- '
  );
}

function normalizeBulletsAndParagraphs(s) {
  let t = s.replace(/\r\n/g, '\n');

  // If one giant block, split by sentence enders to create lines
  if (!/\n/.test(t) && t.length > 220) {
    t = t.replace(/([.!?])\s+/g, '$1\n');
  }

  // Ensure every bullet line starts with "- "
  t = t
    .replace(/(^|\n)\s*[•\-]\s*/g, '$1- ')   // bullet or minus -> "- "
    .replace(/(^|\n)\s*–\s*/g, '$1- ');      // en dash to "- "

  // Turn numbered list to dash bullets: "1. text" or "1) text"
  t = t.replace(/(^|\n)\s*\d+\s*[.)]\s+/g, '$1- ');

  // Collapse 3+ newlines to exactly 2
  t = t.replace(/\n{3,}/g, '\n\n');

  // Trim spaces before newline
  t = t.replace(/[ \t]+\n/g, '\n');

  // Force blank line after lines ending with ":" (for blocks like Line:, Principle:)
  t = t.replace(/:\n(?!\n)/g, ':\n\n');

  // Remove duplicate bullets created by chaining rules: "- - text" -> "- text"
  t = t.replace(/(^|\n)-\s+-\s+/g, '$1- ');

  return t.trim();
}

function sanitizeForSSE(s) {
  // Remove ASCII control chars that can break event-stream
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\u2028|\u2029/g, ' '); // JS line separators
}

function normalizeMentorText(raw) {
  let t = toAscii(raw);
  t = stripMarkdownDecorations(t);
  t = stripNumberedLabels(t);
  t = normalizeBulletsAndParagraphs(t);

  // Kill any lingering non-ASCII bullets again
  t = t.replace(ANY_BULLET, '-');

  // ASCII only, no NBSP etc.
  t = toAscii(t);

  return t;
}

module.exports = {
  normalizeMentorText,
  sanitizeForSSE
};

