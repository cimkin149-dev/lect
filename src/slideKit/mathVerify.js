// Independent arithmetic checking for worked examples + function compilation
// for plots. mathjs is large, so it is loaded lazily the first time it's needed.
// The instance is locked down: AI-written expressions must not be able to
// import code, define units, or re-enter the parser.

let mathPromise = null;

async function getMath() {
  if (!mathPromise) {
    mathPromise = import("mathjs").then(({ create, all }) => {
      const math = create(all);
      const evaluate = math.evaluate.bind(math);
      const parse = math.parse.bind(math);
      const disabled = (name) => () => {
        throw new Error(`Function ${name} is disabled`);
      };
      math.import(
        {
          import: disabled("import"), createUnit: disabled("createUnit"), reviver: disabled("reviver"),
          evaluate: disabled("evaluate"), parse: disabled("parse"), simplify: disabled("simplify"),
          derivative: disabled("derivative"), resolve: disabled("resolve"),
        },
        { override: true }
      );
      return { math, evaluate, parse };
    });
  }
  return mathPromise;
}

const MAX_EXPR = 300;

function cleanExpr(expr) {
  const s = String(expr == null ? "" : expr).trim();
  if (!s || s.length > MAX_EXPR) throw new Error("expression missing or too long");
  // Normalise typographic maths the model may emit.
  return s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\^/g, "^");
}

export async function evalExpression(expr, scope) {
  const { evaluate } = await getMath();
  const e = cleanExpr(expr);
  // mathjs rejects an explicit `undefined` scope argument, so only pass it when present.
  return scope ? evaluate(e, { ...scope }) : evaluate(e);
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (v && typeof v.toNumber === "function") {
    try { return v.toNumber(); } catch (e) { return NaN; }
  }
  return NaN;
}

function close(a, b) {
  const diff = Math.abs(a - b);
  return diff <= 1e-9 || diff <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));
}

// verify = { expression: "2*(3+4)", expected: "14" }  (expected may itself be an expression, e.g. "7/2")
// Returns { ok: true|false|null, computed, expected, error } — null means "could not be checked".
export async function verifyStep(verify) {
  if (!verify || !verify.expression || verify.expected === undefined || verify.expected === null || verify.expected === "") {
    return { ok: null };
  }
  try {
    const computed = await evalExpression(verify.expression);
    let expected;
    try {
      expected = await evalExpression(String(verify.expected));
    } catch (e) {
      expected = String(verify.expected);
    }
    const a = toNumber(computed);
    const b = toNumber(expected);
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      return { ok: close(a, b), computed: a, expected: b };
    }
    return { ok: String(computed) === String(expected), computed: String(computed), expected: String(expected) };
  } catch (e) {
    return { ok: null, error: String((e && e.message) || e).slice(0, 120) };
  }
}

// Compiles "x^2 - 3x + 2" into a fast f(x). Throws if the expression is invalid.
export async function compileFunction(expr, variable = "x") {
  const { parse } = await getMath();
  const node = parse(cleanExpr(expr));
  const compiled = node.compile();
  const probe = compiled.evaluate({ [variable]: 1 });
  if (typeof probe !== "number" && !(probe && typeof probe.toNumber === "function")) {
    throw new Error("expression must evaluate to a number");
  }
  return (x) => {
    try {
      return toNumber(compiled.evaluate({ [variable]: x }));
    } catch (e) {
      return NaN;
    }
  };
}
