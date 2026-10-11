// "The lecturer teaches the AI": lecturer-approved answers to earlier flagged
// questions are offered to the AI lecturer when a student asks something similar,
// so the same gap is never answered unsurely twice.

import { tokens } from "../slideKit/focus.js";

// Request-wording that says nothing about the TOPIC ("can you explain...", "what does it mean...").
const REQUEST_WORDS = new Set(["explain", "describ", "tell", "show", "giv", "mean", "pleas", "help", "understand", "confus", "simpler", "again", "exampl", "detail", "briefly"]);
const topicTokens = (text) => tokens(text).filter((t) => !REQUEST_WORDS.has(t));

export function pickCorrections(question, corrections, k = 3) {
  const q = new Set(topicTokens(question));
  if (!q.size) return [];
  const scored = [];
  for (const c of corrections || []) {
    const a = new Set(topicTokens(c.approved_question));
    if (!a.size) continue;
    let overlap = 0;
    for (const t of q) if (a.has(t)) overlap += 1;
    const shorter = Math.min(q.size, a.size);
    // Short questions must match COMPLETELY (every word of the shorter side): sharing one common word such as
    // "Java" must never pull in an unrelated approved answer. Longer ones need substantial overlap.
    const ok = shorter <= 2 ? overlap === shorter : overlap >= 2 && overlap / shorter >= 0.6;
    if (ok) scored.push({ c, score: overlap / shorter + overlap * 0.01 });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, k).map((x) => x.c);
}

export function correctionsPromptBlock(picked) {
  if (!picked || !picked.length) return "";
  const lines = picked.map((c, i) => `${i + 1}. Question: ${c.approved_question}\n   Lecturer's approved answer: ${c.lecturer_answer}`).join("\n");
  return `\n\nThe course lecturer has personally approved these answers to earlier student questions. If the student's question is essentially the same as one of them, base your answer on the lecturer's approved answer (put it in your own natural spoken words, and treat your confidence as high):\n${lines}`;
}
