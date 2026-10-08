// Tolerant JSON parsing for AI output that contains LaTeX.
//
// LaTeX is full of backslashes, and JSON treats backslash as an escape:
//  - "\alpha", "\pi", "\left", "\sqrt" are INVALID JSON escapes -> JSON.parse throws
//  - "\frac", "\times", "\beta", "\right", "\nu" are VALID escapes -> they parse
//    "successfully" into a form-feed / tab / backspace / CR / newline character
//    followed by the rest of the word, silently destroying the formula.
// Step 1 (before parsing) doubles every backslash that isn't a legal JSON escape.
// Step 2 (after parsing) repairs the ambiguous ones by recognising the LaTeX
// words they start. Code and program-output fields are skipped on purpose.

const SKIP_KEYS = new Set(["code", "expectedOutput"]);

export function escapeInvalidBackslashes(raw) {
  return raw.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (m, ok) => (ok ? m : "\\\\"));
}

export function repairLatexString(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/\f/g, "\\f") // \frac, \forall, \flat
    .replace(/\x08/g, "\\b") // \beta, \bar, \binom, \big
    .replace(/\t(?=imes|heta|au\b|ext|an\b|o\b|op\b|ilde|riangle|herefore|extbf|extit)/g, "\\t") // \times \theta \tau \text \tan \to \top
    .replace(/\r(?=ho\b|ight|angle|ceil|floor|m\b)/g, "\\r") // \rho \right \rangle
    .replace(/\n(?=u\b|eq\b|eg\b|abla|ewline|e\b|ot\b|subset|leq|geq|mid\b|otin|i\b|parallel)/g, "\\n"); // \nu \neq \neg \nabla
}

function walk(value, key) {
  if (typeof value === "string") return SKIP_KEYS.has(key) ? value : repairLatexString(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, key));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = walk(value[k], k);
    return out;
  }
  return value;
}

export function parseJsonLoose(raw) {
  if (typeof raw !== "string") throw new Error("Empty AI response");
  let text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) throw new Error("No JSON object in AI response");
  text = text.slice(first, last + 1);
  let data;
  try {
    data = JSON.parse(escapeInvalidBackslashes(text));
  } catch (e) {
    // Last resort: strip trailing commas, which models occasionally emit.
    data = JSON.parse(escapeInvalidBackslashes(text).replace(/,\s*([}\]])/g, "$1"));
  }
  return walk(data, "");
}
