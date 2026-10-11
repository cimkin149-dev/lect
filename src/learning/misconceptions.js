// Class-level understanding from the per-option breakdown of quiz answers.
// No AI needed: the most-chosen WRONG option on a question is the misconception,
// and "very sure" wrong answers are the strongest signal of a firmly held mistake.

const num = (v) => Number(v) || 0;

export function summarizeBreakdown(rows) {
  const bySlide = new Map();
  const byConcept = new Map();
  for (const r of rows || []) {
    const idx = num(r.slide_index);
    const answers = num(r.answers);
    const confident = num(r.confident_answers);
    const correct = r.correct === true || r.correct === "true";
    if (!bySlide.has(idx)) bySlide.set(idx, { slideIndex: idx, concept: r.concept || "", total: 0, correct: 0, options: [] });
    const s = bySlide.get(idx);
    s.total += answers;
    if (correct) s.correct += answers;
    s.options.push({ text: r.option_text || "(no text)", correct, answers, confident });
    if (!s.concept && r.concept) s.concept = r.concept;
    const cname = r.concept || "(untagged)";
    if (!byConcept.has(cname)) byConcept.set(cname, { concept: cname, answers: 0, correct: 0, confidentWrong: 0 });
    const c = byConcept.get(cname);
    c.answers += answers;
    if (correct) c.correct += answers;
    else c.confidentWrong += confident;
  }
  const concepts = [...byConcept.values()]
    .map((c) => ({ ...c, correctRate: c.answers ? c.correct / c.answers : null, confidentWrongRate: c.answers ? c.confidentWrong / c.answers : 0 }))
    .sort((a, b) => (a.correctRate ?? 2) - (b.correctRate ?? 2));
  return { bySlide, concepts };
}

// -> [{ slideIndex, concept, wrongText, count, shareOfWrong, confidentCount }] biggest first
export function commonMisconceptions(summary, { minCount = 2 } = {}) {
  const out = [];
  for (const s of summary.bySlide.values()) {
    const wrong = s.options.filter((o) => !o.correct);
    const totalWrong = wrong.reduce((n, o) => n + o.answers, 0);
    if (!totalWrong) continue;
    for (const o of wrong) {
      if (o.answers < minCount) continue;
      out.push({ slideIndex: s.slideIndex, concept: s.concept, wrongText: o.text, count: o.answers, shareOfWrong: o.answers / totalWrong, confidentCount: o.confident });
    }
  }
  return out.sort((a, b) => b.count - a.count || b.confidentCount - a.confidentCount);
}

export function weakConcepts(summary, { minAnswers = 3, below = 0.6 } = {}) {
  return summary.concepts.filter((c) => c.answers >= minAnswers && c.correctRate !== null && c.correctRate < below);
}
