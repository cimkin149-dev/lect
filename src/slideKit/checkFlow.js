// State machine for the comprehension check: answering -> confidence -> feedback.
// Pure functions so the behaviour (what gets recorded, when the answer is graded,
// what a skip means) can be tested without a browser.

export function newCheckState(index, check, now) {
  return { index, check, phase: "answering", chosen: null, correct: null, shownAt: now, timeMs: null, confidence: null };
}

export function chooseOption(state, i, now) {
  if (!state || state.phase !== "answering") return state;
  if (!Number.isInteger(i) || i < 0 || i >= state.check.options.length) return state;
  return { ...state, phase: "confidence", chosen: i, correct: i === state.check.answer, timeMs: Math.max(0, Math.round(now - state.shownAt)) };
}

// -> { state, event, outcome } ; only valid from the confidence phase
export function finishCheck(state, confidence) {
  if (!state || state.phase !== "confidence") return { state, event: null, outcome: null };
  const c = ["guess", "fairly", "sure"].includes(confidence) ? confidence : null;
  const chosenText = state.check.options[state.chosen];
  return {
    state: { ...state, phase: "feedback", confidence: c },
    event: {
      concept: state.check.concept,
      correct: state.correct,
      option: state.chosen,
      correct_option: state.check.answer,
      option_text: chosenText ? String(chosenText).slice(0, 120) : null,
      time_ms: state.timeMs,
      confidence: c,
    },
    outcome: { correct: state.correct, chosen: state.chosen, confidence: c },
  };
}

// Skipping is only possible before the answer is graded; it records WHICH phase it happened in.
export function skipCheck(state) {
  if (!state || state.phase === "feedback") return { state, event: null, outcome: null };
  return { state: null, event: { phase: state.phase }, outcome: { skipped: true } };
}

// The text the lecturer speaks after the student answers.
export function feedbackSpeech(check, correct) {
  return `${correct ? "That's right." : "Not quite."} ${check.explanation || ""}`.trim();
}
