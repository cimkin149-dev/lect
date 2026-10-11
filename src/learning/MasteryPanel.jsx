import React from "react";

const LEVEL_LABEL = { strong: "Strong", developing: "Getting there", weak: "Needs work", building: "Building" };
const TREND_LABEL = { improving: "↗ improving", slipping: "↘ slipping", steady: "" };

// The student's own view: what they have mastered, what to revise, and how well their confidence matches reality.
export default function MasteryPanel({ mastery, revise, calibration }) {
  if (!mastery || !mastery.length) {
    return <p className="account-text">Answer the quick quiz questions in lectures (while signed in) and your strengths will appear here.</p>;
  }
  return (
    <div>
      {revise && revise.length > 0 && (
        <div className="sk-warnings" role="note" style={{ borderColor: "rgba(232,163,61,0.55)", background: "rgba(232,163,61,0.08)", color: "#F5D9A4" }}>
          <strong>Worth revising first</strong>
          <ul style={{ color: "#F5D9A4" }}>
            {revise.map((c) => <li key={c.concept} style={{ color: "#F5D9A4" }}>{c.concept}{c.trend === "slipping" ? " (was better before)" : ""}</li>)}
          </ul>
        </div>
      )}
      <ul className="mastery-list">
        {mastery.map((c) => (
          <li key={c.concept} className="mastery-row">
            <div className="mastery-head">
              <span className="mastery-name">{c.concept}</span>
              <span className={`mastery-tag ${c.level}`}>{LEVEL_LABEL[c.level]}</span>
              {TREND_LABEL[c.trend] ? <span className="mastery-trend">{TREND_LABEL[c.trend]}</span> : null}
            </div>
            <div className="mastery-bar" role="img" aria-label={`${c.concept}: ${c.level === "building" ? "not enough answers yet" : Math.round(c.mastery * 100) + " percent"}`}>
              <div className={`mastery-fill ${c.level}`} style={{ width: `${c.level === "building" ? 8 : Math.round(c.mastery * 100)}%` }} />
            </div>
            <div className="mastery-note">{c.n} answer{c.n === 1 ? "" : "s"}{c.level === "building" ? " so far, keep going" : ""}</div>
          </li>
        ))}
      </ul>
      {calibration && calibration.level === "overconfident" && (
        <p className="account-text">You were “very sure” and wrong {Math.round(calibration.rate * 100)}% of the time. When you feel very sure, it's worth double-checking: those are the mistakes that stick.</p>
      )}
      {calibration && calibration.level === "well-calibrated" && (
        <p className="account-text">When you say you're “very sure”, you're usually right. Your sense of what you know is reliable.</p>
      )}
    </div>
  );
}
