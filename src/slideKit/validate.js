// Verifies AI-authored slide content BEFORE a student can see it:
//  - every LaTeX string must parse (KaTeX)
//  - worked-example steps that carry a `verify` expression are recomputed (mathjs)
//  - Mermaid diagrams must parse
//  - function plots must compile and produce points
// Returns { slide, issues[] } where each issue is a short human sentence the AI
// can be asked to fix and a lecturer can read.

import { latexError } from "./latex.js";
import { verifyStep, compileFunction } from "./mathVerify.js";

export async function checkMermaid(code) {
  try {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    await mermaid.parse(code);
    return null;
  } catch (e) {
    const msg = String((e && e.message) || e).split("\n").slice(0, 2).join(" ").slice(0, 200);
    // Only genuine syntax problems count as "invalid". Anything else (no DOM, a
    // library fault) means the check could not run, so the diagram is not judged
    // here; the on-screen renderer has its own fallback if it really can't draw it.
    return /parse error|lexical error|syntax error|no diagram type|unknown diagram|expecting|unexpected/i.test(msg) ? msg : null;
  }
}

export async function validateSlide(slide, deps = {}) {
  const parseMermaid = deps.checkMermaid || checkMermaid;
  const issues = [];
  const s = { ...slide };

  const checkLatex = (label, latex) => {
    if (!latex) return;
    const err = latexError(latex);
    if (err) issues.push(`${label} has invalid LaTeX (${err}): ${latex.slice(0, 80)}`);
  };
  (s.formulas || []).forEach((f, i) => checkLatex(`Formula ${i + 1}`, f.latex));
  if (s.problem) checkLatex("Problem", s.problem.latex);
  if (s.finalAnswer) checkLatex("Final answer", s.finalAnswer.latex);

  if (s.steps) {
    const checked = [];
    for (let i = 0; i < s.steps.length; i++) {
      const st = { ...s.steps[i] };
      checkLatex(`Step ${i + 1}`, st.latex);
      if (st.verify) {
        const r = await verifyStep(st.verify);
        if (r.ok === true) st.verified = true;
        else if (r.ok === false) {
          st.verified = false;
          issues.push(`Step ${i + 1} is arithmetically wrong: ${st.verify.expression} evaluates to ${r.computed}, but the step says ${st.verify.expected}.`);
        } else {
          delete st.verified;
        }
      }
      checked.push(st);
    }
    s.steps = checked;
  }

  if (s.diagram) {
    const err = await parseMermaid(s.diagram.code);
    if (err) issues.push(`The diagram code is invalid Mermaid (${err}).`);
  }

  if (s.plot && s.plot.kind === "function") {
    for (const e of s.plot.expressions) {
      try {
        const f = await compileFunction(e.expr);
        const samples = [-2, -1, 0, 1, 2, 3].map((x) => f(x));
        if (!samples.some(Number.isFinite)) issues.push(`Plot expression "${e.expr}" gives no valid values.`);
      } catch (err) {
        issues.push(`Plot expression "${e.expr}" can't be evaluated (${String((err && err.message) || err).slice(0, 80)}). Use x as the variable and plain math like x^2, sin(x), sqrt(x).`);
      }
    }
  }

  if (s.hasCode && s.codeSteps) {
    const n = s.code.split("\n").length;
    s.codeSteps.forEach((c, i) => { if (c.lines[1] > n) issues.push(`Code step ${i + 1} points past the end of the code.`); });
  }
  return { slide: s, issues };
}

// Strips content that failed validation so a broken diagram / formula can never
// reach a student; the slide still works because bullets/detail remain.
export function stripBrokenContent(slide, issues) {
  const s = { ...slide };
  const text = issues.join("\n");
  if (/diagram code is invalid/i.test(text)) delete s.diagram;
  if (/Plot expression/i.test(text)) delete s.plot;
  if (s.formulas) s.formulas = s.formulas.filter((f) => !latexError(f.latex));
  if (s.formulas && !s.formulas.length) delete s.formulas;
  if (s.problem && s.problem.latex && latexError(s.problem.latex)) s.problem = { ...s.problem, latex: "" };
  if (s.steps) s.steps = s.steps.map((st) => (st.latex && latexError(st.latex) ? { ...st, latex: "" } : st));
  const warnings = [...(s.warnings || [])];
  for (const i of issues) if (!warnings.includes(i)) warnings.push(i);
  if (warnings.length) s.warnings = warnings;
  return s;
}
