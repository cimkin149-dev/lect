// Which part of the slide is the lecturer talking about right now?
//
// Every sentence the lecturer speaks is matched to the on-screen block (a bullet,
// formula, table row, definition, diagram caption...) it is most likely about,
// using weighted word overlap. The slide then highlights and scrolls to THAT
// block. When no block is a clear match, nothing moves: not scrolling is better
// than scrolling to the wrong place.

import { latexToPlain } from "./latex.js";

const STOP = new Set(("a an and are as at be been being but by can could did do does doing for from had has have having he her here hers him his how i if in into is it its just let lets me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your yours okay ok well also really actually right so now going gonna about like thing things kind sort bit little look looking see think know say says").split(/\s+/));

export function stem(w) {
  let s = w.toLowerCase();
  if (s.length > 4 && s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.length > 4 && s.endsWith("sses")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us") && !s.endsWith("is")) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("ly")) s = s.slice(0, -2);
  if (s.length > 3 && s.endsWith("e")) s = s.slice(0, -1);
  return s;
}

export function tokens(text) {
  const out = [];
  for (const raw of String(text || "").toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").split(/\s+/)) {
    const w = raw.replace(/^\.+|\.+$/g, "");
    if (!w || STOP.has(w)) continue;
    if (w.length < 3 && !/^\d+$/.test(w)) continue;
    out.push(stem(w));
  }
  return out;
}

const plain = (s) => latexToPlain(String(s || "").replace(/\$\$?([^$]+)\$\$?/g, (m, a) => ` ${a} `));

function diagramText(code) {
  const labels = [];
  for (const m of String(code || "").matchAll(/\[\s*"?([^\]"]+)"?\s*\]|\(\s*"?([^)"]+)"?\s*\)|\{\s*"?([^}"]+)"?\s*\}|\|([^|]+)\|/g)) labels.push(m[1] || m[2] || m[3] || m[4]);
  return labels.join(" ");
}

// Ordered list of matchable blocks. The ids MUST equal the data-sk-block values SlideView renders
// (a test enforces this).
export function extractBlocks(slide) {
  const s = slide || {};
  const blocks = [];
  const add = (id, text) => { if (text && String(text).trim()) blocks.push({ id, text: plain(text) }); };
  if (s.definition) add("def", `${s.definition.term} ${s.definition.text} ${s.definition.example || ""}`);
  // each cell is paired with its column header ("Stack: last in first out") so a sentence about the stack finds the stack cell
  if (s.table) s.table.rows.forEach((r, i) => add(`row:${i}`, r.map((c, j) => (j === 0 ? c : `${s.table.headers[j] || ""} ${c}`)).join(" ")));
  if (s.diagram) add("diagram", `${s.diagram.caption || ""} ${diagramText(s.diagram.code)}`);
  if (s.plot) add("plot", `${s.plot.caption || ""} ${(s.plot.expressions || []).map((e) => e.label).join(" ")}`);
  (s.bullets || []).forEach((b, i) => add(`b:${i}`, b));
  (s.formulas || []).forEach((f, i) => add(`f:${i}`, `${f.caption || ""} ${latexToPlain(f.latex)}`));
  (s.takeaways || []).forEach((t, i) => add(`t:${i}`, t));
  if (s.checkQuestion) add("q", s.checkQuestion.question);
  add("detail", s.detail);
  return blocks;
}

// -> { id, confidence } or null when nothing is a clear match.
export function matchSentenceToBlock(sentence, blocks, lastId = null) {
  const sTokens = [...new Set(tokens(sentence))];
  if (sTokens.length < 2 || !blocks.length) return null;
  const bTokens = blocks.map((b) => new Set(tokens(b.text)));
  const N = blocks.length;
  const df = new Map();
  for (const set of bTokens) for (const t of set) df.set(t, (df.get(t) || 0) + 1);
  const weight = (t) => Math.log(1 + N / (df.get(t) || 0.5));
  const sentenceWeight = sTokens.reduce((n, t) => n + weight(t), 0);
  const lastIdx = lastId ? blocks.findIndex((b) => b.id === lastId) : -1;

  const scored = blocks.map((b, i) => {
    let overlap = 0;
    for (const t of sTokens) if (bTokens[i].has(t)) overlap += weight(t);
    const blockWeight = [...bTokens[i]].reduce((n, t) => n + weight(t), 0) || 1;
    const recall = overlap / sentenceWeight; // how much of what was SAID is on this block
    const precision = overlap / blockWeight; // how much of this block was mentioned
    let score = recall * 0.65 + Math.min(1, precision) * 0.35;
    if (lastIdx >= 0 && i >= lastIdx) score *= 1.08; // lectures tend to move forward through a slide
    return { id: b.id, score, recall };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1] ? scored[1].score : 0;
  if (top.recall < 0.2) return null;
  if (!(top.score >= second * 1.25 || top.recall >= 0.5)) return null;
  return { id: top.id, confidence: Math.min(1, top.score) };
}
