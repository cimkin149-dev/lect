// Student model: how well does this learner understand each concept?
//
// Deliberately simple and explainable (a lecturer or student can be told exactly
// why a concept is "weak"): a Beta-Bernoulli estimate per concept.
//   - start from "no idea" (alpha = beta = 1)
//   - each quiz answer adds evidence, weighted by RECENCY (half-life 21 days, never below 15%)
//   - a correct answer given as a pure guess counts half
//   - a wrong answer given with "very sure" counts 1.5x: a confident misconception is
//     worse than an honest gap, and is the most useful thing to correct
// mastery = alpha / (alpha + beta). With fewer than 2 answers we say "building" instead of guessing.

const DAY = 86400000;

export function estimateMastery(events, now = Date.now(), { halfLifeDays = 21 } = {}) {
  const by = new Map();
  for (const e of events || []) {
    if (!e || !e.concept || typeof e.correct !== "boolean") continue;
    if (!by.has(e.concept)) by.set(e.concept, []);
    by.get(e.concept).push(e);
  }
  const out = [];
  for (const [concept, list] of by) {
    list.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    let alpha = 1, beta = 1, confidentWrong = 0, confident = 0;
    for (const e of list) {
      const ageDays = Math.max(0, (now - (e.ts || now)) / DAY);
      const w = Math.max(0.15, Math.pow(0.5, ageDays / halfLifeDays));
      if (e.confidence === "sure") confident += 1;
      if (e.correct) alpha += w * (e.confidence === "guess" ? 0.5 : 1);
      else {
        beta += w * (e.confidence === "sure" ? 1.5 : 1);
        if (e.confidence === "sure") confidentWrong += 1;
      }
    }
    const n = list.length;
    const mastery = alpha / (alpha + beta);
    const level = n < 2 ? "building" : mastery >= 0.7 ? "strong" : mastery >= 0.5 ? "developing" : "weak";
    let trend = "steady";
    if (n >= 4) {
      const recent = list.slice(-2).filter((e) => e.correct).length / 2;
      const earlier = list.slice(0, -2).filter((e) => e.correct).length / (n - 2);
      if (recent - earlier >= 0.4) trend = "improving";
      else if (recent - earlier <= -0.4) trend = "slipping";
    }
    out.push({ concept, mastery: Math.round(mastery * 100) / 100, n, level, trend, confidentWrong, confident, lastAt: list[list.length - 1].ts || null });
  }
  const order = { weak: 0, developing: 1, building: 2, strong: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level] || a.mastery - b.mastery || a.concept.localeCompare(b.concept));
}

// How well does "very sure" match being right?
export function calibration(events) {
  const sure = (events || []).filter((e) => e && e.confidence === "sure" && typeof e.correct === "boolean");
  if (sure.length < 3) return { level: "unknown", sure: sure.length, wrongWhenSure: 0, rate: null };
  const wrong = sure.filter((e) => !e.correct).length;
  const rate = wrong / sure.length;
  return { level: rate >= 0.34 ? "overconfident" : "well-calibrated", sure: sure.length, wrongWhenSure: wrong, rate: Math.round(rate * 100) / 100 };
}

// Concepts worth revisiting, most urgent first.
export function conceptsToRevise(list, k = 3) {
  return (list || []).filter((c) => (c.level === "weak" || c.level === "developing" || c.trend === "slipping") && c.n >= 2).slice(0, k);
}

// Spaced revision: when should this concept come up again? Weak ideas return sooner than strong ones.
const REVIEW_DAYS = { weak: 2, developing: 5, building: 3, strong: 14 };
export function nextReview(c, now = Date.now()) {
  const days = REVIEW_DAYS[c.level] ?? 5;
  const base = c.lastAt || now;
  const dueAt = base + days * DAY;
  return { dueAt, due: now >= dueAt, inDays: Math.max(0, Math.ceil((dueAt - now) / DAY)) };
}
