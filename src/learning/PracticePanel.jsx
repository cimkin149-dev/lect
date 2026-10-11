import React, { useState } from "react";
import CheckCard from "../slideKit/CheckCard.jsx";
import { newCheckState, chooseOption, finishCheck } from "../slideKit/checkFlow.js";

// Revision practice: one question at a time, with the same pick -> how sure -> feedback flow as in lectures.
// Every answer is reported through onAnswer, so practice also feeds the student's mastery estimate.
export default function PracticePanel({ concept, questions, onAnswer, onClose }) {
  const [i, setI] = useState(0);
  const [state, setState] = useState(() => newCheckState(0, questions[0], performance.now()));
  const [score, setScore] = useState(0);
  const done = i >= questions.length;

  const choose = (k) => setState((s) => chooseOption(s, k, performance.now()));
  const confirm = (confidence) => {
    setState((s) => {
      const r = finishCheck(s, confidence);
      if (!r.event) return s;
      if (r.outcome.correct) setScore((n) => n + 1);
      onAnswer && onAnswer(r.event, i);
      return r.state;
    });
  };
  const next = () => {
    const n = i + 1;
    setI(n);
    if (n < questions.length) setState(newCheckState(n, questions[n], performance.now()));
  };

  if (done) {
    return (
      <section className="account-panel" aria-live="polite">
        <h2 className="account-title">Practice finished: {concept}</h2>
        <p className="account-text">You got {score} of {questions.length} right. {score === questions.length ? "Excellent." : score >= questions.length / 2 ? "Good progress. A little more practice will firm this up." : "This one still needs work. Revisit the slide and try again later."}</p>
        <div className="account-actions"><button className="nav-btn" onClick={onClose}>Back to my learning</button></div>
      </section>
    );
  }
  return (
    <section className="account-panel" aria-label={`Practice: ${concept}`}>
      <h2 className="account-title">Practice: {concept} <span className="mastery-note">question {i + 1} of {questions.length} · AI-written revision questions</span></h2>
      <CheckCard state={state} onChoose={choose} onConfidence={confirm} onSkip={onClose} />
      {state.phase === "feedback" && (
        <div className="account-actions"><button className="nav-btn" onClick={next}>{i + 1 < questions.length ? "Next question" : "See my result"}</button></div>
      )}
    </section>
  );
}
