// Two-pass deck generation.
//  Pass 1: an outline (title, slide type and focus per slide) from the strong model.
//  Pass 2: ONE call per slide, so each slide gets its own full response budget
//          instead of sharing one response with the whole deck.
//  Then every slide is validated (LaTeX, arithmetic, diagrams, plots); problems
//  go back to the AI once for repair, and anything still broken is stripped so
//  it can never reach a student. A failed slide degrades to a plain concept
//  slide instead of failing the whole deck.

import { parseJsonLoose } from "./json.js";
import { normalizeSlide, SLIDE_TYPES } from "./schema.js";
import { validateSlide, stripBrokenContent } from "./validate.js";

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Free-tier AI quotas are per-minute; waiting a few seconds and retrying turns a
// transient "rate limited" into a success instead of a blank slide.
const RETRY_DELAYS_MS = [0, 5000, 12000];

const LANG_LIST = "java, c, cpp, python, javascript, typescript, vb, sql, html, css, bash";

function sourceDigest(rawUnits, limit = 24000) {
  const per = Math.max(1500, Math.floor(limit / Math.max(1, rawUnits.length)));
  return rawUnits.map((u, i) => `--- Unit ${i + 1} ---\n${String(u).slice(0, per)}`).join("\n\n");
}

export function buildOutlinePrompt({ settings, toneDesc, allowLiveCode }) {
  const duration = Number(settings.durationMinutes) || 45;
  const minSlides = Math.max(5, Math.round(duration / 6));
  const maxSlides = Math.max(9, Math.round(duration / 3));
  return `You are an expert instructional designer planning a genuinely thorough university slide deck for a ${duration}-minute session that an AI lecturer will present LIVE. Plan the deck as an outline only. Return ONLY valid JSON, no markdown fences, no commentary.

Schema:
{ "code": string, "title": string, "unit": string,
  "slides": [ { "title": string, "type": ${SLIDE_TYPES.map((t) => `"${t}"`).join(" | ")}, "focus": string, "keyPoints": string[] } ] }

Slide types — choose each slide's type for what teaches that idea best:
- concept: an explanation slide (bullets + supporting paragraph)
- definition: one precise term with a formal definition and an example
- comparison: a side-by-side table contrasting two or more things
- worked_example: a calculation or problem solved STEP BY STEP in front of students (maths, physics, statistics, accounting, finance, engineering, algorithm tracing)
${allowLiveCode ? "- code_walkthrough: a real code example explained line by line (use this for ALL programming examples)\n" : ""}- diagram: a visual of a process, architecture, hierarchy or relationships (flowchart, sequence, class, state or ER diagram)
- plot: a graph of a function or a chart of data
- summary: the final slide — key takeaways plus a quick check question

Rules:
- Aim for ${minSlides}-${maxSlides} slides; err toward MORE focused slides, never fewer. Split big topics into definition / how it works / worked example / pitfalls.
- Vary the types. Do not make every slide a "concept". Quantitative subjects must include worked_example slides; ${allowLiveCode ? "programming subjects must include code_walkthrough slides; " : ""}use a diagram or plot wherever a picture explains it faster than words.
- The first slide is a concept slide giving the overview and learning objectives; the last is a summary.
- "focus" is one sentence saying exactly what that slide must teach; "keyPoints" lists 3-6 specific facts, formulas or steps it must contain (use your own subject knowledge to add correct depth if the source is thin).
- Lecturer tone: ${toneDesc}.
- If a course code / title / unit is provided, use it as given; otherwise infer them.`;
}

const COMMON = (toneDesc, wordBudget, allowLiveCode) => `You are an expert subject-matter lecturer and instructional designer writing ONE slide of a university deck that an AI lecturer will present live, out loud. Return ONLY valid JSON for that single slide: no markdown fences, no commentary.

Global rules:
- LaTeX: write ALL mathematics as LaTeX. Inside JSON strings every backslash must be doubled (write "\\\\frac{a}{b}", "\\\\times", "\\\\theta"). In prose fields (bullets, detail, text) put inline math between single dollar signs, e.g. "$x^2$". Fields named "latex" hold raw LaTeX with NO dollar signs.
- Spoken fields ("say", "problemSay", "finalSay", "introSay") are read aloud by a voice: natural speech only, NO LaTeX, no symbols like ^ or \\, spell maths out ("x squared", "three over four").
- Be accurate. A wrong formula or wrong arithmetic in front of students is the worst failure; double-check every number.
- Tone: ${toneDesc}. Keep total narration for this slide near ${wordBudget} words.
- Fields every slide has: "type", "title", "bullets" (string[]), "detail" (string), "notes" (string: guidance to the lecturer for narrating this slide: what to emphasise, a common misconception to address; also say to keep the narration to about ${wordBudget} words).
- Optional on ANY slide: "formulas": [{ "latex": string, "caption": string }] for the key equations shown prominently.
- "concepts": 1-3 short names (2-4 words, lower case) of the ideas this slide teaches, and "prerequisites": 0-3 names of earlier concepts or common prior knowledge it relies on. Concept names are used to track each student's mastery over time, so reuse EXACTLY the same name whenever the same concept appears on several slides.
- "check": ONE multiple-choice question that tests the slide's main idea (omit it on summary slides): { "question": string (may use inline $math$), "options": exactly 4 short strings, "answer": number (0-based index of the single correct option; vary its position, do not always use 0), "explanation": string (SPOKEN aloud after the student answers: 1-2 sentences on why the answer is right and what the most tempting wrong option gets wrong; no LaTeX), "concept": string (one of this slide's concepts) }. Wrong options must be plausible, each reflecting a real misconception, never silly. Test understanding, not recall of exact wording, and make sure it can be answered from this slide's content. Double-check that the marked answer is truly correct.
${allowLiveCode ? "" : "- Do NOT include any code: this lecturer has turned off live code demos.\n"}`;

const TYPE_SPECS = {
  concept: `Type "concept": "bullets" = 5-8 substantive points of 10-20 words each (complete ideas, not fragments); "detail" = a 4-6 sentence paragraph adding real substance (background, a concrete example, why it matters), NOT a rewording of the bullets. Add "formulas" if equations belong here.`,
  definition: `Type "definition": add "definition": { "term": string, "text": string (a precise 1-3 sentence definition), "example": string (a concrete example, 1-3 sentences) }. "bullets" = 4-6 points on properties, rules or common mistakes. "detail" = a 3-5 sentence paragraph on why the idea matters.`,
  comparison: `Type "comparison": add "table": { "headers": string[] (2-4 columns, first column names the aspect), "rows": string[][] (4-8 rows, each cell under 14 words) }. "bullets" = 2-4 takeaways on when to use which. "detail" = a 3-4 sentence paragraph.`,
  worked_example: `Type "worked_example": a problem solved step by step in front of students.
 "problem": { "text": string (the problem statement; inline $math$ allowed), "latex": string (optional: the main equation as raw LaTeX) },
 "problemSay": string (spoken: read the problem aloud and say what we are going to do),
 "steps": 4-8 objects { "label": string (2-4 words, shown on screen), "say": string (spoken: 1-2 sentences saying what we do in this step and WHY), "latex": string (the equation or line of working shown after this step), "verify": { "expression": string, "expected": string } (optional) },
 "finalAnswer": { "text": string (with units), "latex": string }, "finalSay": string (spoken conclusion).
 "verify" is checked by a calculator. Include it on EVERY step that performs a numeric calculation: "expression" is a plain numeric expression using only digits, + - * / ^ ( ), sqrt(), sin(), cos(), tan(), log(), exp(), abs(), pi, e (no variables, no units, no words) and "expected" is the number that step claims. Omit "verify" for purely symbolic steps. Choose numbers that give clean results and compute them carefully.
 "bullets" = 2-4 short points on the method and when to use it. "detail" = 2-3 sentences of context.`,
  code_walkthrough: `Type "code_walkthrough": real code explained line by line.
 "code": the complete, correct, runnable, well-commented program (8-30 lines, standard syntax, no placeholders), "language": one of ${LANG_LIST}, "filename": string (e.g. "Main.java"; for Java the file name must match the public class),
 "introSay": string (spoken: one sentence introducing what the program does),
 "codeSteps": 4-10 objects { "lines": [startLine, endLine] (1-based inclusive line numbers into "code"), "say": string (spoken: explain exactly those lines and why) } in top-to-bottom order covering the whole program,
 "expectedOutput": string (the EXACT text the program prints when run; omit if it prints nothing; it must match the code precisely).
 "bullets" = 3-5 short points on the concepts used. "detail" = 2-4 sentences. Spoken fields must not read code symbols aloud letter by letter.`,
  diagram: `Type "diagram": "diagram": { "code": string (Mermaid source), "caption": string }.
 Mermaid rules: begin with one of: flowchart TD, flowchart LR, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram. At most 12 nodes. Put node labels containing spaces or punctuation in double quotes inside brackets, e.g. A["Read input"]. Plain ASCII only, no HTML, no style/classDef/click lines. Use \\n inside the JSON string for line breaks.
 "bullets" = 3-5 short points narrating the diagram. "detail" = 2-4 sentences. "notes" must tell the lecturer to walk through the diagram in order.`,
  plot: `Type "plot": "plot" is EITHER { "kind": "function", "expressions": [{ "expr": string, "label": string }] (1-3, variable x, syntax like x^2, sin(x), sqrt(x), exp(x), log(x), abs(x), pi), "xMin": number, "xMax": number, "yMin": number (optional), "yMax": number (optional), "caption": string } OR { "kind": "bar" | "line", "labels": string[], "series": [{ "name": string, "values": number[] }], "caption": string }.
 "bullets" = 3-5 points on what to notice. "detail" = 2-4 sentences.`,
  summary: `Type "summary": "takeaways" = 4-7 crisp sentences students should remember (no "check" field on this slide); "checkQuestion": { "question": string, "answer": string } a quick question testing the main idea; "bullets": [] is fine; "detail" = 2 sentences on what comes next or how to practise.`,
};

export function buildSlideSystemPrompt(type, { toneDesc, wordBudget, allowLiveCode }) {
  return `${COMMON(toneDesc, wordBudget, allowLiveCode)}\n${TYPE_SPECS[type] || TYPE_SPECS.concept}`;
}

function slideUserPrompt({ settings, outline, index, rawUnits }) {
  const o = outline.slides[index];
  return `Course: ${outline.code} — ${outline.title}
Session: ${outline.unit}
Whole deck outline: ${outline.slides.map((s, i) => `${i + 1}. ${s.title} [${s.type}]`).join("  |  ")}

Write slide ${index + 1} of ${outline.slides.length}: "${o.title}" (type: ${o.type}).
Purpose: ${o.focus}
It must contain: ${o.keyPoints.join("; ")}
${index > 0 ? `Previous slide: "${outline.slides[index - 1].title}". Do not repeat it; build on it.\n` : ""}
Source material (use it, and add correct depth from your own subject knowledge where it is thin):

${sourceDigest(rawUnits)}`;
}

function parseOutline(raw, allowLiveCode) {
  const data = parseJsonLoose(raw);
  if (!data || !Array.isArray(data.slides) || data.slides.length === 0) throw new Error("outline has no slides");
  const slides = data.slides.map((s, i) => {
    let type = SLIDE_TYPES.includes(s && s.type) ? s.type : "concept";
    if (!allowLiveCode && type === "code_walkthrough") type = "concept";
    return {
      title: String((s && s.title) || `Slide ${i + 1}`).trim(),
      type,
      focus: String((s && s.focus) || "").trim(),
      keyPoints: Array.isArray(s && s.keyPoints) ? s.keyPoints.map(String).filter(Boolean) : [],
    };
  });
  return { code: data.code || "COURSE 000", title: data.title || "Untitled Course", unit: data.unit || "Session", slides };
}

async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

async function callJson(callAI, system, prompt, maxTokens, model) {
  const raw = await callAI(system, prompt, maxTokens, model);
  if (!raw) throw new Error("empty AI response");
  return parseJsonLoose(raw);
}

export async function buildSlide({ callAI, model, outline, index, rawUnits, settings, toneDesc, wordBudget, allowLiveCode, deps }) {
  const o = outline.slides[index];
  const system = buildSlideSystemPrompt(o.type, { toneDesc, wordBudget, allowLiveCode });
  const prompt = slideUserPrompt({ settings, outline, index, rawUnits });
  let slide = null;
  const sleep = (deps && deps.sleep) || defaultSleep;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length && !slide; attempt++) {
    if (RETRY_DELAYS_MS[attempt]) await sleep(RETRY_DELAYS_MS[attempt]);
    try {
      const data = await callJson(callAI, system, prompt, 7000, model);
      slide = normalizeSlide({ ...data, type: o.type, title: data.title || o.title }, index);
    } catch (e) {
      slide = null;
    }
  }
  if (!slide) {
    return {
      ...normalizeSlide({ type: "concept", title: o.title, bullets: o.keyPoints, detail: o.focus, notes: `Teach: ${o.focus}. Cover: ${o.keyPoints.join("; ")}.` }, index),
      warnings: ["The AI couldn't write this slide in full. Edit it, or generate again."],
    };
  }
  // validate -> one AI repair round -> strip whatever is still broken
  let { slide: checked, issues } = await validateSlide(slide, deps);
  if (issues.length) {
    try {
      const fixed = await callJson(
        callAI,
        system,
        `Here is the slide you wrote:\n${JSON.stringify(slide)}\n\nAutomatic checks found these problems:\n- ${issues.join("\n- ")}\n\nReturn the COMPLETE corrected slide as JSON in the same format, fixing every listed problem (recompute any wrong arithmetic carefully; fix invalid LaTeX or Mermaid syntax). Do not change anything else.`,
        7000,
        model
      );
      const repaired = normalizeSlide({ ...fixed, type: o.type, title: fixed.title || o.title }, index);
      const again = await validateSlide(repaired, deps);
      if (again.issues.length <= issues.length) {
        checked = again.slide;
        issues = again.issues;
      }
    } catch (e) {
      /* keep the original and fall through to stripping */
    }
  }
  if (issues.length) return stripBrokenContent(checked, issues);
  const { warnings, ...clean } = checked;
  return clean;
}

export async function generateDeck({ rawUnits, settings, toneDesc, allowLiveCode, callAI, model, computeWordBudget, onProgress, deps }) {
  const say = (m) => onProgress && onProgress(m);
  say("Planning the lecture outline…");
  const sleep = (deps && deps.sleep) || defaultSleep;
  const outlineSystem = buildOutlinePrompt({ settings, toneDesc, allowLiveCode });
  const outlineUser = `Course code: ${settings.courseCode || "(infer from content)"}
Course title: ${settings.courseTitle || "(infer from content)"}
Session / unit title: ${settings.unitTitle || "(infer from content)"}
Target total lecture length: ${settings.durationMinutes} minutes.

Source material, in order:

${sourceDigest(rawUnits, 30000)}`;
  let outline = null;
  let outlineError = null;
  for (let attempt = 0; attempt < 3 && !outline; attempt++) {
    if (attempt) await sleep(attempt === 1 ? 5000 : 12000);
    try {
      const outlineRaw = await callAI(outlineSystem, outlineUser, 6000, model);
      if (!outlineRaw) throw new Error("No response from the AI — check your connection and try again.");
      outline = parseOutline(outlineRaw, allowLiveCode);
    } catch (e) {
      outlineError = e;
    }
  }
  if (!outline) throw outlineError || new Error("Couldn't plan the outline.");
  const wordBudget = computeWordBudget(settings.durationMinutes, outline.slides.length, settings.pace);

  let done = 0;
  say(`Writing slide 1 of ${outline.slides.length}…`);
  const slides = await pool(outline.slides, 2, async (o, i) => {
    const s = await buildSlide({ callAI, model, outline, index: i, rawUnits, settings, toneDesc, wordBudget, allowLiveCode, deps });
    done += 1;
    say(`Wrote ${done} of ${outline.slides.length} slides — checking maths & diagrams…`);
    return s;
  });
  return { code: outline.code, title: outline.title, unit: outline.unit, slides };
}
