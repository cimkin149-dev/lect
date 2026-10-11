import { estimateMastery, calibration, conceptsToRevise } from "../src/learning/mastery.js";
import { summarizeBreakdown, commonMisconceptions, weakConcepts } from "../src/learning/misconceptions.js";
import { pickCorrections, correctionsPromptBlock } from "../src/learning/corrections.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const NOW = Date.UTC(2026, 9, 10);
const day = 86400000;
const ev = (concept, correct, ageDays, confidence = "fairly") => ({ concept, correct, confidence, ts: NOW - ageDays * day });

// ---------- mastery
let m = estimateMastery([ev("loops", true, 1), ev("loops", true, 2), ev("loops", true, 3)], NOW);
t("consistent correct answers -> strong", m[0].level === "strong" && m[0].mastery > 0.75, JSON.stringify(m[0]));
m = estimateMastery([ev("ptr", false, 1), ev("ptr", false, 2), ev("ptr", true, 3)], NOW);
t("mostly wrong -> weak", m[0].level === "weak" && m[0].mastery < 0.5, JSON.stringify(m[0]));
m = estimateMastery([ev("x", true, 0)], NOW);
t("a single answer is 'building', not a verdict", m[0].level === "building" && m[0].n === 1);
const lucky = estimateMastery([ev("g", true, 1, "guess"), ev("g", true, 1, "guess")], NOW)[0].mastery;
const solid = estimateMastery([ev("g", true, 1, "sure"), ev("g", true, 1, "sure")], NOW)[0].mastery;
t("correct guesses count less than confident correct answers", lucky < solid, `${lucky} vs ${solid}`);
const hon = estimateMastery([ev("h", false, 1, "guess"), ev("h", false, 1, "guess"), ev("h", true, 1, "sure")], NOW)[0].mastery;
const con = estimateMastery([ev("h", false, 1, "sure"), ev("h", false, 1, "sure"), ev("h", true, 1, "sure")], NOW)[0].mastery;
t("confident wrong answers count against mastery MORE than honest guesses", con < hon, `${con} vs ${hon}`);
const old = estimateMastery([ev("r", false, 120), ev("r", false, 118), ev("r", true, 1), ev("r", true, 0)], NOW)[0];
t("old mistakes fade, recent success shows (improving)", old.trend === "improving" && old.mastery >= 0.5, JSON.stringify(old));
const slip = estimateMastery([ev("s", true, 30), ev("s", true, 29), ev("s", false, 1), ev("s", false, 0)], NOW)[0];
t("recent failures after early success -> slipping", slip.trend === "slipping", JSON.stringify(slip));
const mixed = estimateMastery([ev("a", true, 1), ev("a", true, 1), ev("a", true, 1), ev("b", false, 1), ev("b", false, 1), ev("c", true, 1)], NOW);
t("weakest concept listed first; unknown ('building') in the middle; strong last", mixed[0].concept === "b" && mixed[mixed.length - 1].concept === "a", mixed.map((x) => x.concept + ":" + x.level).join());
t("bad rows ignored safely", estimateMastery([null, {}, { concept: "z" }, { concept: "z", correct: "yes" }], NOW).length === 0 && estimateMastery(null, NOW).length === 0);
t("revise list: weak/developing/slipping with enough evidence, capped", conceptsToRevise(estimateMastery([ev("b", false, 1), ev("b", false, 2), ev("c", true, 1), ev("c", true, 2), ev("d", false, 1)], NOW), 3).map((c) => c.concept).join() === "b");
// ---------- calibration
t("not enough 'very sure' answers -> unknown", calibration([ev("a", true, 1, "sure")]).level === "unknown");
t("often wrong when very sure -> overconfident", calibration([ev("a", false, 1, "sure"), ev("a", false, 1, "sure"), ev("a", true, 1, "sure")]).level === "overconfident");
t("right when very sure -> well-calibrated", calibration([ev("a", true, 1, "sure"), ev("a", true, 1, "sure"), ev("a", true, 1, "sure"), ev("a", false, 1, "sure")]).level === "well-calibrated");

// ---------- misconceptions (rows exactly as the database returns them)
const rows = [
  { slide_index: 2, concept: "types", option_text: "Integer", correct: false, answers: 3, confident_answers: 2, students: 3 },
  { slide_index: 2, concept: "types", option_text: "int", correct: true, answers: 2, confident_answers: 2, students: 2 },
  { slide_index: 2, concept: "types", option_text: "string", correct: false, answers: 1, confident_answers: 0, students: 1 },
  { slide_index: 4, concept: "loops", option_text: "for", correct: true, answers: 9, confident_answers: 4, students: 9 },
  { slide_index: 4, concept: "loops", option_text: "while", correct: false, answers: 1, confident_answers: 0, students: 1 },
];
const sum = summarizeBreakdown(rows);
t("per-slide totals", sum.bySlide.get(2).total === 6 && sum.bySlide.get(2).correct === 2);
const types = sum.concepts.find((c) => c.concept === "types");
t("per-concept accuracy and confident-wrong rate", types.answers === 6 && Math.abs(types.correctRate - 2 / 6) < 1e-9 && Math.abs(types.confidentWrongRate - 2 / 6) < 1e-9, JSON.stringify(types));
t("weakest concept first", sum.concepts[0].concept === "types");
const mis = commonMisconceptions(sum);
t("top misconception: 'Integer' on slide 2, 75% of wrong answers, 2 very sure", mis.length === 1 && mis[0].wrongText === "Integer" && mis[0].slideIndex === 2 && mis[0].count === 3 && Math.abs(mis[0].shareOfWrong - 0.75) < 1e-9 && mis[0].confidentCount === 2, JSON.stringify(mis));
t("single stray wrong answers are not called misconceptions", !mis.some((x) => x.wrongText === "string" || x.wrongText === "while"));
t("weak concepts need enough answers", weakConcepts(sum).map((c) => c.concept).join() === "types" && weakConcepts(summarizeBreakdown([rows[4]])).length === 0);
t("empty input safe", summarizeBreakdown(null).concepts.length === 0 && commonMisconceptions(summarizeBreakdown([])).length === 0);

// ---------- corrections
const corr = [
  { approved_question: "What is autoboxing in Java?", lecturer_answer: "Autoboxing is the automatic conversion of a primitive into its wrapper class." },
  { approved_question: "What is the difference between == and equals()?", lecturer_answer: "== compares references; equals() compares contents." },
  { approved_question: "Why do we need a constructor?", lecturer_answer: "To initialise an object when it is created." },
];
t("short question matches on its one distinctive word", pickCorrections("what's autoboxing?", corr)[0]?.approved_question === corr[0].approved_question);
t("rephrased question still finds the right answer", pickCorrections("can you explain the difference between double equals and the equals method", corr)[0]?.approved_question === corr[1].approved_question);
t("unrelated question matches nothing (no wrong 'approved' answer injected)", pickCorrections("how do I install Java on Windows", corr).length === 0 && pickCorrections("", corr).length === 0);
t("one shared common word (Java) never pulls in an unrelated approved answer", pickCorrections("which Java version should I download", corr).length === 0 && pickCorrections("is Java free", corr).length === 0);
t("a longer rephrasing of the approved question still matches", pickCorrections("could you explain what autoboxing in Java actually means", corr)[0]?.approved_question === corr[0].approved_question);
t("generic overlap alone is not enough", pickCorrections("what is memory", corr).length === 0);
const block = correctionsPromptBlock(pickCorrections("explain autoboxing", corr));
t("prompt block carries the lecturer's words and tells the AI to trust them", /approved/.test(block) && block.includes("wrapper class") && /confidence as high/.test(block));
t("no match -> empty block", correctionsPromptBlock([]) === "");
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
