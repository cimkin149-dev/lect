import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SlideView from "../../src/slideKit/SlideView.jsx";
import CodePane from "../../src/slideKit/CodePane.jsx";
import CheckCard from "../../src/slideKit/CheckCard.jsx";
import MasteryPanel from "../../src/learning/MasteryPanel.jsx";
import PracticePanel from "../../src/learning/PracticePanel.jsx";
import SplashScreen from "../../src/SplashScreen.jsx";
import FlagReviewCard from "../../src/learning/FlagReviewCard.jsx";
import { ConceptTable, MisconceptionList } from "../../src/learning/ClassInsights.jsx";
import { newCheckState, chooseOption, finishCheck } from "../../src/slideKit/checkFlow.js";
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
const chk = { question: "What is $3^{2}$?", options: ["6", "9", "5", "8"], answer: 1, explanation: "Nine.", concept: "powers" };
const noop = () => {};
let cs = newCheckState(0, chk, 0);
let ch = renderToStaticMarkup(<CheckCard state={cs} onChoose={noop} onConfidence={noop} onSkip={noop} />);
t("check card: question with maths, 4 lettered options, skip link", ch.includes("katex") && (ch.match(/class="check-option[ "]/g) || []).length === 4 && ch.includes(">A<") && ch.includes(">D<") && ch.includes("Skip this question") && !ch.includes("How sure"));
cs = chooseOption(cs, 0, 100);
ch = renderToStaticMarkup(<CheckCard state={cs} onChoose={noop} onConfidence={noop} onSkip={noop} />);
t("after choosing: options locked, confidence chips offered, answer not yet revealed", ch.includes("How sure are you?") && ch.includes("Very sure") && !ch.includes("correct answer") && (ch.match(/disabled/g) || []).length >= 4);
cs = finishCheck(cs, "sure").state;
ch = renderToStaticMarkup(<CheckCard state={cs} onChoose={noop} onConfidence={noop} onSkip={noop} />);
t("feedback: correct option ticked, wrong choice marked, explanation shown", ch.includes("check-option chosen wrong") && ch.includes("correct answer") && ch.includes("Not quite.") && ch.includes("Nine."));
// ---- analytics phase B components
const mp = renderToStaticMarkup(<MasteryPanel mastery={[{ concept: "pointers", mastery: 0.31, n: 4, level: "weak", trend: "slipping" }, { concept: "loops", mastery: 0.9, n: 5, level: "strong", trend: "steady" }, { concept: "recursion", mastery: 0.5, n: 1, level: "building", trend: "steady" }]} revise={[{ concept: "pointers", trend: "slipping" }]} calibration={{ level: "overconfident", rate: 0.5 }} />);
t("mastery panel: revise-first box, labels, trend, honest 'building' state, calibration nudge", mp.includes("Worth revising first") && mp.includes("pointers") && mp.includes("was better before") && mp.includes("Needs work") && mp.includes("Strong") && mp.includes("↘ slipping") && mp.includes("keep going") && mp.includes("wrong 50% of the time"));
t("mastery panel has accessible bar labels", mp.includes('aria-label="pointers: 31 percent"') && mp.includes("not enough answers yet"));
t("mastery panel empty state invites the student to answer quizzes", renderToStaticMarkup(<MasteryPanel mastery={[]} />).includes("Answer the quick quiz questions"));
const ct = renderToStaticMarkup(<ConceptTable concepts={[{ concept: "types", answers: 6, correctRate: 2 / 6, confidentWrongRate: 2 / 6 }, { concept: "loops", answers: 2, correctRate: 1, confidentWrongRate: 0 }]} />);
t("concept table: low accuracy heated, tiny samples not judged", ct.includes("heat-hot") && ct.includes("33%") && ct.includes("too few answers") && !ct.includes("100%"));
const ml = renderToStaticMarkup(<MisconceptionList items={[{ slideIndex: 2, concept: "types", wrongText: "Integer", count: 3, shareOfWrong: 0.75, confidentCount: 2 }]} slideTitle={() => "Variables"} />);
t("misconception list names the wrong answer, share and the 'very sure' signal", ml.includes("Slide 3") && ml.includes("Variables") && ml.includes("Integer") && ml.includes("75%") && ml.includes("firmly held mistake"));
const fr = renderToStaticMarkup(<FlagReviewCard f={{ id: "f1", slide_title: "Types", student_name: "Sam", created_at: "2026-10-01T00:00:00Z", question: "what is autoboxing", ai_answer: "not sure" }} onResolve={noop} onApprove={noop} />);
t("flag card offers BOTH 'write the correct answer' and 'mark resolved'", fr.includes("Write the correct answer") && fr.includes("Mark resolved") && fr.includes("AI said: not sure"));
// ---- phase C components
const NOWMS = Date.UTC(2026, 9, 10);
const due = renderToStaticMarkup(<MasteryPanel now={NOWMS} onPractice={noop} mastery={[{ concept: "pointers", mastery: 0.3, n: 4, level: "weak", trend: "steady", lastAt: NOWMS - 3 * 86400000 }, { concept: "loops", mastery: 0.9, n: 5, level: "strong", trend: "steady", lastAt: NOWMS - 86400000 }]} revise={[]} calibration={{ level: "unknown" }} />);
t("mastery panel shows 'due for revision now' for weak, a countdown for strong, and a Practise button", due.includes("due for revision now") && due.includes("revise again in 13 days") && (due.match(/Practise this/g) || []).length === 2);
t("no Practise button when practice isn't available", !renderToStaticMarkup(<MasteryPanel now={NOWMS} mastery={[{ concept: "x", mastery: 0.6, n: 2, level: "developing", trend: "steady", lastAt: NOWMS }]} />).includes("Practise this"));
const pq = [{ question: "Q one?", options: ["a", "b", "c", "d"], answer: 2, explanation: "Because c.", concept: "pointers" }, { question: "Q two?", options: ["a", "b", "c", "d"], answer: 0, explanation: "Because a.", concept: "pointers" }];
const pp = renderToStaticMarkup(<PracticePanel concept="pointers" questions={pq} onAnswer={noop} onClose={noop} />);
t("practice panel: names the concept, progress, says the questions are AI-written, shows the first question", pp.includes("Practice: pointers") && pp.includes("question 1 of 2") && pp.includes("AI-written revision questions") && pp.includes("Q one?") && !pp.includes("Q two?"));
// ---- splash (brand)
const sp = renderToStaticMarkup(<SplashScreen onContinue={noop} onOpenLegal={noop} />);
t("splash states the product idea: AI-guided learning, with a clear call to action", sp.includes("AI-guided learning") && sp.includes("SEMAI") && sp.includes("Start learning"));
t("splash shows what it does (3 benefits) and how it works (3 steps)", ["Adapts to you", "Ask out loud", "Quizzes and notes"].every((x) => sp.includes(x)) && ["Join a lecture", "Learn with your AI lecturer", "See your progress grow"].every((x) => sp.includes(x)));
t("splash keeps the version stamp, company details and legal links", /Version [^<]*build/.test(sp) && sp.includes("SayMyTech Developers") && sp.includes("Privacy Policy") && sp.includes("Terms of Service"));
t("splash logo is labelled for screen readers; the animated background is hidden from them", sp.includes('role="img"') && sp.includes("SEMAI logo") && /<canvas[^>]*aria-hidden="true"/.test(sp));
t("splash respects reduced motion", sp.includes("prefers-reduced-motion"));
t("splash scrolls on small screens (no clipped content)", /\.splash \{[^}]*overflow-y: auto/.test(sp));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
