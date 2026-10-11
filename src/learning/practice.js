// Revision practice for one concept: a few multiple-choice questions, generated from the lecture
// material that taught the concept (so they match what was actually covered), validated and shuffled.

import { parseJsonLoose } from "../slideKit/json.js";
import { normalizeCheck, slideToPlainContext } from "../slideKit/schema.js";
import { conceptsMatch } from "./adaptation.js";

// The text of the slides that teach this concept (max 3), so questions stay faithful to the lecture.
export function groundingFor(concept, slides, limit = 3500) {
  const hits = (slides || []).filter((s) => (s.concepts || []).some((c) => conceptsMatch(c, concept))).slice(0, 3);
  return hits.map((s) => slideToPlainContext(s)).join("\n\n").slice(0, limit);
}

export function buildPracticePrompt({ concept, grounding, count = 4 }) {
  const system = `You are an expert university tutor writing revision questions. Return ONLY valid JSON, no markdown fences, no commentary. LaTeX backslashes inside JSON strings must be doubled. Spoken-style explanations must not contain LaTeX.`;
  const prompt = `Write ${count} multiple-choice revision questions that test understanding of the concept "${concept}".

${grounding ? `Base the questions ONLY on facts consistent with this lecture material (do not contradict it, and do not test things it does not cover):\n\n${grounding}\n` : "Use standard, well-established facts about this concept."}
Return JSON exactly like: {"questions":[{"question": string, "options": [exactly 4 short strings], "answer": number (0-based index of the single correct option; vary it), "explanation": string (1-2 sentences: why it is right and what the most tempting wrong option gets wrong), "concept": "${concept}"}]}

Rules: each question tests understanding, not wording; wrong options are plausible and reflect real misconceptions; start easier and get harder; double-check that the marked answer is truly correct.`;
  return { system, prompt };
}

// Move the correct answer around so it isn't always where the model happened to put it.
export function shuffleCheck(check, rng = Math.random) {
  const idx = check.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const options = idx.map((i) => check.options[i]);
  return { ...check, options, answer: idx.indexOf(check.answer) };
}

export function parsePracticeQuestions(raw, concept, { count = 4, rng = Math.random } = {}) {
  const data = parseJsonLoose(raw);
  const list = Array.isArray(data.questions) ? data.questions : [];
  return list
    .map((q) => normalizeCheck(q, concept))
    .filter(Boolean)
    .map((q) => shuffleCheck({ ...q, concept }, rng)) // the concept is always the one being practised, whatever the model wrote
    .slice(0, count);
}

export async function generatePractice({ concept, slides, callAI, count = 4, rng = Math.random }) {
  const { system, prompt } = buildPracticePrompt({ concept, grounding: groundingFor(concept, slides), count });
  let best = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw;
    try {
      raw = await callAI(system, prompt, 2500);
    } catch (e) {
      if (attempt === 1) throw e; // a real outage keeps its own message ("the AI is busy...")
      continue;
    }
    let qs = [];
    try {
      qs = parsePracticeQuestions(raw, concept, { count, rng });
    } catch (e) {
      qs = []; // unreadable output counts as "no questions", handled below with a friendly message
    }
    if (qs.length > best.length) best = qs;
    if (best.length >= Math.min(3, count)) break;
  }
  if (best.length < 2) throw new Error("Couldn't make good practice questions just now. Please try again in a moment.");
  return best;
}
