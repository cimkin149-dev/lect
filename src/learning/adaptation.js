// Adaptive lecturing: how should the AI lecturer teach THIS slide to THIS student, right now?
//
// Principles (each is enforced by tests):
//  - Adaptation only changes HOW something is explained (pace, simplicity, a reminder). It never skips a
//    slide, never removes a quiz question and never changes how the student is assessed.
//  - It is explainable: every adaptation carries a plain-language reason the student can read.
//  - It is under the student's control: with personalisation off, nothing is adapted.
//  - It is evidence-based and cautious: history needs >= 2 answers to count, "brisk" needs >= 3 and strong,
//    and anything the student struggled with a moment ago (this session) outweighs older history.
//  - Nothing personal is sent to the AI: the prompt contains instructions, never names or scores.

import { tokens } from "../slideKit/focus.js";

// "for loops" ~ "loops": every word of the shorter name appears in the longer one.
export function conceptsMatch(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase() && !!String(a || "").trim();
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

export function findLearnerConcept(mastery, name) {
  let best = null;
  for (const m of mastery || []) {
    if (conceptsMatch(m.concept, name) && (!best || m.n > best.n)) best = m;
  }
  return best;
}

const emptySession = () => ({ wrongConcepts: new Set(), lostSlides: new Set(), reminded: new Set() });
export { emptySession };

export function planForSlide({ slide, slideIndex, mastery, session, enabled = true }) {
  const standard = { level: "standard", reminder: null, reason: null, concept: null, applied: false };
  if (!enabled || !slide) return standard;
  const ses = session || emptySession();
  const states = (slide.concepts || []).map((name) => ({ name, entry: findLearnerConcept(mastery, name) }));

  const wrongNow = states.find((s) => [...ses.wrongConcepts].some((w) => conceptsMatch(w, s.name)));
  const lostNow = ses.lostSlides.has(slideIndex) || ses.lostSlides.has(slideIndex - 1);
  const weak = states.find((s) => s.entry && s.entry.n >= 2 && s.entry.level === "weak");
  const slipping = states.find((s) => s.entry && s.entry.n >= 2 && s.entry.trend === "slipping");

  // a prerequisite the student has found hard (and we haven't already reminded them of this session)
  let reminder = null;
  let lowest = Infinity;
  for (const name of slide.prerequisites || []) {
    const e = findLearnerConcept(mastery, name);
    if (!e || e.n < 2 || ![...ses.reminded].every((r) => !conceptsMatch(r, name))) continue;
    if ((e.level === "weak" || (e.level === "developing" && e.trend === "slipping")) && e.mastery < lowest) {
      lowest = e.mastery;
      reminder = name;
    }
  }

  let level = "standard";
  let reason = null;
  let concept = null;
  if (wrongNow) {
    level = "simplify"; concept = wrongNow.name;
    reason = `You missed a question on "${wrongNow.name}" a moment ago, so I'll go step by step.`;
  } else if (lostNow) {
    level = "simplify";
    reason = "You said you were lost, so I'll take this part slowly and simply.";
  } else if (slipping) {
    // checked before "weak": a student who WAS doing well and is now failing should hear "you knew this better before"
    level = "simplify"; concept = slipping.name;
    reason = `You knew "${slipping.name}" better before, so I'll go over it carefully.`;
  } else if (weak) {
    level = "simplify"; concept = weak.name;
    reason = `"${weak.name}" has been tricky for you, so I'll take it a bit slower, with an example.`;
  } else if (states.length && states.every((s) => s.entry && s.entry.level === "strong" && s.entry.n >= 3) && !reminder) {
    level = "brisk"; concept = states[0].name;
    reason = `You already know "${states[0].name}" well, so I'll keep this short.`;
  }
  if (reminder && level === "standard") reason = `Quick reminder of "${reminder}" first, since this builds on it.`;
  else if (reminder) reason += ` I'll also remind you of "${reminder}" first.`;
  return { level, reminder, reason, concept, applied: level !== "standard" || !!reminder };
}

// Instructions appended to the explanation prompt. No names, no scores: only how to teach.
export function adaptationPrompt(plan) {
  if (!plan || !plan.applied) return "";
  const parts = [];
  if (plan.reminder) parts.push(`Begin with a single, clear sentence reminding the students of "${plan.reminder}", which this slide builds on, then continue.`);
  if (plan.level === "simplify") {
    parts.push("This student is finding these ideas difficult. Use short sentences, define each technical term the first time you use it, give ONE concrete everyday example, go one small step at a time, and avoid jargon. Keep the length about the same.");
  } else if (plan.level === "brisk") {
    parts.push("This student already understands this well. Be concise: cover the main points in about half the usual words, do not repeat basics, and add one deeper insight or a common pitfall.");
  }
  return ` ${parts.join(" ")}`;
}

export function adaptWordBudget(plan, base) {
  if (plan && plan.level === "brisk") return Math.max(40, Math.round(base * 0.6));
  return base;
}

// Short label for the small "adapted for you" note beside the slide controls.
export function adaptationLabel(plan) {
  if (!plan || !plan.applied) return null;
  const text = plan.level === "simplify" ? "Going step by step" : plan.level === "brisk" ? "Keeping this short" : `Reminder of "${plan.reminder}"`;
  return { text, reason: plan.reason };
}

// What a student can explicitly ask for, in their own words (also logged as data about what helps).
export const EXPLAIN_REQUESTS = {
  example: { label: "Give me another example", ask: "Could you give me a different example of this one?" },
  steps: { label: "Go step by step", ask: "Could you walk me through this step by step?" },
  deeper: { label: "Go deeper", ask: "Could you go a bit deeper on this, with a more advanced point?" },
  why: { label: "Why does this matter?", ask: "Why does this matter, and where would I use it?" },
};
