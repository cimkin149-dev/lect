import React, { useState } from "react";
import "./slideKit.css";
import { Rich, MathBlock } from "./MathText.jsx";
import DiagramView from "./DiagramView.jsx";
import PlotView from "./PlotView.jsx";
import { TYPE_LABELS } from "./schema.js";

const fc = (focusId, id) => (focusId === id ? "sk-focus" : undefined);

function Bullets({ items, focusId }) {
  if (!items || !items.length) return null;
  return (
    <ul>
      {items.map((b, i) => (
        <li key={i} data-sk-block={`b:${i}`} className={fc(focusId, `b:${i}`)}><Rich text={b} /></li>
      ))}
    </ul>
  );
}

function Formulas({ formulas, focusId }) {
  if (!formulas || !formulas.length) return null;
  return (
    <div className="sk-formulas">
      {formulas.map((f, i) => (
        <div className={`sk-formula${focusId === `f:${i}` ? " sk-focus" : ""}`} key={i} data-sk-block={`f:${i}`}>
          <MathBlock latex={f.latex} />
          {f.caption && <div className="sk-caption"><Rich text={f.caption} /></div>}
        </div>
      ))}
    </div>
  );
}

function DefinitionCard({ d, focusId }) {
  return (
    <div className={`sk-def${focusId === "def" ? " sk-focus" : ""}`} data-sk-block="def">
      <div className="sk-def-term">{d.term}</div>
      <p className="sk-def-text"><Rich text={d.text} /></p>
      {d.example && (
        <div className="sk-def-example"><span className="sk-tag">Example</span> <Rich text={d.example} /></div>
      )}
    </div>
  );
}

function DataTable({ table, focusId }) {
  return (
    <div className="sk-table-wrap">
      <table className="sk-table">
        <thead><tr>{table.headers.map((h, i) => <th key={i} scope="col"><Rich text={h} /></th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} data-sk-block={`row:${i}`} className={fc(focusId, `row:${i}`)}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row"><Rich text={c} /></th> : <td key={j}><Rich text={c} /></td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkedExample({ slide, revealCount }) {
  const steps = slide.steps || [];
  const shown = Math.min(steps.length, revealCount);
  const showFinal = revealCount > steps.length && slide.finalAnswer;
  return (
    <div className="sk-worked">
      {slide.problem && (
        <div className="sk-problem">
          <span className="sk-tag">Problem</span>
          <p><Rich text={slide.problem.text} /></p>
          {slide.problem.latex && <MathBlock latex={slide.problem.latex} />}
        </div>
      )}
      <ol className="sk-steps" aria-label="Worked solution">
        {steps.slice(0, shown).map((st, i) => (
          <li key={i} className={`sk-step${i === shown - 1 && revealCount <= steps.length ? " current" : ""}`}>
            <div className="sk-step-head">
              <span className="sk-step-num">{i + 1}</span>
              <span className="sk-step-label">{st.label || `Step ${i + 1}`}</span>
              {st.verified === true && <span className="sk-badge ok" title="Recalculated by a calculator and confirmed">✓ checked</span>}
              {st.verified === false && <span className="sk-badge bad" title="Recalculation disagrees with this step">⚠ check this</span>}
            </div>
            {st.latex && <MathBlock latex={st.latex} />}
          </li>
        ))}
      </ol>
      {showFinal && (
        <div className="sk-final" role="status">
          <span className="sk-tag">Answer</span>
          {slide.finalAnswer.text && <p><Rich text={slide.finalAnswer.text} /></p>}
          {slide.finalAnswer.latex && <MathBlock latex={slide.finalAnswer.latex} />}
        </div>
      )}
    </div>
  );
}

function Summary({ slide, focusId }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sk-summary">
      {slide.takeaways && (
        <ul className="sk-takeaways">
          {slide.takeaways.map((t, i) => <li key={i} data-sk-block={`t:${i}`} className={fc(focusId, `t:${i}`)}><span className="sk-check" aria-hidden="true">✓</span><Rich text={t} /></li>)}
        </ul>
      )}
      {slide.checkQuestion && (
        <div className={`sk-checkq${focusId === "q" ? " sk-focus" : ""}`} data-sk-block="q">
          <span className="sk-tag">Quick check</span>
          <p><Rich text={slide.checkQuestion.question} /></p>
          {slide.checkQuestion.answer && (open
            ? <p className="sk-answer"><Rich text={slide.checkQuestion.answer} /></p>
            : <button className="sk-run-btn" onClick={() => setOpen(true)}>Show answer</button>)}
        </div>
      )}
    </div>
  );
}

export default function SlideView({ slide, unit, index, total, revealCount = Infinity, showWarnings = false, footer = null, focusId = null }) {
  const t = slide.type;
  const visual = slide.diagram || slide.plot;
  return (
    <div className={`slide sk-slide sk-type-${t}${focusId ? " sk-following" : ""}`}>
      <header className="sk-header">
        <div className="slide-eyebrow">
          <span>{unit}</span>
          <span>{t !== "concept" && <span className="sk-type-chip">{TYPE_LABELS[t]}</span>} {index + 1} / {total}</span>
        </div>
        <h2><Rich text={slide.title} /></h2>
      </header>

      {t === "definition" && slide.definition && <DefinitionCard d={slide.definition} focusId={focusId} />}
      {t === "comparison" && slide.table && <DataTable table={slide.table} focusId={focusId} />}
      {t === "worked_example" && slide.steps && <WorkedExample slide={slide} revealCount={revealCount} />}
      {t === "summary" ? <Summary slide={slide} focusId={focusId} /> : null}

      {visual && (
        <div className={slide.bullets && slide.bullets.length ? "sk-split" : ""}>
          <div className="sk-visual">
            {slide.diagram && <div data-sk-block="diagram" className={fc(focusId, "diagram")}><DiagramView code={slide.diagram.code} caption={slide.diagram.caption} /></div>}
            {slide.plot && <div data-sk-block="plot" className={fc(focusId, "plot")}><PlotView plot={slide.plot} /></div>}
          </div>
          {slide.bullets && slide.bullets.length > 0 && <div className="sk-side"><Bullets items={slide.bullets} focusId={focusId} /></div>}
        </div>
      )}

      {!visual && t !== "summary" && <Bullets items={slide.bullets} focusId={focusId} />}
      {t === "summary" && <Bullets items={slide.bullets} focusId={focusId} />}
      <Formulas formulas={slide.formulas} focusId={focusId} />
      {slide.detail && <p className={`slide-detail${focusId === "detail" ? " sk-focus" : ""}`} data-sk-block="detail"><Rich text={slide.detail} /></p>}
      {t === "code_walkthrough" && <div className="sk-hint">The code is shown in the editor view.</div>}
      {showWarnings && slide.warnings && slide.warnings.length > 0 && (
        <div className="sk-warnings" role="note">
          <strong>For the lecturer: please review</strong>
          <ul>{slide.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {footer}
    </div>
  );
}
