// utils/mentorFormatter.js
// Enforce preset-specific structure + tight spacing for mentor replies.

const { sanitizeText } = require('./textSanitizer');

function smartParagraphs(s) {
  const lines = s.split('\n').filter(x => x.trim() !== '');
  const out = [];
  let bucket = [];
  const flush = () => { if (bucket.length) { out.push(bucket.join(' ')); bucket = []; } };

  for (const line of lines) {
    if (/^•\s/.test(line)) { flush(); out.push(line.trim()); continue; }
    bucket.push(line.trim());
    if (/[.!?…]"?$/.test(line.trim())) flush();
  }
  flush();
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n');
}

function formatAdvise(text) {
  let t = sanitizeText(text);
  const bullets = t.match(/^•\s.+$/gm) || [];
  if (bullets.length < 3) {
    const sentences = t.replace(/^•\s.+$/gm, '')
      .split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
    const trio = sentences.slice(0, 3).map(s => `• ${s}`);
    t = (trio.join('\n') + '\n\n' + t).trim();
  }
  if (!/(^|\n)Line:\s*["“]/i.test(t)) t += `\n\nLine: "Hidden speakeasy Thu 9. Bring your curiosity."`;
  if (!/(^|\n)Principle:\s*/i.test(t)) t += `\nPrinciple: Invitation is not a question.`;
  return sanitizeText(smartParagraphs(t));
}

function formatDrill(text) {
  let t = sanitizeText(text);
  const rows = t.split('\n').map(x => x.trim()).filter(Boolean);
  const qs = rows.filter(r => /^\d+\)/.test(r));
  let out;
  if (qs.length >= 12) out = qs.slice(0, 12);
  else {
    out = [
      '1) What outcome proves you irresistible today?',
      '2) Where are you asking permission?',
      '3) What myth are you offering?',
      '4) What time, what place, your lead?',
      '5) What do they risk by saying no?',
      '6) What do you risk by waiting?',
      '7) What exact line will you send?',
      '8) What playful penalty raises tension?',
      '9) What boundary are you enforcing?',
      '10) What proof shows you have options?',
      '11) What curiosity hook are you using?',
      '12) What binary close ends dithering?'
    ];
  }
  if (!rows.some(r => /^COMMAND:/i.test(r))) out.push('', 'COMMAND: Write and send the line in 5 minutes.');
  if (!rows.some(r => /^Law:/i.test(r))) out.push('Law: Invitation is not a question.');
  return sanitizeText(out.join('\n'));
}

function formatRoleplay(text) {
  let t = sanitizeText(text);
  if (!/(^|\n)Use:\s*"/i.test(t)) t += `\n\nUse: "Victory drink tomorrow. One seat left."`;
  return sanitizeText(smartParagraphs(t));
}

function formatChat(text) {
  let t = sanitizeText(text);
  if (!/“.+”|".+"/.test(t)) t += `\n"Invitation is not a question."`;
  if (!/\?\s*$/m.test(t)) t += `\n\nSo, what do you want to risk this week?`;
  return sanitizeText(smartParagraphs(t));
}

function formatByPreset(text, preset) {
  switch (preset) {
    case 'advise':   return formatAdvise(text);
    case 'drill':    return formatDrill(text);
    case 'roleplay': return formatRoleplay(text);
    case 'chat':
    default:         return formatChat(text);
  }
}

module.exports = { formatByPreset };
