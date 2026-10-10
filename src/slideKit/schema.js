// Slide schema v2. Every slide, old or new, passes through normalizeSlide so the
// rest of the app can rely on one shape. Old slides ({title, bullets, detail,
// notes, hasCode, code}) normalize cleanly into type "concept" and render and
// teach exactly as before. normalizeSlide is idempotent.

import { guessLanguage, normalizeLanguage } from "./tokenizer.js";
import { repairLatexString } from "./json.js";
import { latexToPlain } from "./latex.js";

export const SLIDE_TYPES = ["concept", "definition", "comparison", "worked_example", "code_walkthrough", "diagram", "plot", "summary"];
export const TYPE_LABELS = {
  concept: "Concept", definition: "Definition", comparison: "Comparison", worked_example: "Worked example",
  code_walkthrough: "Code walkthrough", diagram: "Diagram", plot: "Plot", summary: "Summary",
};
export const LANGUAGE_LABELS = {
  java: "Java", c: "C", cpp: "C++", python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  vb: "Visual Basic", sql: "SQL", html: "HTML", css: "CSS", bash: "Shell", text: "Text",
};
const EXT = { java: "java", c: "c", cpp: "cpp", python: "py", javascript: "js", typescript: "ts", vb: "vb", sql: "sql", html: "html", css: "css", bash: "sh", text: "txt" };

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v) => repairLatexString(str(v)).trim();

function pascal(title) {
  const w = str(title).replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 4);
  return w.length ? w.map((x) => x[0].toUpperCase() + x.slice(1)).join("") : "Example";
}

function makeFilename(rawName, code, language, title) {
  let name = str(rawName).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40);
  if (name) return name;
  if (language === "java") {
    const m = /public\s+class\s+([A-Za-z_]\w*)/.exec(code);
    if (m) return `${m[1]}.java`;
  }
  return `${language === "java" ? pascal(title) : "main"}.${EXT[language] || "txt"}`;
}

function normalizeTable(t) {
  if (!t || typeof t !== "object") return null;
  const headers = arr(t.headers).map(text).filter((h) => h !== "");
  const rows = arr(t.rows).map((r) => arr(r).map(text)).filter((r) => r.length);
  if (!headers.length || !rows.length) return null;
  return { headers, rows: rows.map((r) => headers.map((_, i) => r[i] || "")) };
}

function normalizePlot(p) {
  if (!p || typeof p !== "object") return null;
  const caption = text(p.caption);
  if (p.kind === "function") {
    const exprs = arr(p.expressions).map((e) => (typeof e === "string" ? { expr: e, label: e } : { expr: str(e && e.expr).trim(), label: text(e && e.label) || str(e && e.expr).trim() })).filter((e) => e.expr).slice(0, 4);
    if (!exprs.length) return null;
    const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(+v) ? null : +v);
    return { kind: "function", expressions: exprs, xMin: num(p.xMin) ?? -10, xMax: num(p.xMax) ?? 10, yMin: num(p.yMin), yMax: num(p.yMax), caption };
  }
  if (p.kind === "bar" || p.kind === "line") {
    const labels = arr(p.labels).map(str).slice(0, 24);
    const series = arr(p.series).map((s) => ({ name: text(s && s.name), values: arr(s && s.values).map((v) => +v).filter(Number.isFinite) })).filter((s) => s.values.length).slice(0, 5);
    if (!labels.length || !series.length) return null;
    return { kind: p.kind, labels, series, caption };
  }
  return null;
}

// One multiple-choice comprehension check. Invalid checks (bad answer index, duplicate or too few options)
// are dropped rather than shown, because a wrong "correct answer" would teach students the wrong thing.
function normalizeCheck(c, fallbackConcept) {
  if (!c || typeof c !== "object") return null;
  const question = text(c.question);
  const rawOptions = arr(c.options).map(text);
  const rawAnswer = c.answer === null || c.answer === "" || c.answer === undefined ? NaN : +c.answer;
  if (!question || !Number.isInteger(rawAnswer) || rawAnswer < 0 || rawAnswer >= rawOptions.length || !rawOptions[rawAnswer]) return null;
  const correctText = rawOptions[rawAnswer];
  // drop empty and duplicate options, then find the correct option again by its text so the index can't drift
  const seen = new Set();
  const options = rawOptions.filter((o) => {
    const k = o.toLowerCase();
    if (!o || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 5);
  const answer = options.findIndex((o) => o.toLowerCase() === correctText.toLowerCase());
  if (options.length < 3 || answer < 0) return null;
  return { question, options, answer, explanation: text(c.explanation), concept: text(c.concept) || fallbackConcept || "" };
}

export function normalizeSlide(raw, index = 0) {
  const r = raw && typeof raw === "object" ? raw : {};
  const bullets = arr(r.bullets).map(text).filter(Boolean);

  const codeRaw = r.hasCode === false && r.type !== "code_walkthrough" ? "" : str(r.code);
  const hasCode = !!codeRaw.trim();
  const language = hasCode ? normalizeLanguage(r.language) || guessLanguage(codeRaw) : null;
  const lineCount = hasCode ? codeRaw.split("\n").length : 0;
  const codeSteps = hasCode
    ? arr(r.codeSteps).map((s) => {
        const a = Math.max(1, Math.min(lineCount, parseInt(s && s.lines && s.lines[0], 10) || 1));
        const b = Math.max(a, Math.min(lineCount, parseInt(s && s.lines && (s.lines[1] ?? s.lines[0]), 10) || a));
        return { lines: [a, b], say: text(s && s.say) };
      }).filter((s) => s.say)
    : [];

  const steps = arr(r.steps).map((s) => {
    const v = s && s.verify && typeof s.verify === "object" ? { expression: str(s.verify.expression).trim(), expected: str(s.verify.expected).trim() } : null;
    const out = { label: text(s && s.label), say: text(s && s.say), latex: text(s && s.latex), verify: v && v.expression && v.expected !== "" ? v : null };
    if (s && (s.verified === true || s.verified === false)) out.verified = s.verified;
    return out;
  }).filter((s) => s.say || s.latex);

  const problemRaw = r.problem;
  const problem = problemRaw ? { text: text(typeof problemRaw === "string" ? problemRaw : problemRaw.text), latex: text(problemRaw && problemRaw.latex) } : null;
  const fa = r.finalAnswer;
  const finalAnswer = fa ? { text: text(typeof fa === "string" ? fa : fa.text), latex: text(fa && fa.latex) } : null;

  const diagramCode = str(r.diagram && r.diagram.code).replace(/\r/g, "").trim();
  const dq = r.checkQuestion;

  let type = SLIDE_TYPES.includes(r.type) ? r.type : null;
  if (!type) type = steps.length ? "worked_example" : codeSteps.length ? "code_walkthrough" : diagramCode ? "diagram" : "concept";

  const slide = {
    type,
    title: text(r.title) || `Slide ${index + 1}`,
    bullets,
    detail: text(r.detail),
    notes: text(r.notes),
    hasCode,
    code: hasCode ? codeRaw.replace(/\s+$/, "") : undefined,
  };
  const set = (k, v) => { if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) slide[k] = v; };
  if (hasCode) {
    slide.language = language;
    slide.filename = makeFilename(r.filename, codeRaw, language, slide.title);
    set("codeSteps", codeSteps);
    set("introSay", text(r.introSay));
    set("expectedOutput", str(r.expectedOutput).replace(/\s+$/, ""));
  }
  set("formulas", arr(r.formulas).map((f) => ({ latex: text(f && f.latex), caption: text(f && f.caption) })).filter((f) => f.latex).slice(0, 6));
  if (type === "worked_example" || steps.length) {
    set("problem", problem && (problem.text || problem.latex) ? problem : null);
    set("problemSay", text(r.problemSay));
    set("steps", steps);
    set("finalAnswer", finalAnswer && (finalAnswer.text || finalAnswer.latex) ? finalAnswer : null);
    set("finalSay", text(r.finalSay));
  }
  if (diagramCode) slide.diagram = { code: diagramCode, caption: text(r.diagram && r.diagram.caption) };
  set("plot", normalizePlot(r.plot));
  set("table", normalizeTable(r.table));
  if (type === "definition" || r.definition) {
    const d = r.definition || {};
    if (text(d.term) || text(d.text)) slide.definition = { term: text(d.term), text: text(d.text), example: text(d.example) };
  }
  set("takeaways", arr(r.takeaways).map(text).filter(Boolean));
  if (dq && (typeof dq === "string" ? dq : dq.question)) slide.checkQuestion = { question: text(typeof dq === "string" ? dq : dq.question), answer: text(dq && dq.answer) };
  const concepts = arr(r.concepts).map(text).filter(Boolean).slice(0, 3);
  set("concepts", concepts);
  set("prerequisites", arr(r.prerequisites).map(text).filter(Boolean).slice(0, 3));
  const rawChecks = Array.isArray(r.checks) ? r.checks : r.check ? [r.check] : [];
  set("checks", rawChecks.map((c) => normalizeCheck(c, concepts[0])).filter(Boolean).slice(0, 2));
  set("warnings", arr(r.warnings).map(str).filter(Boolean));
  return slide;
}

// Plain-text rendering of everything on a slide: used to ground the lecturer's
// answers to student questions and the lecture-notes generator in what was
// actually on screen (steps, formulas, code) and not just the bullets.
export function slideToPlainContext(s) {
  const lines = [`Slide: ${s.title}`];
  if (s.bullets && s.bullets.length) lines.push("Key points: " + s.bullets.join("; "));
  if (s.detail) lines.push("Detail: " + s.detail);
  if (s.definition) lines.push(`Definition of ${s.definition.term}: ${s.definition.text}${s.definition.example ? ` Example: ${s.definition.example}` : ""}`);
  if (s.formulas) lines.push("Formulas: " + s.formulas.map((f) => `${latexToPlain(f.latex)}${f.caption ? ` (${f.caption})` : ""}`).join("; "));
  if (s.table) lines.push("Table: " + [s.table.headers.join(" | "), ...s.table.rows.map((r) => r.join(" | "))].join(" / "));
  if (s.problem) lines.push("Problem: " + [s.problem.text, s.problem.latex && latexToPlain(s.problem.latex)].filter(Boolean).join(" "));
  if (s.steps) s.steps.forEach((st, i) => lines.push(`Step ${i + 1}${st.label ? ` (${st.label})` : ""}: ${[st.say, st.latex && latexToPlain(st.latex)].filter(Boolean).join(" — ")}`));
  if (s.finalAnswer) lines.push("Final answer: " + [s.finalAnswer.text, s.finalAnswer.latex && latexToPlain(s.finalAnswer.latex)].filter(Boolean).join(" "));
  if (s.diagram) lines.push(`Diagram${s.diagram.caption ? ` (${s.diagram.caption})` : ""}:\n${s.diagram.code}`);
  if (s.plot) lines.push(`Plot: ${s.plot.kind}${s.plot.caption ? ` — ${s.plot.caption}` : ""}${s.plot.expressions ? " of " + s.plot.expressions.map((e) => e.expr).join(", ") : ""}`);
  if (s.hasCode) lines.push(`Code (${s.language}):\n${s.code}`);
  if (s.codeSteps) s.codeSteps.forEach((c, i) => lines.push(`Code step ${i + 1} (lines ${c.lines[0]}-${c.lines[1]}): ${c.say}`));
  if (s.expectedOutput) lines.push("Expected output:\n" + s.expectedOutput);
  if (s.takeaways) lines.push("Takeaways: " + s.takeaways.join("; "));
  if (s.concepts) lines.push("Concepts taught: " + s.concepts.join(", "));
  return lines.join("\n");
}
