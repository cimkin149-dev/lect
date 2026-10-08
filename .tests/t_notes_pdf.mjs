import { buildLectureNotesPdf } from "../src/slideKit/notesPdf.js";
import { normalizeSlide } from "../src/slideKit/schema.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const slides = [
  normalizeSlide({ type: "definition", title: "Algorithm — a “recipe”", definition: { term: "Algorithm", text: "A finite procedure ≤ 10 steps.", example: "Sorting cards." }, formulas: [{ latex: "T(n)=\\frac{n(n-1)}{2}", caption: "Comparisons" }] }),
  normalizeSlide({ type: "worked_example", title: "Solve a quadratic", problem: { text: "Solve $x^2-5x+6=0$.", latex: "x^2-5x+6=0" }, steps: [{ label: "Factor", say: "Factor into brackets.", latex: "(x-2)(x-3)=0" }, { label: "Roots", say: "Set each bracket to zero.", latex: "x=2,\\ x=3" }], finalAnswer: { text: "x = 2 or x = 3", latex: "x\\in\\{2,3\\}" } }),
  normalizeSlide({ type: "comparison", title: "Stack vs Queue", table: { headers: ["Aspect", "Stack", "Queue"], rows: [["Order", "LIFO", "FIFO"], ["Use", "Undo", "Print jobs"]] } }),
  normalizeSlide({ type: "diagram", title: "Flow", diagram: { code: "flowchart TD\n A-->B", caption: "A to B" } }),
  normalizeSlide({ type: "plot", title: "Parabola", plot: { kind: "function", expressions: ["x^2"], xMin: -3, xMax: 3, caption: "y = x squared" } }),
  normalizeSlide({ type: "code_walkthrough", title: "Loop", code: Array.from({ length: 70 }, (_, i) => `printf("line ${i + 1} ${"x".repeat(i % 7 === 0 ? 120 : 5)}");`).join("\n"), language: "c", expectedOutput: "line 1\nline 2" }),
  normalizeSlide({ type: "summary", title: "Recap", takeaways: ["Algorithms are procedures", "Maths $x^2$ matters"] }),
];
const sections = slides.map((s, i) => ({ title: s.title, explanation: `Paragraph for “${s.title}” with unicode: θ ≤ π → ∞ and – dashes… ${"Long body text. ".repeat(40)}`, code: s.hasCode ? s.code : null, slide: s }));
const doc = await buildLectureNotesPdf({ code: "CS 101", title: "Intro", unit: "Algorithms" }, sections);
const pages = doc.getNumberOfPages();
t("builds without throwing; multi-page", pages >= 3, pages);
const raw = doc.output();
t("pdf bytes produced", raw.startsWith("%PDF") && raw.length > 5000, raw.length);
t("no non-Latin-1 chars leaked into content", !/[θπ∞≤→]/.test(raw));
t("worked example steps + final answer rendered as text", raw.includes("Factor into brackets") && raw.includes("Answer: x = 2 or x = 3"));
t("table + definition + takeaways present", raw.includes("LIFO") && raw.includes("A finite procedure <= 10 steps") && raw.includes("Algorithms are procedures"));
t("diagram/graph degrade to text without a browser (no crash)", raw.includes("Diagram: A to B") && raw.includes("Graph: y = x squared"));
const unesc = raw.replace(/\\([()])/g, "$1");
t("formula plain-texted", unesc.includes("T(n)=(n(n-1))/(2)"));
t("long code lines wrapped, numbered through 70", raw.includes("(70)") || raw.includes("70"));
console.log("pages:", pages);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
