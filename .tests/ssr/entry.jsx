import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SlideView from "../../src/slideKit/SlideView.jsx";
import CodePane from "../../src/slideKit/CodePane.jsx";
import { normalizeSlide } from "../../src/slideKit/schema.js";
import { extractBlocks } from "../../src/slideKit/focus.js";

let fail = 0;
const t = (name, cond, extra) => { if (!cond) { fail++; console.log("FAIL", name, extra ?? ""); } else console.log("ok  ", name); };
const render = (raw, props = {}) => renderToStaticMarkup(<SlideView slide={normalizeSlide(raw, 0)} unit="U" index={0} total={5} {...props} />);

const headerHtml = render({ title: "Hdr", bullets: ["b"] });
t("title + eyebrow live in a sticky header so they stay visible while scrolling", headerHtml.includes('<header class="sk-header"') && headerHtml.indexOf("Hdr") < headerHtml.indexOf("</header>"));
const old = render({ title: "Old slide", bullets: ["Plain bullet", "Math $x^2$ here"], detail: "Costs $5 and $10.", notes: "n", hasCode: false });
t("old slide renders bullets, inline math, currency untouched", old.includes("Plain bullet") && old.includes("katex") && old.includes("Costs $5 and $10."));

const we = { type: "worked_example", title: "Roots", problem: { text: "Solve $x^2-5x+6=0$", latex: "x^2-5x+6=0" },
  steps: [{ label: "Factor", say: "s", latex: "(x-2)(x-3)=0", verified: true }, { label: "Solve", say: "s", latex: "x=2,\\ x=3" }], finalAnswer: { text: "x = 2 or 3", latex: "x\\in\\{2,3\\}" } };
let h = render(we, { revealCount: 0 });
t("reveal 0: problem shown, no steps, no answer", h.includes("Problem") && !h.includes("Factor") && !h.includes("Answer"));
h = render(we, { revealCount: 1 });
t("reveal 1: first step only + current + verified badge", h.includes("Factor") && !h.includes("Solve</span>") && h.includes("current") && h.includes("✓ checked"));
h = render(we, { revealCount: 3 });
t("reveal 3 (all+1): both steps and final answer", h.includes("Factor") && h.includes("Solve") && h.includes("Answer"));
h = render(we);
t("default shows everything (manual browsing)", h.includes("Answer") && h.includes("Solve"));

h = render({ type: "comparison", title: "A vs B", table: { headers: ["Aspect", "A", "B"], rows: [["Speed", "fast", "slow"], ["Cost", "$1", "$2"]] }, bullets: ["x"] });
t("comparison table with scoped headers", h.includes("<table") && h.includes('scope="col"') && h.includes('scope="row"') && h.includes("Speed"));
h = render({ type: "definition", title: "D", definition: { term: "Algorithm", text: "A finite procedure.", example: "Sorting." } });
t("definition card", h.includes("Algorithm") && h.includes("A finite procedure.") && h.includes("Example"));
h = render({ type: "summary", title: "S", takeaways: ["one", "two"], checkQuestion: { question: "Why?", answer: "Because." } });
t("summary shows takeaways, hides answer until clicked", h.includes("one") && h.includes("Why?") && !h.includes("Because.") && h.includes("Show answer"));
h = render({ type: "diagram", title: "G", diagram: { code: "flowchart TD\n A-->B", caption: "Flow" }, bullets: ["b1"] });
t("diagram slide shows loading placeholder (client renders mermaid) + side bullets", h.includes("Drawing diagram") && h.includes("sk-split") && h.includes("b1"));
h = render({ type: "plot", title: "P", plot: { kind: "bar", labels: ["a", "b"], series: [{ name: "s", values: [1, 2] }], caption: "Bars" } });
t("category plot renders svg synchronously", h.includes("<svg") && h.includes("<rect") && h.includes("Bars"));
h = render({ title: "W", bullets: ["b"], warnings: ["Step 2 is wrong"] }, { showWarnings: true });
t("lecturer warnings shown only when asked", h.includes("Step 2 is wrong") && !render({ title: "W", bullets: ["b"], warnings: ["Step 2 is wrong"] }).includes("Step 2 is wrong"));
h = render({ type: "code_walkthrough", title: "C", code: "int x;", language: "c" });
t("code walkthrough slide hints at editor", h.includes("shown in the editor view"));

const cp = renderToStaticMarkup(<CodePane code={"int main() {\n  return 0;\n}"} language="c" filename="main.c" activeLines={[2, 2]} caption="Returns zero." expectedOutput="" />);
t("code pane: numbered, active + dim lines, caption", cp.includes('data-line="2"') && cp.includes("sk-line active") && cp.includes("sk-line dim") && cp.includes("Returns zero.") && cp.includes("main.c"));
const cpJs = renderToStaticMarkup(<CodePane code={"console.log(1)"} language="javascript" filename="a.js" expectedOutput="1" />);
t("js code pane has Run button; expected output labelled as not executed", cpJs.includes("▶ Run") && cpJs.includes("not executed"));
const cpTyped = renderToStaticMarkup(<CodePane code={"public class A {}"} typedCode={"public cl"} typing language="java" filename="A.java" liveTag />);
t("typing mode shows partial code + cursor", cpTyped.includes("cl") && !cpTyped.includes("class A") && cpTyped.includes("type-cursor") && cpTyped.includes("typing live"));
// every block the matcher can pick must exist on screen under the same id (and vice versa)
const idSamples = [
  { title: "T", bullets: ["one two", "three four"], detail: "A paragraph.", formulas: [{ latex: "x=1", caption: "c" }] },
  { type: "definition", title: "D", definition: { term: "Algorithm", text: "A finite procedure.", example: "Sorting." }, bullets: ["p"], detail: "d" },
  { type: "comparison", title: "C", table: { headers: ["A", "B", "C"], rows: [["x", "y", "z"], ["p", "q", "r"]] }, bullets: ["b"], detail: "d" },
  { type: "summary", title: "S", takeaways: ["t one", "t two"], checkQuestion: { question: "Why?", answer: "Because." }, bullets: [], detail: "d" },
  { type: "diagram", title: "G", diagram: { code: "flowchart TD\n A-->B", caption: "cap" }, bullets: ["b"], detail: "d" },
  { type: "plot", title: "P", plot: { kind: "bar", labels: ["a"], series: [{ name: "s", values: [1] }], caption: "bars" }, bullets: ["b"], detail: "d" },
];
for (const raw of idSamples) {
  const sl = normalizeSlide(raw, 0);
  const html = render(raw, { focusId: "nothing" });
  const rendered = [...html.matchAll(/data-sk-block="([^"]+)"/g)].map((m) => m[1]);
  const expected = extractBlocks(sl).map((b) => b.id);
  t(`block ids match screen for ${sl.type}`, expected.every((id) => rendered.includes(id)), JSON.stringify({ expected, rendered }));
}
const fh = render({ title: "F", bullets: ["alpha", "beta"] }, { focusId: "b:1" });
t("focused block gets sk-focus; slide enters following mode", /<li data-sk-block="b:1" class="sk-focus">/.test(fh) && fh.includes("sk-following") && !/<li data-sk-block="b:0" class="sk-focus">/.test(fh));
t("no focus -> no following mode", !render({ title: "F", bullets: ["a"] }).includes("sk-following"));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
