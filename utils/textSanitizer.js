// utils/textSanitizer.js
// Mojibake killer + spacing normalizer + bullet normalizer (safe for JSON & SSE)

function fixMojibake(s = '') {
  return String(s)
    // windows-1252 mojibake -> UTF-8
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ|â€ś|â€ž/g, '"')
    .replace(/â€\x9d|â€ť/g, '"')
    .replace(/â€”|â€“/g, '—')
    .replace(/â€˘|â€¢/g, '•')
    .replace(/Â/g, '')
    .replace(/Ã—/g, '×')
    .replace(/\uFFFD/g, '')  // replacement char
    .replace(/\u0000/g, '');
}

function stripMarkdownNoise(s = '') {
  let out = String(s);
  // strip markdown emphasis, keep text
  out = out.replace(/\*\*(.*?)\*\*/g, '$1')
           .replace(/\*(.*?)\*/g, '$1')
           .replace(/__(.*?)__/g, '$1')
           .replace(/_(.*?)_/g, '$1');
  // remove blockquotes
  out = out.replace(/^[ \t]*>[ \t]?/gm, '');
  // un-fence code blocks (models sometimes dump ```…```)
  out = out.replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ''));
  return out;
}

function normalizeBullets(s = '') {
  // Convert "- " or "* " list items into "• "
  return String(s).replace(/^[ \t]*[-*][ \t]+/gm, '• ');
}

function ensureSentenceSpacing(s = '') {
  // Insert a space after ., !, ?, ” if followed by a letter/quote
  return String(s).replace(/([\.!?”"])([A-Za-z])/g, '$1 $2');
}

function normalizeWhitespace(s = '') {
  let out = String(s).replace(/\r\n?/g, '\n'); // CRLF -> LF
  out = out.replace(/[ \t]+\n/g, '\n');        // trim eol spaces
  out = out.replace(/\n{3,}/g, '\n\n');        // max 2 newlines
  return out.trim();
}

// Keep bullets single-spaced; use blank lines between paragraphs
function paragraphize(s = '') {
  const lines = String(s).split('\n');
  const out = [];
  let inBullets = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (out.at(-1) !== '') out.push(''); inBullets = false; continue; }
    const isBullet = /^•\s/.test(line);
    if (isBullet) {
      if (!inBullets && out.length && out.at(-1) !== '') out.push('');
      out.push(line);
      inBullets = true;
    } else {
      if (inBullets && out.at(-1) !== '') out.push('');
      out.push(line);
      inBullets = false;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeText(s = '') {
  return paragraphize(
    normalizeWhitespace(
      ensureSentenceSpacing(
        normalizeBullets(
          stripMarkdownNoise(
            fixMojibake(s)
          )
        )
      )
    )
  );
}

function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = sanitizeDeep(value[k]);
    return out;
  }
  return value;
}

// For SSE chunks (don’t collapse newlines, only fix encoding + CRs)
function sanitizeForSSEChunk(s = '') {
  return fixMojibake(String(s)).replace(/\r/g, '');
}

module.exports = {
  fixMojibake,
  sanitizeText,
  sanitizeDeep,
  sanitizeForSSEChunk
};
