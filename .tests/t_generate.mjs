import { JSDOM } from "jsdom";
const __dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = __dom.window; globalThis.document = __dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: __dom.window.navigator, configurable: true });
import { generateDeck, buildSlideSystemPrompt } from "../src/slideKit/generate.js";
let fail = 0;
const t = (name, cond, extra) => { if (!cond) { fail++; console.log("FAIL", name, extra ?? ""); } else console.log("ok  ", name); };

const calls = [];
// Scripted "AI". Note LaTeX written with SINGLE backslashes, like a sloppy model would.
const outline = `{"code":"MATH 101","title":"Algebra","unit":"Quadratics","slides":[
 {"title":"Overview","type":"concept","focus":"Intro","keyPoints":["a","b"]},
 {"title":"Solving a quadratic","type":"worked_example","focus":"Factor","keyPoints":["factor"]},
 {"title":"Quadratic flow","type":"diagram","focus":"Process","keyPoints":["steps"]},
 {"title":"Will fail","type":"concept","focus":"Unreachable slide","keyPoints":["x","y"]},
 {"title":"Wrap up","type":"summary","focus":"Recap","keyPoints":["r"]}]}`;
let repairedOnce = false;
const callAI = async (system, prompt, max, model) => {
  calls.push({ kind: /outline only/.test(system) ? "outline" : /problems:|Automatic checks/.test(prompt) ? "repair" : "slide", prompt });
  if (/outline only/.test(system)) return outline;
  if (/Write slide 1 /.test(prompt)) return '{"title":"Overview","bullets":["Quadratics have $x^2$ terms","Roots are where $f(x)=0$"],"detail":"d","notes":"n","formulas":[{"latex":"ax^2+bx+c=0","caption":"Standard form"}]}';
  if (/Write slide 2 /.test(prompt)) {
    return '{"problem":{"text":"Solve $x^2-5x+6=0$."},"problemSay":"Let us solve it.","steps":[{"label":"Factor","say":"Factor it.","latex":"(x-2)(x-3)=0"},{"label":"Check","say":"Test x equals 4.","latex":"4^2-5\\cdot 4+6=2","verify":{"expression":"4^2-5*4+6","expected":"2"}}],"finalAnswer":{"text":"x=2 or x=3","latex":"x\\in\\{2,3\\}"},"finalSay":"Done.","bullets":["m"],"detail":"d","notes":"n"}';
  }
  if (/Write slide 3 /.test(prompt)) return '{"diagram":{"code":"flowchart TD\\n A[Start] --> --> B","caption":"c"},"bullets":["b"],"detail":"d","notes":"n"}';
  if (/Write slide 4 /.test(prompt)) throw new Error("boom: provider error");
  if (/Write slide 5 /.test(prompt)) return '{"takeaways":["t1","t2"],"checkQuestion":{"question":"q?","answer":"a"},"bullets":[],"detail":"d","notes":"n"}';
  if (/Automatic checks/.test(prompt)) {
    if (/arithmetically wrong/.test(prompt)) { repairedOnce = true; return prompt.includes("expected\":\"2") ? '{}' : '{}'; }
    // diagram repair: fix the syntax
    return '{"diagram":{"code":"flowchart TD\\n A[Start] --> B[End]","caption":"c"},"bullets":["b"],"detail":"d","notes":"n"}';
  }
  throw new Error("unexpected call");
};
const progress = [];
const deck = await generateDeck({
  rawUnits: ["Quadratic equations source text"], settings: { durationMinutes: 45, pace: "standard", courseCode: "", courseTitle: "", unitTitle: "" },
  toneDesc: "friendly", allowLiveCode: true, callAI, model: "m", computeWordBudget: () => 160, onProgress: (m) => progress.push(m), deps: { sleep: async () => {} },
});
t("5 slides built in order", deck.slides.length === 5 && deck.slides[0].title === "Overview" && deck.slides[4].title === "Wrap up", deck.slides.map((s) => s.title).join("|"));
t("course metadata from outline", deck.code === "MATH 101" && deck.unit === "Quadratics");
t("types preserved", deck.slides.map((s) => s.type).join(",") === "concept,worked_example,diagram,concept,summary", deck.slides.map((s) => s.type).join(","));
t("LaTeX with single backslashes survived end-to-end", deck.slides[1].steps[1].latex === "4^2-5\\cdot 4+6=2" && deck.slides[1].finalAnswer.latex === "x\\in\\{2,3\\}", JSON.stringify(deck.slides[1].steps[1].latex));
t("correct arithmetic marked verified, no warnings", deck.slides[1].steps[1].verified === true && !deck.slides[1].warnings, JSON.stringify(deck.slides[1].warnings));
t("broken diagram was repaired by AI", deck.slides[2].diagram && /A\[Start\] --> B\[End\]/.test(deck.slides[2].diagram.code) && !deck.slides[2].warnings, JSON.stringify(deck.slides[2]));
t("failed slide degrades to concept with warning", deck.slides[3].type === "concept" && deck.slides[3].warnings && deck.slides[3].bullets.length === 2);
t("summary fields", deck.slides[4].takeaways.length === 2 && deck.slides[4].checkQuestion.question === "q?");
t("progress reported", progress[0] === "Planning the lecture outline…" && progress.some((p) => /Wrote 5 of 5/.test(p)), progress.join(" / "));
t("slide 4 was retried (3 attempts, with backoff) before fallback", calls.filter((c) => /Write slide 4 /.test(c.prompt)).length === 3);
t("prompts mention doubled backslashes + spoken rules", /backslash must be doubled/.test(buildSlideSystemPrompt("worked_example", { toneDesc: "x", wordBudget: 100, allowLiveCode: true })) && /NO LaTeX/.test(buildSlideSystemPrompt("concept", { toneDesc: "x", wordBudget: 100, allowLiveCode: true })));
t("code prompt omitted when live code disabled", !/code_walkthrough:/.test(buildSlideSystemPrompt("concept", { toneDesc: "x", wordBudget: 1, allowLiveCode: false }).split("Type")[0]) );

// stripping path: diagram stays broken after repair
const callAI2 = async (system, prompt) => {
  if (/outline only/.test(system)) return '{"slides":[{"title":"D","type":"diagram","focus":"f","keyPoints":["k"]}]}';
  return '{"diagram":{"code":"not a diagram","caption":"c"},"bullets":["b"],"detail":"d","notes":"n"}';
};
const deck2 = await generateDeck({ rawUnits: ["x"], settings: { durationMinutes: 10 }, toneDesc: "t", allowLiveCode: true, callAI: callAI2, model: "m", computeWordBudget: () => 100, deps: { sleep: async () => {} } });
t("unfixable diagram stripped + warning recorded (never reaches students)", !deck2.slides[0].diagram && deck2.slides[0].warnings.some((w) => /diagram/i.test(w)));
// rate limited twice, then succeeds -> real slide, not a fallback
let n = 0; const waits = [];
const callAI3 = async (system, prompt) => {
  if (/outline only/.test(system)) { n++; if (n < 3) { const e = new Error("rate"); e.rateLimited = true; throw e; } return '{"slides":[{"title":"Only","type":"concept","focus":"f","keyPoints":["k"]}]}'; }
  if (++n < 6) { const e = new Error("rate"); e.rateLimited = true; throw e; }
  return '{"bullets":["real content"],"detail":"d","notes":"n"}';
};
const deck3 = await generateDeck({ rawUnits: ["x"], settings: { durationMinutes: 10 }, toneDesc: "t", allowLiveCode: true, callAI: callAI3, model: "m", computeWordBudget: () => 100, deps: { sleep: async (ms) => { waits.push(ms); } } });
t("rate-limited outline + slide recover after backoff", deck3.slides[0].bullets[0] === "real content" && !deck3.slides[0].warnings && waits.length >= 3, JSON.stringify({ waits, s: deck3.slides[0] }));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
