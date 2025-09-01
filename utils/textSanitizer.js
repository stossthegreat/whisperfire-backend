// utils/textSanitizer.js
function fixMojibake(s = '') {
  return String(s)
    .replace(/â€¢/g, '•')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€˜/g, "'")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\x9d/g, '"')
    .replace(/Â/g, '');
}

function stripMarkdownNoise(s = '') {
  let out = String(s);

  // remove emphasis markers but keep content
  out = out.replace(/\*\*(.*?)\*\*/g, '$1');
  out = out.replace(/\*(.*?)\*/g, '$1');
  out = out.replace(/__(.*?)__/g, '$1');
  out = out.replace(/_(.*?)_/g, '$1');

  // normalize bullets at start of line
  out = out.replace(/^[ \t]*[-*][ \t]+/gm, '• ');

  // collapse blockquotes
  out = out.replace(/^[ \t]*>[ \t]?/gm, '');

  // normalize dashes and ellipsis
  out = out.replace(/\u2013|\u2014/g, '—').replace(/\.{3,}/g, '…');

  // normalize newlines
  out = out.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');

  // trim trailing whitespace before newlines
  out = out.replace(/[ \t]+\n/g, '\n');

  return out.trim();
}

function sanitizeText(s = '') {
  return stripMarkdownNoise(fixMojibake(s));
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

// Safe for Server-Sent Events (remove stray newlines in one chunk)
function sanitizeForSSEChunk(s = '') {
  return sanitizeText(s).replace(/\u0000/g, '').replace(/\r/g, '');
}

module.exports = { sanitizeText, sanitizeDeep, sanitizeForSSEChunk, fixMojibake, stripMarkdownNoise };
