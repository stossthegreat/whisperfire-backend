// utils/textSanitizer.js
// Mojibake killer + bullet normalizer + paragraph spacing (safe for JSON & SSE)

function fixMojibake(s = '') {
  return String(s)
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ|â€ś|â€ž/g, '"')
    .replace(/â€\x9d|â€ť/g, '"')
    .replace(/â€”|â€“/g, '—')
    .replace(/â€˘|â€¢/g, '•')
    .replace(/Â+/g, '')
    .replace(/Ã—/g, '×')
    .replace(/\uFFFD/g, '')
    .replace(/\u0000/g, '');
}

function stripMarkdownNoise(s = '') {
  let out = String(s);
  out = out.replace(/\*\*(.*?)\*\*/g, '$1')
           .replace(/\*(.*?)\*/g, '$1')
           .replace(/__(.*?)__/g, '$1')
           .replace(/_(.*?)_/g, '$1');
  out = out.replace(/^[ \t]*>[ \t]?/gm, '');
  out = out.replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ''));
  return out;
}

function normalizeBullets(s = '') {
  // Convert "- " or "* " bullets to "• "
  return String(s).replace(/^[ \t]*[-*][ \t]+/gm, '• ');
}

function ensureSentenceSpacing(s = '') {
  return String(s).replace(/([\.!?”"])([A-Za-z])/g, '$1 $2');
}

function normalizeWhitespace(s = '') {
  let out = String(s).replace(/\r\n?/g, '\n');
  out = out.replace(/[ \t]+\n/g, '\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

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

function sanitizeForSSEChunk(s = '') {
  return fixMojibake(String(s)).replace(/\r/g, '');
}

module.exports = {
  sanitizeText,
  sanitizeDeep,
  sanitizeForSSEChunk,
  fixMojibake
};
