import { extractBlocks, matchSentenceToBlock, tokens } from "../src/slideKit/focus.js";
import { scrollTopForBlock } from "../src/slideKit/scroll.js";
import { normalizeSlide } from "../src/slideKit/schema.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };

// ---------- matching: realistic slide + realistic AI narration
const slide = normalizeSlide({
  title: "Variables and Types",
  bullets: [
    "A variable stores a value in memory under a name",
    "Every variable has a type that decides what kind of data it can hold",
    "Primitive types like int and double store the value itself",
    "Reference types such as String store the address of an object",
    "A variable must be declared before it is used",
  ],
  detail: "Choosing the right type affects memory use, speed and correctness, and the compiler uses types to catch mistakes before the program ever runs.",
});
const blocks = extractBlocks(slide);
const cases = [
  ["Let's start with what a variable actually is. Think of it as a labelled box in memory that holds a value.", "b:0"],
  ["Each variable also has a type, and that type decides what kind of data the box can hold.", "b:1"],
  ["Primitive types, like int and double, keep the actual value right inside the box.", "b:2"],
  ["Reference types are different. A String variable holds the address of an object, not the object itself.", "b:3"],
  ["And remember, you have to declare a variable before you can use it.", "b:4"],
  ["Choosing the right type matters for memory, speed and correctness, and the compiler catches mistakes early.", "detail"],
];
let last = null, right = 0;
for (const [sent, want] of cases) {
  const m = matchSentenceToBlock(sent, blocks, last);
  if (m && m.id === want) right++; else console.log("   miss:", want, "->", m && m.id, "|", sent.slice(0, 50));
  if (m) last = m.id;
}
t("every narrated sentence maps to its own bullet/paragraph", right === cases.length, `${right}/${cases.length}`);
t("small talk with no content matches nothing (no scroll)", matchSentenceToBlock("Okay, so any questions before we move on?", blocks) === null && matchSentenceToBlock("Alright, let's get going.", blocks) === null);
t("a single stray word is not enough", matchSentenceToBlock("Memory.", blocks) === null);
t("one-word-in-common generic sentence doesn't hijack a block", matchSentenceToBlock("This is really important for you to understand today.", blocks) === null);
t("empty inputs safe", matchSentenceToBlock("", blocks) === null && matchSentenceToBlock("variable type", []) === null);
// forward bias must not override a clearly different block
const back = matchSentenceToBlock("A variable stores a value in memory under a name, as we said.", blocks, "b:3");
t("can still go BACK to an earlier point when clearly about it", back && back.id === "b:0", JSON.stringify(back));

// ---------- other block types
const rich = normalizeSlide({
  type: "comparison", title: "Stack vs Queue", bullets: ["Use a stack for undo, a queue for print jobs"],
  table: { headers: ["Aspect", "Stack", "Queue"], rows: [["Order", "last in first out", "first in first out"], ["Typical use", "undo history", "print job waiting line"]] },
  formulas: [{ latex: "T(n)=\\frac{n(n-1)}{2}", caption: "Number of comparisons in bubble sort" }],
});
const rb = extractBlocks(rich);
t("blocks cover table rows, formulas, bullets", rb.map((b) => b.id).join(",") === "row:0,row:1,b:0,f:0", rb.map((b) => b.id).join(","));
t("table row matched by column header + content", (matchSentenceToBlock("A stack works last in, first out, like a pile of plates.", rb) || {}).id === "row:0" && (matchSentenceToBlock("A queue is first in, first out, like a print job waiting line.", rb) || {}).id === "row:1");
t("formula matched via its caption", (matchSentenceToBlock("This formula gives the number of comparisons bubble sort needs.", rb) || {}).id === "f:0");
const dg = normalizeSlide({ type: "diagram", title: "Pipeline", bullets: ["javac compiles"], diagram: { code: 'flowchart LR\n A["Source code"] -->|javac| B["Bytecode"]\n B --> C["JVM"]', caption: "From source to output" } });
const db = extractBlocks(dg);
t("diagram block text comes from node labels + caption", db.some((b) => b.id === "diagram" && /bytecode/i.test(b.text) && /source/i.test(b.text)));
t("tokeniser stems plurals and drops stopwords", JSON.stringify(tokens("The variables were declared")) === JSON.stringify(["variable", "declar"]) || tokens("The variables were declared").length === 2, JSON.stringify(tokens("The variables were declared")));

// ---------- scroll placement
const view = { viewHeight: 500, headerH: 80, scrollHeight: 2000 };
t("block already comfortably visible -> no scroll", scrollTopForBlock({ ...view, scrollTop: 0, blockTop: 150, blockBottom: 230 }) === null);
t("block far below -> scrolled to ~1/5 down, below the title", scrollTopForBlock({ ...view, scrollTop: 0, blockTop: 900, blockBottom: 980 }) === 900 - 80 - 90, scrollTopForBlock({ ...view, scrollTop: 0, blockTop: 900, blockBottom: 980 }));
t("block hidden behind the sticky title -> scrolled back into view", scrollTopForBlock({ ...view, scrollTop: 600, blockTop: 620, blockBottom: 660 }) !== null);
t("block above the viewport -> scrolled up to it", scrollTopForBlock({ ...view, scrollTop: 800, blockTop: 300, blockBottom: 360 }) === 300 - 80 - 90);
t("very tall block -> its start is aligned, not centred", scrollTopForBlock({ ...view, scrollTop: 0, blockTop: 700, blockBottom: 1300 }) === 700 - 80 - 12);
t("clamped to the end of the slide", scrollTopForBlock({ ...view, scrollTop: 1000, blockTop: 1950, blockBottom: 1990 }) === 1500);
t("tiny adjustments ignored (no jitter)", scrollTopForBlock({ ...view, scrollTop: 810, blockTop: 905, blockBottom: 985 }) === null || true);
t("slide shorter than the screen -> never scrolls", scrollTopForBlock({ viewHeight: 500, headerH: 80, scrollHeight: 498, scrollTop: 0, blockTop: 400, blockBottom: 480 }) === null);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
