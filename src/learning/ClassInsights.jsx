import React from "react";

const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 100)}%`);

// Class-level understanding by concept (from quiz answers).
export function ConceptTable({ concepts }) {
  if (!concepts || !concepts.length) return null;
  return (
    <div className="sk-table-wrap">
      <table className="sk-table" style={{ fontSize: 12.5 }}>
        <thead>
          <tr><th scope="col">Concept</th><th scope="col">Answers</th><th scope="col">Correct</th><th scope="col">Very sure but wrong</th></tr>
        </thead>
        <tbody>
          {concepts.map((c) => {
            const level = c.answers < 3 ? "unknown" : c.correctRate < 0.5 ? "hot" : c.correctRate < 0.7 ? "warm" : "cool";
            return (
              <tr key={c.concept}>
                <th scope="row">{c.concept}</th>
                <td>{c.answers}</td>
                <td><span className={`heat heat-${level}`}>{c.answers < 3 ? "too few answers" : pct(c.correctRate)}</span></td>
                <td>{c.answers >= 3 ? pct(c.confidentWrongRate) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// The wrong answers students choose most: each one is a named misconception.
export function MisconceptionList({ items, slideTitle }) {
  if (!items || !items.length) return null;
  return (
    <ul className="misconception-list">
      {items.map((m, i) => (
        <li key={i}>
          <strong>Slide {m.slideIndex + 1}{slideTitle ? ` “${slideTitle(m.slideIndex)}”` : ""}</strong>
          {m.concept ? <span className="sk-type-chip" style={{ marginLeft: 6 }}>{m.concept}</span> : null}
          <div>
            {m.count} students chose <em>“{m.wrongText}”</em> ({Math.round(m.shareOfWrong * 100)}% of the wrong answers)
            {m.confidentCount > 0 ? <span className="misconception-sure"> — {m.confidentCount} of them were “very sure”, so this is a firmly held mistake worth addressing</span> : null}.
          </div>
        </li>
      ))}
    </ul>
  );
}
