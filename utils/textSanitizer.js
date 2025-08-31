// utils/textSanitizer.js
// Kills mojibake (Â, smart quotes issues), normalizes spaces/newlines, and enforces readable paragraphs for SSE/JSON.

const REPLACERS = [
  // Common UTF-8 mojibake caused by double-encoding or cp1252 mishaps
  [/\u00C2\u00A0/g, ' '],       // Â  (non-breaking space shown as Â )
  [/\u00C2/g, ''],              // stray Â
  [/\u00A0/g, ' '],             // nbsp -> regular space

  // Smart quotes / dashes normalization
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/\u2014/g, '—'],             // em dash (ensure correct)
  [/\u2013/g, '–'],             // en dash (ensure correct)

  // Zero-width junk
  [/\u200B|\u200C|\u200D|\uFEFF/g, ''],

  // Collapse triple+ newlines to double (paragraphs), and excessive spaces
  [/\r\n/g, '\n'],
  [/\n{3,}/g, '\n\n'],
  [/ {2,}/g, ' ']
];

// Add paragraph breaks after typical section labels if they’re jammed
function addParagraphHints(s) {
  // Ensure a blank line after these markers when followed by non-empty text
  const markers = [
    'Law:', 'Principle:', 'Use:', 'Line:', 'Why:', 'Notes:', 'Insight', 'Command', 'Step '
  ];
  markers.forEach(m => {
    const re = new RegExp(`(${m}[^\\n]*)(\\n)(?!\\n)`, 'g');
    s = s.replace(re, '$1\n\n'); // force an empty line after header-ish lines
  });
  return s;
}

function sanitizeForSSE(text) {
  if (text == null) return '';
  let out = String(text);

  // Apply replacements
  for (const [re, rep] of REPLACERS) out = out.replace(re, rep);

  // Trim edges but keep paragraphing
  out = out.replace(/[ \t]+\n/g, '\n').trim();

  // Add paragraph hints for readability
  out = addParagraphHints(out);

  // Safety: prevent accidental SSE control lines
  // If a line starts with "data:" or ":" we JSON-encode anyway, but ensure no bare control frames
  out = out.replace(/^\s*data:/gm, 'data\u200A:'); // hair space disrupts control token
  out = out.replace(/^\s*:/gm, ':\u200A');         // keep comment semantics but avoid proxies misread

  return out;
}

module.exports = { sanitizeForSSE };
