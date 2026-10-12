// ------------------------------------------------------------
// MOCK AI summaries for "ramble" questions (Who is it for, etc.).
// Replace summariseAnswer with a real API call later; the screen
// doesn't need to change.
//
// This mock can't really understand text. It tidies what they wrote
// (spacing, capitals, full stops) and returns all of it, so we can
// test how the screen feels with real-length answers. It ignores most
// feedback, except asking for it "shorter".
//
// Rule for the real version: only use what they said. Never add
// facts, numbers or claims they didn't give us.
// ------------------------------------------------------------

const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

// Tidy spacing, split into sentences, capitalise each one
function sentencesOf(raw) {
  const tidy = String(raw ?? '').replace(/\s+/g, ' ').trim();
  const found = tidy.match(/[^.!?]+[.!?]*/g) ?? [tidy];
  return found.map((s) => s.trim()).filter(Boolean).map(cap);
}

function polish(text) {
  const t = text.trim().replace(/^(e\.g\.|eg)\s*/i, '');
  if (!t) return '';
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

// questionId: which question ('audience' for now)
// raw:        everything they wrote
// options.attempt:  0 for the first try, 1+ for later tries
// options.feedback: what they asked us to change ('' if nothing)
// Resolves to the summary text after a short fake delay.
export function summariseAnswer(questionId, raw, { feedback = '' } = {}) {
  const sentences = sentencesOf(raw);
  const wantsShorter = /short|brief|less|cut/i.test(feedback);

  // The whole answer, tidied. "Make it shorter" keeps the first two sentences.
  const summary = polish((wantsShorter ? sentences.slice(0, 2) : sentences).join(' '));

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!summary) reject(new Error('Nothing to summarise'));
      else resolve(summary);
    }, 1200);
  });
}