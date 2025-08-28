// utils/textSanitizer.js
// Kills mojibake (Â/Ã etc), strips markdown stars, fixes bullets, preserves paragraphs.

function normalizeUnicode(s) {
  if (!s) return '';
  try { return s.normalize('NFC'); } catch { return String(s); }
}

function killMojibake(s) {
  // Common UTF-8 mis-decoding artifacts: "Â", "Ã", NBSP, BOM
  return s
    .replace(/\uFEFF/g, '')               // BOM
    .replace(/\u00A0/g, ' ')              // NBSP → normal space
    .replace(/\u00C2\u00A0/g, ' ')        // "Â " combo → space
    .replace(/\u00C2(?=[£€$©®™])/g, '')   // "Â" before currency/trademark
    .replace(/\u00C3\u00A9/g, 'é')        // common "Ã©" → é
    .replace(/\u00C3\u00A8/g, 'è')
    .replace(/\u00C3\u00AA/g, 'ê')
    .replace(/\u00C3\u00B1/g, 'ñ')
    .replace(/\u00C3\u00B6/g, 'ö')
    .replace(/\u00C3\u00BC/g, 'ü')
    .replace(/\u00C3\u00A4/g, 'ä')
    .replace(/\u00C3\u00A0/g, 'à')
    .replace(/\u00C3\u00A2/g, 'â')
    .replace(/\u00C3\u00AF/g, 'ï')
    .replace(/\u00C3\u00A7/g, 'ç')
    .replace(/\u00C2/g, '')               // any remaining lone "Â"
    .replace(/\uFFFD/g, '');              // replacement char
}

function demarkdown(s) {
  // Headings → plain lines
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // Bold/italic **text** / *text* / _text_
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,!?]|$)/g, '$1$2');
  s = s.replace(/(^|[\s(])_([^_]+?)_(?=[\s).,!?]|$)/g, '$1$2');
  // Inline code `text`
  s = s.replace(/`([^`]+)`/g, '$1');
  // Blockquotes
  s = s.replace(/^\s*>\s?/gm, '— ');
  // Lists: -, *, + → bullets
  s = s.replace(/^\s*[-*+]\s+/gm, '• ');
  // Horizontal rules → blank line
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  return s;
}

function paragraphize(raw) {
  let s = String(raw).replace(/\r\n/g, '\n');

  // Promote common sections onto their own paragraphs
  s = s.replace(/\n\s*(Law:|Line:|Principle:)/g, '\n\n$1');

  // Ensure bullets have their own lines
  s = s.replace(/(?:^|\n)\s*•\s*/g, m => `\n${m.trim()} `);

  // Collapse >2 newlines → 2
  s = s.replace(/\n{3,}/g, '\n\n');

  // Add a blank line after sentences that are followed by a capital-start line with no blank line
  s = s.replace(/([.!?])\s*\n(?!\n)/g, '$1\n\n');

  // Trim edges
  s = s.trim();

  return s;
}

function sanitizeForSSE(text) {
  let s = String(text ?? '');
  s = normalizeUnicode(s);
  s = killMojibake(s);
  s = demarkdown(s);
  s = paragraphize(s);
  return s;
}

module.exports = {
  sanitizeForSSE,
  normalizeUnicode,
  killMojibake,
  demarkdown,
  paragraphize,
};
