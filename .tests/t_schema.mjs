import { JSDOM } from "jsdom";
const __dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = __dom.window; globalThis.document = __dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: __dom.window.navigator, configurable: true });
import { normalizeSlide, slideToPlainContext } from "../src/slideKit/schema.js";
import { validateSlide, stripBrokenContent } from "../src/slideKit/validate.js";
let fail = 0;
const t = (name, cond, extra) => { if (!cond) { fail++; console.log("FAIL", name, extra ?? ""); } else console.log("ok  ", name); };

// OLD-format slide (what existing modules in the database look like)
const old = { title: "Variables", bullets: ["a", "b"], detail: "d", notes: "n", hasCode: true, code: "public class A {\n  int x = 1;\n}" };
const n1 = normalizeSlide(old, 0);
t("old slide -> concept, code kept", n1.type === "concept" && n1.hasCode && n1.language === "java" && n1.filename === "A.java", JSON.stringify(n1));
t("idempotent", JSON.stringify(normalizeSlide(n1, 0)) === JSON.stringify(n1));
t("no-code old slide", normalizeSlide({ title: "t", bullets: ["x"], hasCode: false, notes: "n" }).hasCode === false);
t("garbage input safe", normalizeSlide(null, 4).title === "Slide 5" && normalizeSlide("zzz", 0).type === "concept");

// NEW worked example
const we = normalizeSlide({
  type: "worked_example", title: "Quadratic roots",
  problem: { text: "Solve $x^2-5x+6=0$." }, problemSay: "Let's solve this quadratic.",
  steps: [
    { label: "Factor", say: "Factor into two brackets.", latex: "(x-2)(x-3)=0", verify: { expression: "(2-2)*(2-3)", expected: "0" } },
    { label: "Wrong", say: "Check x=4.", latex: "4^2-5\\cdot4+6=2", verify: { expression: "4^2-5*4+6", expected: "3" } },
    { label: "Bad latex", say: "oops", latex: "\\frac{a}{" },
  ],
  finalAnswer: { text: "x = 2 or x = 3", latex: "x\\in\\{2,3\\}" }, finalSay: "So the roots are two and three.",
}, 1);
t("worked example normalized", we.type === "worked_example" && we.steps.length === 3 && we.problem.text.includes("Solve"));
let { slide: vs, issues } = await validateSlide(we);
t("catches wrong arithmetic", issues.some((i) => /Step 2 is arithmetically wrong/.test(i)), issues.join("|"));
t("catches bad latex", issues.some((i) => /Step 3 has invalid LaTeX/.test(i)));
t("marks verified flags", vs.steps[0].verified === true && vs.steps[1].verified === false && vs.steps[2].verified === undefined);
const stripped = stripBrokenContent(vs, issues);
t("strip removes broken latex only", stripped.steps[2].latex === "" && stripped.steps[0].latex !== "" && stripped.warnings.length === issues.length);

// diagram + plot + code steps (mermaid stubbed for speed; real parse tested elsewhere)
const dg = normalizeSlide({ type: "diagram", title: "Flow", diagram: { code: "flowchart TD\n A-->B", caption: "c" }, plot: { kind: "function", expressions: ["x^2", "sin(x)"], xMin: -3, xMax: 3 } });
let r2 = await validateSlide(dg, { checkMermaid: async () => "Parse error on line 2" });
t("bad diagram flagged + stripped", r2.issues.some((i) => /diagram code is invalid/.test(i)) && !stripBrokenContent(r2.slide, r2.issues).diagram);
r2 = await validateSlide(dg);
t("real mermaid parse accepts valid flowchart", !r2.issues.some((i) => /diagram/.test(i)), r2.issues.join("|"));
const badPlot = normalizeSlide({ plot: { kind: "function", expressions: ["x^^^2 +"] } });
const r3 = await validateSlide(badPlot);
t("bad plot expression flagged", r3.issues.some((i) => /Plot expression/.test(i)));
const cw = normalizeSlide({ type: "code_walkthrough", title: "Loop", code: "for (int i=0;i<3;i++) {\n  printf(\"%d\", i);\n}", language: "C", codeSteps: [{ lines: [1, 1], say: "The loop header." }, { lines: [2, 99], say: "Body." }], expectedOutput: "012" });
t("code steps clamped", cw.codeSteps[1].lines[1] === 3 && cw.language === "c" && cw.filename === "main.c");
const ctx = slideToPlainContext(we);
t("plain context includes steps + formulas as text", /Step 1 \(Factor\)/.test(ctx) && /Problem: Solve/.test(ctx));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
