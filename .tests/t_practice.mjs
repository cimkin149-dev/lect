import { groundingFor, buildPracticePrompt, shuffleCheck, parsePracticeQuestions, generatePractice } from "../src/learning/practice.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const slides = [
  { title: "Pointers", concepts: ["pointers"], bullets: ["A pointer stores a memory address"], detail: "Use * to dereference.", type: "concept", notes: "" },
  { title: "Loops", concepts: ["for loops"], bullets: ["for repeats a block"], type: "concept", notes: "" },
  { title: "Pointer arithmetic", concepts: ["pointers", "arrays"], bullets: ["p+1 moves by one element"], type: "concept", notes: "" },
];
const g = groundingFor("pointers", slides);
t("grounding uses ONLY slides teaching the concept", /memory address/.test(g) && /p\+1/.test(g) && !/for repeats/.test(g), g);
t("no matching slides -> empty grounding (falls back to general knowledge)", groundingFor("recursion", slides) === "");
t("grounding capped in length", groundingFor("pointers", Array.from({ length: 5 }, () => ({ ...slides[0], detail: "x".repeat(3000) })), 1000).length <= 1000);
const bp = buildPracticePrompt({ concept: "pointers", grounding: g });
t("prompt names the concept, forbids going beyond the lecture, asks for plausible distractors and JSON", /"pointers"/.test(bp.prompt) && /ONLY on facts consistent with this lecture/.test(bp.prompt) && /plausible/.test(bp.prompt) && /"questions"/.test(bp.prompt) && /Return ONLY valid JSON/.test(bp.system));
t("without grounding the prompt says to use standard facts", /standard, well-established facts/.test(buildPracticePrompt({ concept: "x", grounding: "" }).prompt));

// shuffle keeps the correct option's TEXT correct
const chk = { question: "Q", options: ["a", "b", "c", "d"], answer: 1, explanation: "e", concept: "c" };
let moved = false;
for (let s = 1; s < 30; s++) {
  const sh = shuffleCheck(chk, seeded(s));
  if (sh.options[sh.answer] !== "b" || [...sh.options].sort().join() !== "a,b,c,d") { fail++; console.log("FAIL shuffle broke the answer key", s); break; }
  if (sh.answer !== 1) moved = true;
}
t("shuffle always keeps the correct option correct, and actually moves it", moved);

// parsing: model output with single-backslash LaTeX, a bad item, and a wrong concept label
const raw = JSON.stringify({ questions: [
  { question: "What is $\\frac{1}{2}$ of 8?", options: ["2", "4", "6", "8"], answer: 1, explanation: "Half of eight is four.", concept: "wrong label" },
  { question: "Bad key", options: ["a", "b", "c", "d"], answer: 9, explanation: "x" },
  { question: "Q3", options: ["a", "b", "c", "d"], answer: 0, explanation: "x" },
  { question: "Q4", options: ["a", "a", "c"], answer: 0, explanation: "dup option" },
] }).replace(/\\\\/g, "\\"); // simulate sloppy single backslashes
const qs = parsePracticeQuestions(raw, "pointers", { rng: seeded(3) });
t("invalid items are dropped, never shown (bad answer key; duplicate options leaving fewer than 3)", qs.length === 2 && !qs.some((q) => q.question === "Bad key" || q.question === "Q4"), qs.map((q) => q.question).join());
t("LaTeX survives, and the concept is always the practised one", qs[0].question.includes("\\frac{1}{2}") && qs.every((q) => q.concept === "pointers"));
t("the correct answer is still correct after shuffling", qs[0].options[qs[0].answer] === "4");

// generation: retries once if the first try is poor; fails clearly if hopeless
let calls = 0;
const good = JSON.stringify({ questions: Array.from({ length: 4 }, (_, i) => ({ question: `Q${i}`, options: ["a", "b", "c", "d"], answer: i % 4, explanation: "e" })) });
const aiSecond = async () => { calls++; return calls === 1 ? '{"questions":[]}' : good; };
const out = await generatePractice({ concept: "pointers", slides, callAI: aiSecond, rng: seeded(5) });
t("empty first answer -> retried, 4 questions returned", calls === 2 && out.length === 4);
let threw = false; try { await generatePractice({ concept: "x", slides, callAI: async () => "not json at all" }); } catch (e) { threw = /practice questions/.test(e.message); }
t("hopeless output -> a clear, friendly error (never a broken quiz)", threw);
let thrown2 = false; try { await generatePractice({ concept: "x", slides, callAI: async () => { throw new Error("The AI service is very busy"); } }); } catch (e) { thrown2 = /busy/.test(e.message); }
t("AI outage surfaces the real message", thrown2);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
