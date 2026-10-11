import { conceptsMatch, findLearnerConcept, planForSlide, adaptationPrompt, adaptWordBudget, adaptationLabel, emptySession, EXPLAIN_REQUESTS } from "../src/learning/adaptation.js";
import { estimateMastery, nextReview } from "../src/learning/mastery.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const NOW = Date.UTC(2026, 9, 10), day = 86400000;
const ev = (concept, correct, ageDays, confidence = "fairly") => ({ concept, correct, confidence, ts: NOW - ageDays * day });
const mastery = (events) => estimateMastery(events, NOW);
const slide = (concepts, prerequisites = []) => ({ type: "concept", title: "S", concepts, prerequisites });
const plan = (o) => planForSlide({ slideIndex: 2, session: emptySession(), enabled: true, mastery: [], ...o });

// ---- concept matching
t("'for loops' matches 'loops' (and vice versa)", conceptsMatch("for loops", "loops") && conceptsMatch("loops", "for loops"));
t("different concepts don't match", !conceptsMatch("pointers", "loops") && !conceptsMatch("memory management", "loops"));
t("empty names never match anything", !conceptsMatch("", "loops") && !conceptsMatch("", ""));
t("findLearnerConcept picks the entry with the most evidence", findLearnerConcept([{ concept: "loops", n: 2 }, { concept: "for loops", n: 5 }], "loops").n === 5);

// ---- levels
const weak = mastery([ev("pointers", false, 1), ev("pointers", false, 2), ev("pointers", true, 3)]);
let p = plan({ slide: slide(["pointers"]), mastery: weak });
t("a concept the student finds hard -> simplify, with a student-facing reason naming it", p.level === "simplify" && p.applied && /"pointers" has been tricky/.test(p.reason) && p.concept === "pointers", JSON.stringify(p));
const strong = mastery([ev("loops", true, 1), ev("loops", true, 2), ev("loops", true, 3), ev("loops", true, 4)]);
p = plan({ slide: slide(["loops"]), mastery: strong });
t("a concept the student clearly knows (>=3 answers, strong) -> brisk", p.level === "brisk" && /already know "loops"/.test(p.reason), JSON.stringify(p));
const fewStrong = mastery([ev("loops", true, 1), ev("loops", true, 2)]);
t("only 2 correct answers is NOT enough to go brisk (cautious)", plan({ slide: slide(["loops"]), mastery: fewStrong }).level === "standard");
t("no history -> standard, nothing applied", plan({ slide: slide(["loops"]), mastery: [] }).applied === false && plan({ slide: slide(["loops"]), mastery: [] }).reason === null);
t("a single old answer is never enough evidence to adapt", plan({ slide: slide(["pointers"]), mastery: mastery([ev("pointers", false, 1)]) }).level === "standard");
const slip = mastery([ev("arrays", true, 30), ev("arrays", true, 29), ev("arrays", false, 1), ev("arrays", false, 0)]);
p = plan({ slide: slide(["arrays"]), mastery: slip });
t("slipping (was good, now failing) -> simplify with a gentle reason", p.level === "simplify" && /knew "arrays" better before/.test(p.reason), JSON.stringify(p));

// ---- in-session evidence outweighs history
let ses = emptySession(); ses.wrongConcepts.add("loops");
p = plan({ slide: slide(["loops"]), mastery: strong, session: ses });
t("missed a question on this concept a moment ago -> simplify, even if history says strong", p.level === "simplify" && /missed a question on "loops" a moment ago/.test(p.reason), JSON.stringify(p));
ses = emptySession(); ses.lostSlides.add(1);
t("tapped 'lost' on the previous slide -> simplify the next", plan({ slide: slide(["anything"]), session: ses, slideIndex: 2 }).level === "simplify");
ses = emptySession(); ses.lostSlides.add(0);
t("'lost' two slides ago is no longer relevant", plan({ slide: slide(["anything"]), session: ses, slideIndex: 2 }).level === "standard");

// ---- prerequisite reminders
p = plan({ slide: slide(["recursion"], ["pointers"]), mastery: weak });
t("builds on a weak prerequisite -> reminder, level stays standard", p.reminder === "pointers" && p.level === "standard" && p.applied && /Quick reminder of "pointers"/.test(p.reason), JSON.stringify(p));
ses = emptySession(); ses.reminded.add("pointers");
t("the same prerequisite is only reminded ONCE per session", plan({ slide: slide(["recursion"], ["pointers"]), mastery: weak, session: ses }).reminder === null);
p = plan({ slide: slide(["pointers"], ["variables"]), mastery: [...weak, ...mastery([ev("variables", false, 1), ev("variables", false, 2)])] });
t("simplify + reminder combine in one honest reason", p.level === "simplify" && p.reminder === "variables" && /remind you of "variables"/.test(p.reason), JSON.stringify(p));
t("a strong prerequisite is not mentioned", plan({ slide: slide(["x"], ["loops"]), mastery: strong }).reminder === null);
const two = mastery([ev("a", false, 1), ev("a", false, 2), ev("b", false, 1), ev("b", false, 2), ev("b", false, 3), ev("b", false, 4)]);
t("with several weak prerequisites, the weakest is chosen", plan({ slide: slide(["x"], ["a", "b"]), mastery: two }).reminder === "b");

// ---- control
t("personalisation OFF -> nothing is adapted, ever", plan({ slide: slide(["pointers"], ["pointers"]), mastery: weak, enabled: false }).applied === false && planForSlide({ slide: slide(["pointers"]), slideIndex: 0, mastery: weak, session: Object.assign(emptySession(), { wrongConcepts: new Set(["pointers"]) }), enabled: false }).level === "standard");
t("slides without concept tags (old modules) are never adapted by concept", plan({ slide: { type: "concept", title: "old" }, mastery: weak }).applied === false);
t("fuzzy names carry history across modules ('pointer basics' vs 'pointers')", plan({ slide: slide(["pointers"]), mastery: mastery([ev("pointers", false, 1), ev("pointers", false, 2)]) }).level === "simplify");

// ---- what the AI is told
const simplifyPrompt = adaptationPrompt({ applied: true, level: "simplify", reminder: "pointers" });
t("prompt: simplify = short sentences, define terms, one everyday example, step by step", /short sentences/.test(simplifyPrompt) && /define each technical term/.test(simplifyPrompt) && /ONE concrete everyday example/.test(simplifyPrompt) && /reminding the students of "pointers"/.test(simplifyPrompt));
const briskPrompt = adaptationPrompt({ applied: true, level: "brisk", reminder: null });
t("prompt: brisk = half the words, no repeated basics, one deeper insight", /half the usual words/.test(briskPrompt) && /deeper insight/.test(briskPrompt));
t("prompt never contains scores, names or private data", !/\d\d%|mastery|score|\bSam\b|student named/i.test(simplifyPrompt + briskPrompt));
t("no adaptation -> empty prompt (the lecture is exactly as before)", adaptationPrompt({ applied: false, level: "standard" }) === "" && adaptationPrompt(null) === "");
t("brisk shortens the narration budget, simplify keeps it, minimum enforced", adaptWordBudget({ level: "brisk" }, 200) === 120 && adaptWordBudget({ level: "simplify" }, 200) === 200 && adaptWordBudget({ level: "brisk" }, 20) === 40 && adaptWordBudget(null, 150) === 150);
t("adaptation label carries the reason for the student", adaptationLabel({ applied: true, level: "simplify", reason: "why" }).reason === "why" && adaptationLabel({ applied: false }) === null && /Reminder of "x"/.test(adaptationLabel({ applied: true, level: "standard", reminder: "x", reason: "r" }).text));
t("student requests exist for example/steps/deeper/why with spoken wording", ["example", "steps", "deeper", "why"].every((k) => EXPLAIN_REQUESTS[k].label && /\?$/.test(EXPLAIN_REQUESTS[k].ask)));

// ---- spaced revision
const wk = mastery([ev("p", false, 3), ev("p", false, 3), ev("p", true, 3)])[0];
t("weak concept answered 3 days ago is DUE (2-day interval)", nextReview(wk, NOW).due === true);
const st = mastery([ev("l", true, 1), ev("l", true, 1), ev("l", true, 1)])[0];
const nr = nextReview(st, NOW);
t("strong concept answered yesterday is not due for ~13 days", nr.due === false && nr.inDays >= 12 && nr.inDays <= 14, JSON.stringify(nr));
// ---- scenario: one student's whole lecture, using the same calls the app makes
{
  const slides = [
    { type: "concept", title: "Memory", concepts: ["memory"], prerequisites: [] },
    { type: "concept", title: "Pointers", concepts: ["pointers"], prerequisites: ["memory"] },
    { type: "worked_example", title: "Pointer arithmetic", concepts: ["pointer arithmetic"], prerequisites: ["pointers"] },
    { type: "concept", title: "Arrays", concepts: ["arrays"], prerequisites: ["pointers"] },
  ];
  // history from earlier sessions: memory is shaky, loops are solid
  const hist = [ev("memory", false, 6), ev("memory", false, 6), ev("memory", true, 6), ev("loops", true, 5), ev("loops", true, 5), ev("loops", true, 5)];
  const sessionEvidence = [];
  const ses = emptySession();
  const run = (i, enabled = true) => {
    const p = planForSlide({ slide: slides[i], slideIndex: i, mastery: estimateMastery([...hist, ...sessionEvidence], NOW), session: ses, enabled });
    if (p.reminder) ses.reminded.add(p.reminder);
    return p;
  };
  const p0 = run(0);
  t("scenario: slide 1 teaches the weak concept 'memory' -> simplified", p0.level === "simplify" && /"memory"/.test(p0.reason));
  const p1 = run(1);
  t("scenario: slide 2 builds on weak 'memory' -> reminder given", p1.reminder === "memory", JSON.stringify(p1));
  sessionEvidence.push({ concept: "pointers", correct: false, confidence: "sure", ts: NOW }); ses.wrongConcepts.add("pointers");
  const p2 = run(2);
  t("scenario: after a wrong answer on pointers, 'pointer arithmetic' is simplified (a single answer is too little evidence for a prerequisite reminder)", p2.level === "simplify" && p2.reminder === null && /missed a question on "pointer arithmetic"/.test(p2.reason), JSON.stringify(p2));
  const p3 = run(3);
  t("scenario: arrays has no history of its own, so it stays standard; memory is not reminded a second time", p3.level === "standard" && p3.reminder === null, JSON.stringify(p3));
  const off = run(1, false);
  t("scenario: with personalisation off the SAME student gets the standard lecture", off.applied === false && off.reminder === null && off.level === "standard");
  t("scenario: a different student with no history gets the standard lecture on slide 1", planForSlide({ slide: slides[0], slideIndex: 0, mastery: [], session: emptySession(), enabled: true }).applied === false);
}
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
