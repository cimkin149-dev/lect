// Small, dependency-free syntax highlighter covering the languages taught on
// this platform. Returns per-line HTML so the editor can show line numbers and
// highlight the exact lines being explained.

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const set = (s) => new Set(s.split(/\s+/).filter(Boolean));

const C_KW = "auto break case const continue default do else enum extern for goto if inline register return sizeof static struct switch typedef union volatile while";
const C_TYPES = "void char short int long float double signed unsigned size_t FILE bool NULL true false";
const CPP_KW = C_KW + " class public private protected virtual override namespace using template typename new delete this try catch throw operator friend explicit constexpr nullptr static_cast dynamic_cast const_cast reinterpret_cast final noexcept auto";
const CPP_TYPES = C_TYPES + " string vector map set list queue stack pair cout cin cerr endl std wstring";

export const LANGS = {
  java: {
    line: ["//"], block: [["/*", "*/"]], strings: ['"', "'"],
    kw: set("abstract assert break case catch class continue default do else enum extends final finally for if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record sealed permits yield"),
    types: set("void int long short byte char float double boolean String Integer Double Boolean Long Object List ArrayList Map HashMap Set HashSet Scanner System Math null true false"),
  },
  c: { line: ["//"], block: [["/*", "*/"]], strings: ['"', "'"], kw: set(C_KW), types: set(C_TYPES), preproc: true },
  cpp: { line: ["//"], block: [["/*", "*/"]], strings: ['"', "'"], kw: set(CPP_KW), types: set(CPP_TYPES), preproc: true },
  python: {
    line: ["#"], block: [['"""', '"""'], ["'''", "'''"]], strings: ['"', "'"],
    kw: set("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case"),
    types: set("int float str bool list dict set tuple None True False self print len range input open"),
  },
  javascript: {
    line: ["//"], block: [["/*", "*/"]], strings: ['"', "'", "`"],
    kw: set("async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield"),
    types: set("null undefined true false NaN Infinity console Math Array Object String Number Boolean Promise Map Set JSON document window"),
  },
  typescript: {
    line: ["//"], block: [["/*", "*/"]], strings: ['"', "'", "`"],
    kw: set("async await break case catch class const continue default delete do else enum export extends finally for function if implements import in instanceof interface let new of private protected public readonly return static super switch this throw try type typeof var void while yield"),
    types: set("string number boolean any unknown never void null undefined true false Array Promise Map Set Record"),
  },
  vb: {
    line: ["'", "REM "], block: [], strings: ['"'], ci: true,
    kw: set("addhandler and andalso as byref byval call case catch class const continue declare dim do each else elseif end enum exit false finally for friend function get handles if implements imports in inherits interface is loop me module mustinherit mustoverride mybase new next not nothing of on option optional or orelse overloads overrides private property protected public raiseevent readonly redim return select set shared static step stop structure sub then throw to true try using wend when while with withevents writeonly"),
    types: set("integer long short byte single double decimal string boolean date object char variant msgbox console writeline readline inputbox"),
  },
  sql: {
    line: ["--"], block: [["/*", "*/"]], strings: ["'"], ci: true,
    kw: set("select from where insert into values update set delete create alter drop table index view join inner left right outer full on group by order having limit offset union all distinct as and or not in is null like between exists case when then else end primary key foreign references default check unique constraint database use begin commit rollback"),
    types: set("int integer bigint smallint varchar char text date datetime timestamp decimal numeric float double boolean count sum avg min max"),
  },
  html: { line: [], block: [["<!--", "-->"]], strings: ['"', "'"], kw: set(""), types: set(""), markup: true },
  css: {
    line: [], block: [["/*", "*/"]], strings: ['"', "'"],
    kw: set("important media import keyframes font-face"), types: set(""),
  },
  bash: { line: ["#"], block: [], strings: ['"', "'"], kw: set("if then else elif fi for while do done case esac function in echo cd ls grep export source"), types: set("") },
  text: { line: [], block: [], strings: [], kw: set(""), types: set("") },
};

const ALIASES = {
  "c++": "cpp", cc: "cpp", cxx: "cpp", js: "javascript", node: "javascript", ts: "typescript", py: "python", python3: "python",
  "vb.net": "vb", vbnet: "vb", vba: "vb", "visual basic": "vb", visualbasic: "vb", vb6: "vb", postgres: "sql", mysql: "sql",
  sh: "bash", shell: "bash", plain: "text", plaintext: "text", txt: "text", htm: "html",
};

export function normalizeLanguage(lang) {
  const k = String(lang || "").trim().toLowerCase();
  if (LANGS[k]) return k;
  return ALIASES[k] || null;
}

export function guessLanguage(code) {
  const c = String(code || "");
  if (/\bpublic\s+(static\s+)?(class|void)\b|System\.out\.print|import\s+java\./.test(c)) return "java";
  if (/#include\s*<(iostream|vector|string)>|std::|cout\s*<<|\bnamespace\b/.test(c)) return "cpp";
  if (/#include\s*<|\bprintf\s*\(|\bscanf\s*\(|\bint\s+main\s*\(/.test(c)) return "c";
  if (/^\s*def\s+\w+\(|^\s*import\s+\w+|\bprint\(|^\s*elif\b/m.test(c)) return "python";
  if (/\bSub\s+\w+|\bEnd\s+(Sub|If|Function)\b|\bDim\s+\w+\s+As\b|\bMsgBox\b|Console\.WriteLine/i.test(c)) return "vb";
  if (/\bSELECT\b[\s\S]*\bFROM\b|\bCREATE\s+TABLE\b|\bINSERT\s+INTO\b/i.test(c)) return "sql";
  if (/<\/?(html|div|body|head|p|span|h[1-6])\b/i.test(c)) return "html";
  if (/console\.log|=>|\bconst\s+\w+\s*=|\bfunction\s+\w+\s*\(|\blet\s+\w+\s*=/.test(c)) return "javascript";
  return "text";
}

function isIdentStart(ch) { return /[A-Za-z_$]/.test(ch); }
function isIdent(ch) { return /[A-Za-z0-9_$]/.test(ch); }

// -> [{ t: "comment"|"string"|"keyword"|"type"|"number"|"fn"|"preproc"|"tag"|"plain", s: "text" }]
export function tokenize(code, language) {
  const lang = LANGS[normalizeLanguage(language) || "text"];
  const src = String(code || "");
  const out = [];
  let i = 0;
  let plain = "";
  const push = (t, s) => {
    if (t === "plain") { plain += s; return; }
    if (plain) { out.push({ t: "plain", s: plain }); plain = ""; }
    out.push({ t, s });
  };
  const startsAt = (str) => src.startsWith(str, i);
  const atLineStart = () => { let k = i - 1; while (k >= 0 && (src[k] === " " || src[k] === "\t")) k--; return k < 0 || src[k] === "\n"; };

  while (i < src.length) {
    const ch = src[i];
    // block comments
    const blk = lang.block.find(([open]) => startsAt(open));
    if (blk) {
      const end = src.indexOf(blk[1], i + blk[0].length);
      const stop = end === -1 ? src.length : end + blk[1].length;
      push(blk[0] === '"""' || blk[0] === "'''" ? "string" : "comment", src.slice(i, stop));
      i = stop;
      continue;
    }
    // line comments
    const lc = lang.line.find((p) => (lang.ci ? src.substr(i, p.length).toLowerCase() === p.toLowerCase() : startsAt(p)));
    if (lc) {
      let end = src.indexOf("\n", i);
      if (end === -1) end = src.length;
      push("comment", src.slice(i, end));
      i = end;
      continue;
    }
    // preprocessor (#include ...)
    if (lang.preproc && ch === "#" && atLineStart()) {
      let end = src.indexOf("\n", i);
      if (end === -1) end = src.length;
      push("preproc", src.slice(i, end));
      i = end;
      continue;
    }
    // markup tags
    if (lang.markup && ch === "<") {
      const end = src.indexOf(">", i);
      if (end !== -1) { push("tag", src.slice(i, end + 1)); i = end + 1; continue; }
    }
    // strings
    if (lang.strings.includes(ch)) {
      let j = i + 1;
      while (j < src.length && src[j] !== ch && src[j] !== "\n") {
        if (src[j] === "\\" && ch !== "'" ) j++;
        else if (src[j] === "\\" && ch === "'" && lang !== LANGS.sql) j++;
        j++;
      }
      const stop = j < src.length && src[j] === ch ? j + 1 : j;
      push("string", src.slice(i, stop));
      i = stop;
      continue;
    }
    // numbers
    if (/[0-9]/.test(ch) && !(i > 0 && isIdent(src[i - 1]))) {
      const m = /^(0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?[fFlLuU]*)/.exec(src.slice(i));
      push("number", m[0]);
      i += m[0].length;
      continue;
    }
    // identifiers
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < src.length && isIdent(src[j])) j++;
      const word = src.slice(i, j);
      const key = lang.ci ? word.toLowerCase() : word;
      let k = j;
      while (src[k] === " ") k++;
      if (lang.kw.has(key)) push("keyword", word);
      else if (lang.types.has(key)) push("type", word);
      else if (src[k] === "(" && !lang.markup) push("fn", word);
      else push("plain", word);
      i = j;
      continue;
    }
    push("plain", ch);
    i++;
  }
  if (plain) out.push({ t: "plain", s: plain });
  return out;
}

// -> string[] (one HTML string per source line), tokens split across newlines
export function highlightLines(code, language) {
  const tokens = tokenize(code, language);
  const lines = [""];
  for (const tok of tokens) {
    const pieces = tok.s.split("\n");
    pieces.forEach((piece, idx) => {
      if (idx > 0) lines.push("");
      if (piece === "") return;
      const html = esc(piece);
      lines[lines.length - 1] += tok.t === "plain" ? html : `<span class="tok-${tok.t}">${html}</span>`;
    });
  }
  return lines;
}

export function highlightCode(code, language) {
  return highlightLines(code, language).join("\n");
}
