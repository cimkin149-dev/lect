import React from "react";
import { Rich } from "./MathText.jsx";

// Multiple-choice comprehension check. Pick an answer, then (optionally) say how sure you were,
// then see whether it was right. Everything is recorded as events; the lecturer then speaks the explanation.
export default function CheckCard({ state, onChoose, onConfidence, onSkip }) {
  const { check, phase, chosen } = state;
  return (
    <div className="check-card" role="group" aria-label="Quick check question">
      <span className="sk-tag">Quick check</span>
      <p className="check-question"><Rich text={check.question} /></p>
      <div className="check-options">
        {check.options.map((o, i) => {
          const isCorrect = phase === "feedback" && i === check.answer;
          const isWrongChoice = phase === "feedback" && i === chosen && i !== check.answer;
          return (
            <button
              key={i}
              className={`check-option${chosen === i ? " chosen" : ""}${isCorrect ? " correct" : ""}${isWrongChoice ? " wrong" : ""}`}
              disabled={phase !== "answering"}
              onClick={() => onChoose(i)}
            >
              <span className="check-letter">{String.fromCharCode(65 + i)}</span>
              <span><Rich text={o} /></span>
              {isCorrect && <span className="check-mark" aria-label="correct answer">✓</span>}
            </button>
          );
        })}
      </div>
      {phase === "confidence" && (
        <div className="check-confidence" role="group" aria-label="How sure are you?">
          <span>How sure are you?</span>
          <button className="signal-btn" onClick={() => onConfidence("guess")}>Guessing</button>
          <button className="signal-btn" onClick={() => onConfidence("fairly")}>Fairly sure</button>
          <button className="signal-btn" onClick={() => onConfidence("sure")}>Very sure</button>
          <button className="skip-link inline" onClick={() => onConfidence(null)}>Skip</button>
        </div>
      )}
      {phase === "feedback" && (
        <p className={`check-feedback ${state.correct ? "ok" : "bad"}`} role="status">
          {state.correct ? "Correct. " : "Not quite. "}
          {check.explanation ? <Rich text={check.explanation} /> : null}
        </p>
      )}
      {phase === "answering" && <button className="skip-link inline" onClick={onSkip}>Skip this question</button>}
    </div>
  );
}

