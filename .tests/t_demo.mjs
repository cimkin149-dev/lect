import { JSDOM } from "jsdom";
const __dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = __dom.window; globalThis.document = __dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: __dom.window.navigator, configurable: true });
import { DEMO_SHOWCASE_SLIDES } from "../src/slideKit/demoSlides.js";
import { normalizeSlide } from "../src/slideKit/schema.js";
import { validateSlide } from "../src/slideKit/validate.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
for (const raw of DEMO_SHOWCASE_SLIDES) {
  const s = normalizeSlide(raw, 0);
  const { issues } = await validateSlide(s);
  t(`demo slide "${s.title}" (${s.type}) validates clean`, issues.length === 0, issues.join("|"));
}
const w = normalizeSlide(DEMO_SHOWCASE_SLIDES[1]);
t("demo worked example keeps pre-verified flags", w.steps[1].verified === true && w.steps[2].verified === true);
const cw = normalizeSlide(DEMO_SHOWCASE_SLIDES[0]);
t("walkthrough line ranges within the 7-line program", cw.codeSteps.every((c) => c.lines[1] <= 7) && cw.filename === "Circle.java");
t("expected output equals real JS double arithmetic", cw.expectedOutput === `Area: ${Math.PI * 5.0 * 5.0}`, cw.expectedOutput);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
