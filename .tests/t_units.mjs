// Extracts buildStructuredUnits straight from App.jsx so the REAL function is tested.
import fs from "node:fs";
const src = fs.readFileSync("src/App.jsx", "utf8");
const a = src.indexOf("function buildStructuredUnits(s) {");
const b = src.indexOf("function splitIntoSentences(text) {");
const fn = new Function(src.slice(a, b) + "; return buildStructuredUnits;")();
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const worked = fn({ type: "worked_example", problemSay: "Read problem.", steps: [{ say: "one" }, { say: "two" }, { say: "three" }], finalAnswer: { text: "x" }, finalSay: "Done." });
t("worked: problem(0) + 3 steps(1..3) + final(4)", JSON.stringify(worked.map((u) => u.reveal)) === "[0,1,2,3,4]" && worked[0].say === "Read problem." && worked[4].say === "Done.", JSON.stringify(worked));
const noFinal = fn({ type: "worked_example", steps: [{ say: "a" }] });
t("worked without final answer: no extra unit, default intro", noFinal.length === 2 && /step by step/.test(noFinal[0].say));
const walk = fn({ hasCode: true, introSay: "Intro.", codeSteps: [{ lines: [1, 2], say: "A" }, { lines: [3, 3], say: "B" }] });
t("walkthrough: intro (no lines) then each step with its lines", walk.length === 3 && walk[0].lines === null && JSON.stringify(walk[1].lines) === "[1,2]" && "lines" in walk[0]);
t("ordinary slide -> null (AI-narrated as before)", fn({ type: "concept", hasCode: false }) === null && fn({ hasCode: true, code: "x" }) === null);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
