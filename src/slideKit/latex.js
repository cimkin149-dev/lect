// KaTeX helpers + the tiny "rich text" splitter that lets any on-screen string
// contain inline math ($...$) or display math ($$...$$).
import katex from "katex";

const BASE = { strict: "ignore", trust: false, maxExpand: 1000, maxSize: 50, output: "htmlAndMathml" };

export function renderLatexHTML(latex, display = false) {
  try {
    return katex.renderToString(String(latex || ""), { ...BASE, throwOnError: false, displayMode: display });
  } catch (e) {
    return "";
  }
}

export function latexError(latex) {
  try {
    katex.renderToString(String(latex || ""), { ...BASE, throwOnError: true });
    return null;
  } catch (e) {
    return String((e && e.message) || e).replace(/^KaTeX parse error:\s*/, "").slice(0, 160);
  }
}

// Splits "Area is $\\frac{1}{2}bh$ here" into text / math parts. A "$" only opens
// math if it is followed by a non-space and only closes it if preceded by a
// non-space and NOT followed by a digit — so "costs $5 and $10" stays plain text.
export function splitRichText(input) {
  const text = String(input || "");
  const parts = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) parts.push({ type: "text", value: buf });
    buf = "";
  };
  while (i < text.length) {
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end > i + 2) {
        flush();
        parts.push({ type: "math", value: text.slice(i + 2, end).trim(), display: true });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "$" && i + 1 < text.length && !/\s/.test(text[i + 1]) && text[i + 1] !== "$") {
      let j = i + 1;
      let close = -1;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === "$" && !/\s/.test(text[j - 1]) && !/\d/.test(text[j + 1] || "")) {
          close = j;
          break;
        }
        j++;
      }
      if (close > i + 1) {
        flush();
        parts.push({ type: "math", value: text.slice(i + 1, close), display: false });
        i = close + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return parts;
}

const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι",
  kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ",
  chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const SYMBOLS = {
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈",
  equiv: "≡", infty: "∞", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐", leftrightarrow: "↔",
  sum: "Σ", prod: "Π", int: "∫", partial: "∂", nabla: "∇", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪",
  cap: "∩", forall: "∀", exists: "∃", therefore: "∴", degree: "°", circ: "°", ldots: "…", cdots: "⋯", angle: "∠", propto: "∝",
  sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln", lim: "lim", max: "max", min: "min", sqrt: "√",
};
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ", i: "ⁱ" };
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋" };

function mapScript(body, table) {
  const chars = [...body];
  return chars.every((c) => table[c]) ? chars.map((c) => table[c]).join("") : null;
}

// Plain-text rendering of LaTeX, used where real typesetting is not available
// (the notes PDF, narration context). Deliberately simple and predictable.
export function latexToPlain(latex) {
  let s = String(latex || "");
  for (let k = 0; k < 6; k++) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `(${a})/(${b})`);
    s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (m, n, a) => `${n}√(${a})`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => `√(${a})`);
    s = s.replace(/\\(?:text|mathrm|mathbf|textbf|mathit|operatorname)\s*\{([^{}]*)\}/g, "$1");
    s = s.replace(/\^\s*\{([^{}]*)\}/g, (m, a) => mapScript(a, SUP) || `^(${a})`);
    s = s.replace(/_\s*\{([^{}]*)\}/g, (m, a) => mapScript(a, SUB) || `_(${a})`);
  }
  s = s.replace(/\^([0-9n])/g, (m, a) => SUP[a] || `^${a}`).replace(/_([0-9])/g, (m, a) => SUB[a] || `_${a}`);
  s = s.replace(/\\([A-Za-z]+)/g, (m, name) => GREEK[name] || SYMBOLS[name] || name);
  s = s.replace(/\\[,;:! ]/g, " ").replace(/\\\\/g, "; ").replace(/\\(left|right)/g, "");
  s = s.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  return s;
}

// jsPDF's built-in fonts only cover Latin-1. This maps everything else (Greek,
// roots, arrows, comparison symbols, smart quotes, super/subscripts) to plain
// ASCII-ish text so notes never print as "?" boxes.
const PDF_MAP = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta", "ι": "iota", "κ": "kappa",
  "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi", "ρ": "rho", "σ": "sigma", "τ": "tau", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
  "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Π": "Pi", "Σ": "Sigma", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega",
  "√": "sqrt", "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "≡": "==", "∞": "infinity", "→": "->", "←": "<-", "⇒": "=>", "⇐": "<=", "↔": "<->",
  "∫": "integral", "∂": "d", "∇": "nabla", "∈": " in ", "∉": " not in ", "⊂": " subset of ", "⊆": " subset of ", "∪": " union ", "∩": " intersect ",
  "∀": "for all ", "∃": "there exists ", "∴": "therefore ", "∠": "angle ", "∝": " proportional to ", "…": "...", "⋯": "...", "−": "-", "–": "-", "—": " - ",
  "‘": "'", "’": "'", "“": '"', "”": '"', "•": "-", "·": "·", "∗": "*", "≪": "<<", "≫": ">>",
  "⁰": "^0", "⁴": "^4", "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9", "⁺": "^+", "⁻": "^-", "ⁿ": "^n", "ⁱ": "^i",
  "₀": "_0", "₁": "_1", "₂": "_2", "₃": "_3", "₄": "_4", "₅": "_5", "₆": "_6", "₇": "_7", "₈": "_8", "₉": "_9", "₊": "_+", "₋": "_-",
  "\u00a0": " ",
};
export function toPdfSafe(input) {
  return String(input || "").replace(/[^\u0000-\u00ff]/g, (c) => (c in PDF_MAP ? PDF_MAP[c] : ""));
}
