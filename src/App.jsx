import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic, MicOff, Hand, MessageSquare, PhoneOff, Code2, PresentationIcon, Send,
  ChevronRight, ChevronLeft, Video, VideoOff, Loader2, Volume2, Upload,
  Sparkles, Trash2, ArrowRight, GraduationCap, Users, Settings2, RotateCcw,
  AlertTriangle, Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// No npm install needed for PPTX/PDF parsing below — it's implemented with
// zero external dependencies (no jszip, no pdfjs-dist), only native browser
// APIs. This keeps the file runnable both in a normal React project and
// inside sandboxed artifact previews that only allow a fixed library list.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DEMO CURRICULUM — used until a lecturer generates a real one, and as the
// "just show me something" fallback from the setup screen.
// ---------------------------------------------------------------------------
const DEFAULT_CURRICULUM = {
  code: "TDIT 214",
  title: "Object-Oriented Programming with Java I",
  unit: "Module 1 — Introduction to Java",
  slides: [
    {
      title: "What is Java?",
      bullets: [
        "A general-purpose, object-oriented programming language",
        "\"Write once, run anywhere\" — runs on the Java Virtual Machine (JVM)",
        "Used for web backends, Android apps, enterprise systems",
      ],
      notes:
        "Explain what Java is, why it was designed to be platform-independent, and what the JVM does in plain terms a first-year student would understand. Be warm and conversational, like a lecturer speaking out loud, not a textbook.",
      hasCode: false,
    },
    {
      title: "Setting Up: JDK & Compiling",
      bullets: [
        "JDK = Java Development Kit (compiler + tools)",
        "javac compiles .java files into .class bytecode",
        "java runs the compiled bytecode on the JVM",
      ],
      notes:
        "Explain the compile-then-run workflow for Java (javac then java) and what bytecode is, in plain simple terms. Conversational lecturer tone.",
      hasCode: false,
    },
    {
      title: "Your First Program",
      bullets: [
        "Every Java app needs a class with a main method",
        "public static void main(String[] args) is the entry point",
        "System.out.println() prints to the console",
      ],
      notes:
        "Walk the student through the classic HelloWorld.java program shown in the code editor. Explain what 'public class', 'public static void main', and 'System.out.println' each do, briefly, like you're pointing at the code while talking. Conversational lecturer tone.",
      hasCode: true,
      code: `public class HelloWorld {
    public static void main(String[] args) {
        // Prints a message to the console
        System.out.println("Hello, world!");
    }
}`,
    },
  ],
};

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// A COURSE holds the lecturer's persona (tone, voice) and identity (code,
// title, institution) — things that should stay consistent across every
// session. A MODULE is one uploaded/generated set of slides — one lecture's
// worth of content — saved independently so a lecturer can come back later
// and add more without redoing any of this. Neither is persisted beyond
// this browser tab/session; there's no backend here, only in-memory state.
const DEFAULT_COURSE = {
  id: "course-demo",
  code: "TDIT 214",
  title: "Object-Oriented Programming with Java I",
  institution: "",
  tone: "conversational",
  voiceProvider: "browser",
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "",
  modules: [
    {
      id: "module-demo",
      unit: "Module 1 — Introduction to Java",
      durationMinutes: 45,
      pace: "standard",
      allowLiveCode: true,
      slides: DEFAULT_CURRICULUM.slides,
      createdAt: Date.now(),
    },
  ],
};

// Flattens a (course, module) pair into the {curriculum, settings} shape
// LectureRoom already expects — course fields carry the lecturer's
// persona/voice, module fields carry this specific session's content/pacing.
function buildRoomData(course, module) {
  return {
    curriculum: { code: course.code, title: course.title, unit: module.unit, slides: module.slides },
    settings: {
      courseCode: course.code,
      courseTitle: course.title,
      unitTitle: module.unit,
      institution: course.institution,
      durationMinutes: module.durationMinutes,
      pace: module.pace,
      tone: course.tone,
      allowLiveCode: module.allowLiveCode,
      voiceProvider: course.voiceProvider,
      elevenLabsApiKey: course.elevenLabsApiKey,
      elevenLabsVoiceId: course.elevenLabsVoiceId,
    },
  };
}

const DEFAULT_MODULE_DRAFT_SETTINGS = { unitTitle: "", durationMinutes: 45, pace: "standard", allowLiveCode: true };

// Shared across every prompt whose output gets spoken aloud. The single
// biggest thing that makes generated lecture text sound "read aloud" rather
// than "spoken" is uniform sentence length and zero verbal filler — real
// lecturers vary their rhythm, think out loud occasionally, and contract
// words. This nudges the model that direction without making it sloppy.
const NATURAL_SPEECH_STYLE = `Write exactly as you'd actually say it out loud, not as prose to be read. Use contractions (it's, we're, let's, don't). Vary sentence length — mix short punchy sentences with longer ones, the way real speech flows, instead of uniform textbook sentences. It's fine to think out loud occasionally ("so", "now", "here's the thing") but don't overdo it — one or two per response, not one per sentence. Never use markdown, bullet points, headers, or asterisks — this is spoken text only.`;

// ---------------------------------------------------------------------------
// Pacing & tone — these aren't cosmetic. They compute an actual word budget
// that gets fed into every system prompt at lecture time, so "45 minutes,
// concise" really does produce shorter explanations than "90 minutes, deep".
// ---------------------------------------------------------------------------
const PACE_OPTIONS = [
  { id: "concise", label: "Concise", hint: "Hit the key points fast, minimal tangents" },
  { id: "standard", label: "Standard", hint: "Balanced explanation with one worked example" },
  { id: "deep", label: "In-depth", hint: "Slower pace, more context and examples" },
];
// Base spoken length per slide at "normal" pacing (~5 min of lecture time
// per slide). Pace shifts this up/down directly; duration/slide-count only
// nudges it, because each slide explanation is ONE uninterrupted TTS block
// here, not a multi-minute monologue — dividing total minutes evenly across
// slides produces numbers meant for a continuous lecture, not one utterance.
const PACE_BASE_WORDS = { concise: 70, standard: 110, deep: 160 };

const TONE_OPTIONS = [
  { id: "conversational", label: "Conversational", desc: "warm, informal, and approachable — like chatting with students, not reading a script" },
  { id: "formal", label: "Formal", desc: "precise, formal, and academically rigorous" },
  { id: "energetic", label: "Energetic", desc: "upbeat, enthusiastic, and encouraging" },
];

const AVG_SPEAKING_WPM = 165;
const REFERENCE_MINUTES_PER_SLIDE = 5;

function computeWordBudget(durationMinutes, slideCount, pace) {
  const base = PACE_BASE_WORDS[pace] || PACE_BASE_WORDS.standard;
  const avgMinutesPerSlide = Math.max(0.1, Number(durationMinutes) || 45) / Math.max(1, slideCount);
  const densityFactor = Math.min(1.6, Math.max(0.6, avgMinutesPerSlide / REFERENCE_MINUTES_PER_SLIDE));
  return Math.round(Math.min(200, Math.max(50, base * densityFactor)));
}

// ---------------------------------------------------------------------------
// Claude API helper — shared "brain" for both curriculum generation and the
// live lecture (explanations + Q&A).
// ---------------------------------------------------------------------------
// Browsers require a real user gesture before they'll let JS-triggered
// audio play. A click (Join / Launch) qualifies; an autopilot loop that
// starts itself from a useEffect after that click has already returned
// does NOT, in most browsers, and will be silently blocked. Call this from
// an actual onClick handler to "warm up" both audio paths for the rest of
// the session — a near-silent utterance unlocks speechSynthesis, and a
// muted play() unlocks HTMLMediaElement autoplay for later Audio() objects
// (ElevenLabs playback) that aren't themselves triggered by a click.
function primeAudioForVoice() {
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    }
  } catch (e) {
    /* best-effort */
  }
  try {
    const a = new Audio();
    a.muted = true;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// PERSISTENCE — optional Supabase backend. Fill these in with your own
// project's URL and anon/publishable key (Project Settings > API in the
// Supabase dashboard) to make courses/modules survive a page refresh. Leave
// them blank and the app works exactly as before — everything in-memory,
// gone on refresh — so this is safe to leave unconfigured.
//
// Implemented as plain fetch() calls against Supabase's auto-generated
// PostgREST REST API rather than the @supabase/supabase-js SDK, for the
// same reason the PPTX/PDF parsing has no dependencies: no npm install
// step, and it still works inside sandboxed previews that only allow a
// fixed library list.
//
// SECURITY NOTE: an ElevenLabs API key is never written to the database.
// Course rows are readable by anyone with the anon key (that's how
// students' Join screen lists them) — persisting a secret key there would
// leak it to every visitor. Voice provider + voice ID are safe to store;
// the actual key stays local to the browser tab that entered it and must
// be re-entered after a refresh. A production version of this would proxy
// TTS calls through a server function instead, so the key never reaches
// the client at all.
// ---------------------------------------------------------------------------
const SUPABASE_URL = "https://rodwpttdegrfwqioyoci.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZHdwdHRkZWdyZndxaW95b2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDQwOTYsImV4cCI6MjEwMDQyMDA5Nn0.clDK1TdN36pyrKltE0PrY3Q_QdwMcZoOA4mskyI38hQ";

const supabaseEnabled = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

async function supabaseRequest(path, options = {}, accessToken = null) {
  // Reads and anonymous writes use the anon key. Authenticated writes (course/
  // module create/update) need the LECTURER'S OWN session token here instead —
  // that's what lets Postgres RLS resolve auth.uid() to the right user and
  // enforce "you can only write your own courses." The anon key alone always
  // resolves auth.uid() to null, which is why RLS treats it as anonymous.
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

// ---------------------------------------------------------------------------
// Supabase Auth (GoTrue) — plain REST calls, same no-SDK approach as the
// database layer. Email/password only for now; the goal here is just
// "lecturers are uniquely identified and own their own courses," not a full
// account system.
// ---------------------------------------------------------------------------
async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.msg || data.error_description || data.error || `Auth request failed (${res.status})`);
  }
  return data;
}

async function signUpLecturer(email, password) {
  const data = await authRequest("/signup", { email, password });
  // If email confirmation is required, Supabase returns a user object with
  // no access_token yet — the account exists but can't sign in until
  // confirmed. Both cases are handled by the caller.
  return data.access_token
    ? { session: toSession(data), needsConfirmation: false }
    : { session: null, needsConfirmation: true };
}

async function signInLecturer(email, password) {
  const data = await authRequest("/token?grant_type=password", { email, password });
  return toSession(data);
}

async function refreshLecturerSession(refreshToken) {
  const data = await authRequest("/token?grant_type=refresh_token", { refresh_token: refreshToken });
  return toSession(data);
}

async function signOutLecturer(accessToken) {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    /* best-effort — clearing local session is what actually matters */
  }
}

function toSession(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: { id: data.user.id, email: data.user.email },
  };
}

// Session persistence. This only matters for the real deployed app (a
// browser tab, not the Claude.ai artifact preview, where localStorage isn't
// available) — wrapped defensively so it degrades to "just sign in again"
// rather than crashing if storage is blocked or unavailable.
const SESSION_STORAGE_KEY = "semai_lecturer_session";
function saveSessionLocally(session) {
  try {
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    /* storage unavailable — session just won't survive a refresh */
  }
}
function loadSessionLocally() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function fetchCoursesFromSupabase() {
  const [courseRows, moduleRows] = await Promise.all([
    supabaseRequest("/courses?select=*&order=created_at.asc"),
    supabaseRequest("/modules?select=*&order=created_at.asc"),
  ]);
  return courseRows.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    institution: c.institution || "",
    tone: c.tone,
    voiceProvider: c.voice_provider,
    elevenLabsApiKey: "", // deliberately never fetched — see security note above
    elevenLabsVoiceId: c.elevenlabs_voice_id || "",
    ownerId: c.owner_id || null,
    modules: moduleRows
      .filter((m) => m.course_id === c.id)
      .map((m) => ({
        id: m.id,
        unit: m.unit,
        durationMinutes: m.duration_minutes,
        pace: m.pace,
        allowLiveCode: m.allow_live_code,
        slides: m.slides,
        createdAt: new Date(m.created_at).getTime(),
      })),
  }));
}

async function saveCourseToSupabase(course, accessToken) {
  await supabaseRequest(
    "/courses",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          id: course.id,
          code: course.code,
          title: course.title,
          institution: course.institution || null,
          tone: course.tone,
          voice_provider: course.voiceProvider,
          elevenlabs_voice_id: course.elevenLabsVoiceId || null,
          owner_id: course.ownerId,
        },
      ]),
    },
    accessToken
  );
}

async function saveModuleToSupabase(courseId, module, accessToken) {
  await supabaseRequest(
    "/modules",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: module.id,
          course_id: courseId,
          unit: module.unit,
          duration_minutes: module.durationMinutes,
          pace: module.pace,
          allow_live_code: module.allowLiveCode,
          slides: module.slides,
        },
      ]),
    },
    accessToken
  );
}

// ---------------------------------------------------------------------------
// AI backend. Fill AI_PROXY_URL in with your own server-side proxy (see
// supabase/functions/claude-proxy in the deployment package) to make this
// work outside the Claude.ai artifact preview. Left blank, it calls
// api.anthropic.com directly with no key attached — that ONLY works inside
// this chat's artifact preview, where Anthropic's own infrastructure
// authenticates the request invisibly. A real deployed site has no such
// thing, and a raw Anthropic API key must never be embedded in browser
// code (unlike the Supabase anon key, it isn't protected by anything like
// Row Level Security — anyone who reads it from your deployed site's
// network requests could run up charges on your account).
// ---------------------------------------------------------------------------
const AI_PROXY_URL =
  "https://rodwpttdegrfwqioyoci.supabase.co/functions/v1/gemini-proxy";

async function callGemini(systemPrompt, userPrompt) {
  const response = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      // Supabase Edge Function authentication
      ...(SUPABASE_ANON_KEY
        ? {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          }
        : {}),
    },
    body: JSON.stringify({
      systemPrompt,
      userPrompt,
    }),
  });

  const data = await response.json();

  if (data && data.rateLimited) {
    const err = new Error("AI provider is rate-limited right now.");
    err.rateLimited = true;
    throw err;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `AI request failed (${response.status})`
    );
  }

  // If the Edge Function returns a simple { text: "..." }
  if (typeof data.text === "string") {
    return data.text.trim();
  }

  // If the Edge Function returns Gemini's native response
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  return text;
}
// Very small Java syntax highlighter — good enough for a skeleton IDE pane.
function highlightJava(code) {
  const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const KEYWORDS = /\b(public|private|protected|class|static|void|main|String|new|return|if|else|for|while|int|double|boolean|import|package)\b/g;
  return escaped
    .replace(/(\/\/.*)/g, '<span class="tok-comment">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="tok-string">$1</span>')
    .replace(KEYWORDS, '<span class="tok-keyword">$1</span>');
}

// ---------------------------------------------------------------------------
// INGESTION — turn an uploaded file into an ordered list of raw text "units"
// (one per slide or page). This is the part that was entirely missing
// before: a real path from "lecturer's own file" to structured content.
//
// .pptx and .pdf parsing below are implemented with zero external
// dependencies (no jszip, no pdfjs-dist) — just native browser APIs
// (DataView, DecompressionStream, DOMParser, TextDecoder) — so this file
// has no npm install step and works inside sandboxed artifact previews
// that only allow a fixed set of libraries.
// ---------------------------------------------------------------------------

// .pptx is a zip file. Rather than pull in a zip library, we read the
// central directory ourselves (it's a small, simple binary format) and
// decompress each entry we need with the native Compression Streams API.
async function readZipEntries(bytes, filterFn) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  const searchStart = Math.max(0, bytes.length - 22 - 65536);
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Not a valid .pptx file (couldn't find its zip directory) — is it corrupted or actually a different format?");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const results = {};
  let ptr = cdOffset;
  const CFH_SIG = 0x02014b50;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(ptr, true) !== CFH_SIG) break;
    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(bytes.slice(ptr + 46, ptr + 46 + nameLen));

    if (filterFn(name)) {
      const lfNameLen = view.getUint16(localHeaderOffset + 26, true);
      const lfExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen;
      results[name] = { compressionMethod, data: bytes.slice(dataStart, dataStart + compressedSize) };
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return results;
}

async function inflateZipEntry(entry) {
  if (entry.compressionMethod === 0) return entry.data; // stored, no compression
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([entry.data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractPptxUnits(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await readZipEntries(bytes, (name) =>
    /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(name)
  );

  const slideNums = Object.keys(entries)
    .map((name) => name.match(/^ppt\/slides\/slide(\d+)\.xml$/))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10))
    .sort((a, b) => a - b);

  if (slideNums.length === 0) {
    throw new Error("Couldn't find any slides in that .pptx — is the file corrupted or password-protected?");
  }

  const parser = new DOMParser();
  const readTextRuns = async (path) => {
    const entry = entries[path];
    if (!entry) return "";
    const xmlBytes = await inflateZipEntry(entry);
    const xml = new TextDecoder().decode(xmlBytes);
    const doc = parser.parseFromString(xml, "application/xml");
    return Array.from(doc.getElementsByTagName("a:t"))
      .map((n) => n.textContent)
      .join("\n")
      .trim();
  };

  const units = [];
  for (const n of slideNums) {
    const slideText = await readTextRuns(`ppt/slides/slide${n}.xml`);
    // Speaker notes are gold here — they're often literally what the
    // lecturer intends to say, which beats us guessing from bullets alone.
    const notesText = await readTextRuns(`ppt/notesSlides/notesSlide${n}.xml`);
    const combined = [
      slideText && `[Slide ${n} content]\n${slideText}`,
      notesText && `[Speaker notes for slide ${n}]\n${notesText}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (combined.trim()) units.push(combined);
  }

  if (units.length === 0) {
    throw new Error("That .pptx has slides but no readable text — image-only slides aren't supported yet.");
  }
  return units;
}

async function inflateZlib(bytes) {
  const ds = new DecompressionStream("deflate");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Byte-sequence search (ASCII needle) — deliberately NOT done via string
// decode/re-encode. TextDecoder("latin1") is actually windows-1252 per the
// WHATWG spec, which remaps several high bytes to different Unicode
// codepoints. Position alignment survives that (still 1 byte in -> 1 char
// out), but VALUE does not — so any code that tried to reconstruct raw
// bytes from decoded characters would silently corrupt binary stream data.
// We sidestep the issue entirely by searching raw bytes directly and only
// decoding to string for content we intend to read, never to rebuild.
function indexOfBytes(haystack, needleStr, fromIndex = 0) {
  const n = needleStr.length;
  const end = haystack.length - n;
  outer: for (let i = Math.max(0, fromIndex); i <= end; i++) {
    for (let j = 0; j < n; j++) {
      if (haystack[i + j] !== needleStr.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

function hexToUnicodeString(hex) {
  let s = "";
  for (let i = 0; i < hex.length; i += 4) {
    const codeUnit = parseInt(hex.slice(i, i + 4), 16);
    if (!isNaN(codeUnit)) s += String.fromCharCode(codeUnit);
  }
  return s;
}

function parseCMapStream(text) {
  const map = new Map();
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let m;
  while ((m = bfcharRe.exec(text)) !== null) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pairRe.exec(m[1])) !== null) map.set(p[1].toUpperCase().padStart(4, "0"), hexToUnicodeString(p[2]));
  }
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRe.exec(text)) !== null) {
    const simpleRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = simpleRe.exec(m[1])) !== null) {
      const start = parseInt(p[1], 16), end = parseInt(p[2], 16), dstStart = parseInt(p[3], 16);
      const codeLen = p[1].length;
      for (let c = start; c <= end && c - start < 65536; c++) {
        const code = c.toString(16).toUpperCase().padStart(codeLen, "0").padStart(4, "0");
        const dst = (dstStart + (c - start)).toString(16).toUpperCase().padStart(p[3].length, "0");
        map.set(code, hexToUnicodeString(dst));
      }
    }
  }
  return map;
}

// Merges every /ToUnicode CMap found in the document into one lookup table.
// Deliberate simplification: correctly scoping each CMap to the specific
// font that uses it requires resolving the page/resource/font object graph,
// which this lightweight parser doesn't do. With multiple embedded fonts
// whose glyph codes overlap (common — subset fonts often number from 1),
// this can occasionally misattribute a character. Good enough to recover
// real words from most single/few-font slide decks; not a substitute for a
// real PDF text layer.
async function buildGlobalCMap(bytes) {
  const map = new Map();
  let searchFrom = 0;
  while (true) {
    const idx = indexOfBytes(bytes, "/ToUnicode", searchFrom);
    if (idx === -1) break;
    const tail = new TextDecoder("latin1").decode(bytes.slice(idx + 10, idx + 40));
    const refMatch = tail.match(/^\s*(\d+)\s+\d+\s+R/);
    if (refMatch) {
      const objIdx = indexOfBytes(bytes, `${refMatch[1]} 0 obj`, 0);
      if (objIdx !== -1) {
        const streamIdx = indexOfBytes(bytes, "stream", objIdx);
        const endObjIdx = indexOfBytes(bytes, "endobj", objIdx);
        if (streamIdx !== -1 && (endObjIdx === -1 || streamIdx < endObjIdx)) {
          let dataStart = streamIdx + 6;
          if (bytes[dataStart] === 13) dataStart++;
          if (bytes[dataStart] === 10) dataStart++;
          const endIdx = indexOfBytes(bytes, "endstream", dataStart);
          if (endIdx !== -1) {
            let dataEnd = endIdx;
            while (dataEnd > dataStart && (bytes[dataEnd - 1] === 10 || bytes[dataEnd - 1] === 13)) dataEnd--;
            let decoded;
            try {
              decoded = await inflateZlib(bytes.slice(dataStart, dataEnd));
            } catch {
              decoded = bytes.slice(dataStart, dataEnd);
            }
            const text = new TextDecoder("latin1").decode(decoded);
            for (const [k, v] of parseCMapStream(text)) if (!map.has(k)) map.set(k, v);
          }
        }
      }
    }
    searchFrom = idx + 10;
  }
  return map;
}

function decodeHexGlyphs(hex, cmap) {
  if (!cmap || cmap.size === 0) {
    let s = "";
    for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) || 0);
    return s;
  }
  const countHits = (width) => {
    let hits = 0;
    for (let i = 0; i + width <= hex.length; i += width) if (cmap.has(hex.slice(i, i + width).toUpperCase().padStart(4, "0"))) hits++;
    return hits;
  };
  const width = countHits(4) >= countHits(2) ? 4 : 2;
  let s = "";
  for (let i = 0; i < hex.length; i += width) {
    s += cmap.get(hex.slice(i, i + width).toUpperCase().padStart(4, "0")) || "";
  }
  return s;
}

function unescapePdfString(s) {
  return s
    .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
}

function extractShownStrings(contentStr, cmap) {
  const out = [];
  const literalRe = /\(((?:\\.|[^()\\])*)\)\s*(Tj|'|")/g;
  let m;
  while ((m = literalRe.exec(contentStr)) !== null) out.push(unescapePdfString(m[1]));

  const hexTjRe = /<([0-9A-Fa-f]+)>\s*(Tj|'|")/g;
  while ((m = hexTjRe.exec(contentStr)) !== null) out.push(decodeHexGlyphs(m[1], cmap));

  const arrayRe = /\[((?:[^\[\]])*)\]\s*TJ/g;
  while ((m = arrayRe.exec(contentStr)) !== null) {
    const partRe = /\(((?:\\.|[^()\\])*)\)|<([0-9A-Fa-f]+)>/g;
    let p, piece = "";
    while ((p = partRe.exec(m[1])) !== null) {
      if (p[1] !== undefined) piece += unescapePdfString(p[1]);
      else if (p[2] !== undefined) piece += decodeHexGlyphs(p[2], cmap);
    }
    if (piece) out.push(piece);
  }
  return out.join(" ");
}

// Drops streams our regex parser misidentified as text — most often a raw
// embedded font program whose bytes happened to coincidentally match a
// Tj/TJ pattern.
function looksLikeText(s) {
  if (!s || s.trim().length < 3) return false;
  const readable = (s.match(/[A-Za-z0-9 .,!?;:()'"\-]/g) || []).length;
  return readable / s.length > 0.6;
}

async function extractPdfUnits(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const cmap = await buildGlobalCMap(bytes);
  const units = [];
  let searchFrom = 0;

  while (true) {
    const streamIdx = indexOfBytes(bytes, "stream", searchFrom);
    if (streamIdx === -1) break;
    let dataStart = streamIdx + 6;
    if (bytes[dataStart] === 13) dataStart++;
    if (bytes[dataStart] === 10) dataStart++;

    const endIdx = indexOfBytes(bytes, "endstream", dataStart);
    if (endIdx === -1) break;
    let dataEnd = endIdx;
    while (dataEnd > dataStart && (bytes[dataEnd - 1] === 10 || bytes[dataEnd - 1] === 13)) dataEnd--;

    const rawBytes = bytes.slice(dataStart, dataEnd);
    let decoded;
    try {
      decoded = await inflateZlib(rawBytes);
    } catch {
      decoded = rawBytes; // not flate-compressed, or a binary (image/font) stream we can't use anyway
    }
    const contentStr = new TextDecoder("latin1").decode(decoded);
    const text = extractShownStrings(contentStr, cmap);
    if (looksLikeText(text)) units.push(text.trim());

    searchFrom = endIdx + 9;
  }

  if (units.length === 0) {
    throw new Error("Couldn't extract readable text from this PDF — it may be scanned images or use an encoding this lightweight parser can't handle. Try pasting the outline as text, or upload the original .pptx if you have it.");
  }
  return units;
}

async function extractRawUnits(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pptx")) return extractPptxUnits(file);
  if (name.endsWith(".pdf")) return extractPdfUnits(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    const units = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    return units.length ? units : [text.trim()];
  }
  if (name.endsWith(".ppt") || name.endsWith(".doc")) {
    throw new Error("Old .ppt/.doc formats aren't supported — please save as .pptx, .pdf, or plain text.");
  }
  throw new Error("Unsupported file type — upload a .pptx, .pdf, .txt, or .md file, or paste your outline instead.");
}

// ---------------------------------------------------------------------------
// AI curriculum structuring — raw units + lecturer settings -> the
// {code, title, unit, slides[]} shape the lecture room actually runs on.
// ---------------------------------------------------------------------------
function buildCurriculumSystemPrompt(settings, estimatedWordBudget) {
  const tone = TONE_OPTIONS.find((t) => t.id === settings.tone) || TONE_OPTIONS[0];
  return `You are an expert instructional designer. You convert raw lecture material (slide text, speaker notes, or an outline) into structured JSON for an AI that will deliver a LIVE, SPOKEN lecture from it.

Return ONLY valid JSON. No markdown code fences, no commentary before or after.

Schema:
{
  "code": string,        // course code, e.g. "TDIT 214" — infer from context if not given
  "title": string,       // course title
  "unit": string,        // this specific session/unit title
  "slides": [
    {
      "title": string,
      "bullets": string[],      // 2-5 short bullets, what appears on screen (under 12 words each)
      "notes": string,          // INSTRUCTIONS to the AI lecturer for how to narrate this slide out loud (not the narration itself) — what to cover, in what order, any example to use. Written as guidance, e.g. "Explain X, then contrast it with Y using a short example."
      "hasCode": boolean,
      "code": string | null     // only if hasCode is true — a clean, correct, well-commented runnable code example
    }
  ]
}

Rules:
- Segment the source material into a sensible number of slides. Don't force a 1-to-1 mapping if a source unit is too dense (split it) or too sparse (merge it with a neighbor).
- Every "notes" field must explicitly tell the lecturer to keep the spoken explanation to about ${estimatedWordBudget} words — adjust proportionally if your final slide count differs noticeably from the source unit count.
- The lecturer's tone should be ${tone.desc}.
- If a slide teaches a code example, set hasCode true, put the exact code in "code", and have "notes" instruct the lecturer to narrate it roughly top-to-bottom as if typing it live.
${settings.allowLiveCode ? "" : "- Do not create any code slides (hasCode must be false everywhere) — this lecturer has turned off live code demos.\n"}- If course code / title / unit were provided below, use them as given rather than inventing new ones.`;
}

function parseCurriculumJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("The AI's response wasn't valid JSON — try generating again.");
  }
  if (!data || !Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error("Generated curriculum has no slides — try again, or paste more detailed source material.");
  }
  return {
    code: data.code || "COURSE 000",
    title: data.title || "Untitled Course",
    unit: data.unit || "Session",
    slides: data.slides.map((s, i) => ({
      title: s.title || `Slide ${i + 1}`,
      bullets: Array.isArray(s.bullets) ? s.bullets.filter(Boolean) : [],
      notes: s.notes || "",
      hasCode: !!(s.hasCode && s.code),
      code: s.hasCode ? (s.code || "") : undefined,
    })),
  };
}

async function generateCurriculum(rawUnits, settings) {
  const estimatedBudget = computeWordBudget(settings.durationMinutes, Math.max(1, rawUnits.length), settings.pace);
  const system = buildCurriculumSystemPrompt(settings, estimatedBudget);
  const user = `Course code: ${settings.courseCode || "(infer from content)"}
Course title: ${settings.courseTitle || "(infer from content)"}
Session / unit title: ${settings.unitTitle || "(infer from content)"}
Target total lecture length: ${settings.durationMinutes} minutes.

Source material, in order:

${rawUnits.map((u, i) => `--- Unit ${i + 1} ---\n${u}`).join("\n\n")}`;
  const raw = await callClaude(system, user);
  if (!raw) throw new Error("No response from the AI — check your connection and try again.");
  return parseCurriculumJSON(raw);
}

// ---------------------------------------------------------------------------
// Role select
// ---------------------------------------------------------------------------
function RoleSelectScreen({ onSelectRole }) {
  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-eyebrow">SEMAI</div>
        <h1 className="join-title">Who's joining?</h1>
        <p className="join-sub">Lecturers build the session. Students attend it.</p>
        <button className="join-btn" onClick={() => onSelectRole("lecturer")}>
          <GraduationCap size={16} /> I'm the lecturer — build a session
        </button>
        <button className="join-btn secondary" onClick={() => onSelectRole("student")}>
          <Users size={16} /> I'm a student — join a session
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lecturer authentication — email/password via Supabase Auth REST calls.
// This is what makes "owner_id = auth.uid()" in the RLS policies mean
// anything: without a real signed-in user, there's no identity for the
// database to scope writes to.
// ---------------------------------------------------------------------------
function AuthScreen({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmNotice, setConfirmNotice] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter an email and password.");
      return;
    }
    setError("");
    setConfirmNotice(false);
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await signUpLecturer(email.trim(), password);
        if (result.needsConfirmation) {
          setConfirmNotice(true);
          setBusy(false);
          return;
        }
        onAuthenticated(result.session);
      } else {
        const session = await signInLecturer(email.trim(), password);
        onAuthenticated(session);
      }
    } catch (e) {
      setError(e.message || "Something went wrong — try again.");
      setBusy(false);
    }
  };

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-eyebrow">SEMAI · Lecturer</div>
        <h1 className="join-title">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
        <p className="join-sub">
          {mode === "signup" ? "So your courses are uniquely yours, not editable by anyone else." : "Sign in to see and manage your courses."}
        </p>

        {confirmNotice ? (
          <div className="db-status ok" style={{ display: "block", textAlign: "left" }}>
            Account created — check {email} for a confirmation link, then come back and sign in.
          </div>
        ) : (
          <>
            <input className="join-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className="join-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {error && <div className="setup-error" style={{ justifyContent: "center" }}><AlertTriangle size={13} /> {error}</div>}
            <button className="join-btn" disabled={busy} onClick={submit}>
              {busy ? <Loader2 className="spin" size={14} /> : null} {mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </>
        )}

        <button
          className="skip-link"
          onClick={() => {
            setMode((m) => (m === "signup" ? "signin" : "signup"));
            setError("");
            setConfirmNotice(false);
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        <button className="skip-link" onClick={onBack}>← Back to role select</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lecturer setup — ingestion + tuning. This is the new core of the workflow.
// ---------------------------------------------------------------------------
function CourseMetaScreen({ draft, editing, onChange, onContinue, onCancel }) {
  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="join-eyebrow">{editing ? "Edit course" : "New course"}</div>
        <h1 className="join-title">{editing ? "Course details" : "Set up your course"}</h1>
        <p className="join-sub">These apply to every module in this course — the lecturer's identity and voice stay consistent across sessions.</p>
        <button className="skip-link" onClick={onCancel}>← Back to dashboard</button>
      </div>

      <div className="setup-col narrow">
        <input className="setup-input" placeholder="Course code, e.g. TDIT 214" value={draft.code} onChange={(e) => onChange({ code: e.target.value })} />
        <input className="setup-input" placeholder="Course title" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        <input className="setup-input" placeholder="Institution (optional)" value={draft.institution} onChange={(e) => onChange({ institution: e.target.value })} />

        <div className="setup-label" style={{ marginTop: 14 }}>Tone</div>
        <div className="pill-row">
          {TONE_OPTIONS.map((t) => (
            <button key={t.id} className={`pill ${draft.tone === t.id ? "active" : ""}`} onClick={() => onChange({ tone: t.id })} title={t.desc}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="setup-label" style={{ marginTop: 18 }}>Lecturer voice</div>
        <div className="pill-row">
          <button className={`pill ${draft.voiceProvider === "browser" ? "active" : ""}`} onClick={() => onChange({ voiceProvider: "browser" })}>
            Browser (free, robotic)
          </button>
          <button className={`pill ${draft.voiceProvider === "elevenlabs" ? "active" : ""}`} onClick={() => onChange({ voiceProvider: "elevenlabs" })}>
            ElevenLabs (natural)
          </button>
        </div>
        {draft.voiceProvider === "elevenlabs" && (
          <>
            <input
              className="setup-input"
              style={{ marginTop: 8 }}
              type="password"
              placeholder="ElevenLabs API key"
              value={draft.elevenLabsApiKey}
              onChange={(e) => onChange({ elevenLabsApiKey: e.target.value })}
            />
            <input
              className="setup-input"
              placeholder="Voice ID (optional — leave blank for default)"
              value={draft.elevenLabsVoiceId}
              onChange={(e) => onChange({ elevenLabsVoiceId: e.target.value })}
            />
            <div className="setup-optional" style={{ marginTop: -2, marginBottom: 4 }}>
              Key stays in this browser tab only — it's never saved to the database (even if one's connected), only the voice selection is. You'll need to re-enter it each session. If a request ever fails, that line falls back to the browser voice automatically.
            </div>
          </>
        )}

        <button className="explain-btn" style={{ marginTop: 18 }} disabled={!draft.code.trim() || !draft.title.trim()} onClick={onContinue}>
          {editing ? "Save course details" : "Create course & add first module"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// One module = one uploaded/generated set of slides. Saving here never
// enters a live session — it just adds the module to the course so students
// can find it later, and so the lecturer can keep coming back to add more.
function ModuleSetupScreen({ course, setup, patchSetup, onSaveModule, onSaveAndPreview, onCancel }) {
  const fileInputRef = useRef(null);
  const { moduleSettings, rawText, fileName, draft, phase, error } = setup;

  const updateModuleSettings = (patch) => patchSetup({ moduleSettings: { ...moduleSettings, ...patch } });

  const generationSettings = {
    courseCode: course.code,
    courseTitle: course.title,
    tone: course.tone,
    unitTitle: moduleSettings.unitTitle,
    durationMinutes: moduleSettings.durationMinutes,
    pace: moduleSettings.pace,
    allowLiveCode: moduleSettings.allowLiveCode,
  };

  const handleFile = async (file) => {
    patchSetup({ error: "", fileName: file.name, phase: "extracting" });
    try {
      const units = await extractRawUnits(file);
      patchSetup({ rawText: units.join("\n\n"), phase: "input" });
    } catch (e) {
      patchSetup({ error: e.message || "Couldn't read that file.", phase: "input" });
    }
  };

  const handleGenerate = async () => {
    if (!rawText.trim()) {
      patchSetup({ error: "Paste your outline or upload a file first." });
      return;
    }
    patchSetup({ error: "", phase: "generating" });
    try {
      const units = rawText.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      const result = await generateCurriculum(units.length ? units : [rawText], generationSettings);
      patchSetup({ draft: result, phase: "preview" });
    } catch (e) {
      patchSetup({ error: e.message || "Generation failed — try again.", phase: "input" });
    }
  };

  const editSlide = (idx, patch) => {
    patchSetup({ draft: { ...draft, slides: draft.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)) } });
  };
  const removeSlide = (idx) => {
    patchSetup({ draft: { ...draft, slides: draft.slides.filter((_, i) => i !== idx) } });
  };

  const buildModuleObject = () => ({
    id: makeId("module"),
    unit: moduleSettings.unitTitle || draft.unit || "Untitled module",
    durationMinutes: moduleSettings.durationMinutes,
    pace: moduleSettings.pace,
    allowLiveCode: moduleSettings.allowLiveCode,
    slides: draft.slides,
    createdAt: Date.now(),
  });

  const estimatedUnitCount = Math.max(1, rawText.split(/\n{2,}/).filter((s) => s.trim()).length);
  const liveBudget = draft
    ? computeWordBudget(moduleSettings.durationMinutes, draft.slides.length, moduleSettings.pace)
    : computeWordBudget(moduleSettings.durationMinutes, estimatedUnitCount, moduleSettings.pace);

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="join-eyebrow">{course.code} · Add a module</div>
        <h1 className="join-title">{course.title}</h1>
        <p className="join-sub">Upload slides or notes for this module, tune the pacing, then review before saving. Voice and tone come from the course settings.</p>
        <button className="skip-link" onClick={onCancel}>← Back to dashboard</button>
      </div>

      {(phase === "input" || phase === "extracting" || phase === "generating") && (
        <div className="setup-grid">
          <div className="setup-col">
            <div className="setup-label">Source material</div>
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files && e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              {phase === "extracting" ? (
                <>
                  <Loader2 className="spin" size={20} />
                  <div>Reading {fileName}…</div>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <div>{fileName ? `Loaded: ${fileName} — drop another to replace` : "Drop a .pptx, .pdf, .txt, or .md file, or click to browse"}</div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx,.pdf,.txt,.md"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
            <div className="setup-or">— or paste it directly —</div>
            <textarea
              className="setup-textarea"
              placeholder="Paste your slide bullets, speaker notes, or a course outline here…"
              value={rawText}
              onChange={(e) => patchSetup({ rawText: e.target.value, fileName: "" })}
              rows={12}
            />
          </div>

          <div className="setup-col">
            <div className="setup-label">Module details <span className="setup-optional">(topic inferred if left blank)</span></div>
            <input className="setup-input" placeholder="This module's topic" value={moduleSettings.unitTitle} onChange={(e) => updateModuleSettings({ unitTitle: e.target.value })} />

            <div className="setup-label" style={{ marginTop: 18 }}><Clock size={13} /> Lecture length: {moduleSettings.durationMinutes} min</div>
            <input
              type="range" min={10} max={120} step={5}
              value={moduleSettings.durationMinutes}
              onChange={(e) => updateModuleSettings({ durationMinutes: Number(e.target.value) })}
              className="setup-slider"
            />

            <div className="setup-label" style={{ marginTop: 14 }}>Pacing</div>
            <div className="pill-row">
              {PACE_OPTIONS.map((p) => (
                <button key={p.id} className={`pill ${moduleSettings.pace === p.id ? "active" : ""}`} onClick={() => updateModuleSettings({ pace: p.id })} title={p.hint}>
                  {p.label}
                </button>
              ))}
            </div>

            <label className="setup-checkbox">
              <input type="checkbox" checked={moduleSettings.allowLiveCode} onChange={(e) => updateModuleSettings({ allowLiveCode: e.target.checked })} />
              Allow live code demo slides
            </label>

            <div className="course-context-note">
              Voice: {course.voiceProvider === "elevenlabs" ? "ElevenLabs (natural)" : "Browser"} · Tone: {TONE_OPTIONS.find((t) => t.id === course.tone)?.label} — set at the course level.
            </div>

            <div className="budget-readout">≈ {liveBudget} words per slide at this pace &amp; length</div>

            {error && <div className="setup-error"><AlertTriangle size={13} /> {error}</div>}

            <button className="explain-btn" disabled={phase === "generating"} onClick={handleGenerate}>
              {phase === "generating" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              {phase === "generating" ? "Generating curriculum…" : "Generate curriculum"}
            </button>
          </div>
        </div>
      )}

      {phase === "preview" && draft && (
        <div className="preview-wrap">
          <div className="preview-toolbar">
            <div>
              <strong>{course.code}</strong> — {draft.unit || moduleSettings.unitTitle}
            </div>
            <div className="budget-readout">≈ {computeWordBudget(moduleSettings.durationMinutes, draft.slides.length, moduleSettings.pace)} words/slide · {draft.slides.length} slides</div>
          </div>

          <div className="slide-card-list">
            {draft.slides.map((s, i) => (
              <div className="slide-card" key={i}>
                <div className="slide-card-head">
                  <input className="slide-card-title" value={s.title} onChange={(e) => editSlide(i, { title: e.target.value })} />
                  <button className="icon-btn" onClick={() => removeSlide(i)} title="Remove slide"><Trash2 size={14} /></button>
                </div>
                <textarea
                  className="slide-card-bullets"
                  rows={3}
                  value={s.bullets.join("\n")}
                  onChange={(e) => editSlide(i, { bullets: e.target.value.split("\n") })}
                  placeholder="One bullet per line…"
                />
                <textarea
                  className="slide-card-notes"
                  rows={3}
                  value={s.notes}
                  onChange={(e) => editSlide(i, { notes: e.target.value })}
                  placeholder="Narration guidance for the AI lecturer…"
                />
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={s.hasCode}
                    onChange={(e) => editSlide(i, { hasCode: e.target.checked, code: e.target.checked ? (s.code || "") : undefined })}
                  />
                  Live code demo on this slide
                </label>
                {s.hasCode && (
                  <textarea className="slide-card-code" rows={5} value={s.code || ""} onChange={(e) => editSlide(i, { code: e.target.value })} />
                )}
              </div>
            ))}
          </div>

          {error && <div className="setup-error"><AlertTriangle size={13} /> {error}</div>}

          <div className="preview-actions">
            <button className="nav-btn" onClick={() => patchSetup({ phase: "input", draft: null })}>
              <RotateCcw size={14} /> Start over
            </button>
            <div className="preview-actions-right">
              <button className="nav-btn" onClick={() => onSaveAndPreview(buildModuleObject())}>
                Save &amp; preview as student
              </button>
              <button className="explain-btn" onClick={() => onSaveModule(buildModuleObject())}>
                Save module <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Join screen (students)
// ---------------------------------------------------------------------------
// Students pick a course, then a module within it, then give their name.
// Only courses with at least one saved module show up — a course with zero
// modules is still "being built" and isn't joinable yet.
function JoinScreen({ courses, onJoin, onBack }) {
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [name, setName] = useState("");

  const joinable = courses.filter((c) => c.modules.length > 0);

  if (joinable.length === 0) {
    return (
      <div className="join-screen">
        <div className="join-card">
          <div className="join-eyebrow">SEMAI</div>
          <h1 className="join-title">No sessions yet</h1>
          <p className="join-sub">No lecturer has published a module here yet — check back soon.</p>
          <button className="skip-link" onClick={onBack}>← Back to role select</button>
        </div>
      </div>
    );
  }

  const course = joinable.length === 1 ? joinable[0] : joinable.find((c) => c.id === selectedCourseId);

  if (!course) {
    return (
      <div className="join-screen">
        <div className="join-card wide">
          <div className="join-eyebrow">SEMAI</div>
          <h1 className="join-title">Choose a course</h1>
          <div className="pick-list">
            {joinable.map((c) => (
              <button key={c.id} className="pick-row" onClick={() => setSelectedCourseId(c.id)}>
                <strong>{c.code}</strong> — {c.title} <span className="setup-optional">({c.modules.length} module{c.modules.length === 1 ? "" : "s"})</span>
              </button>
            ))}
          </div>
          <button className="skip-link" onClick={onBack}>← Back to role select</button>
        </div>
      </div>
    );
  }

  const module_ = course.modules.length === 1 ? course.modules[0] : course.modules.find((m) => m.id === selectedModuleId);

  if (!module_) {
    return (
      <div className="join-screen">
        <div className="join-card wide">
          <div className="join-eyebrow">{course.code}</div>
          <h1 className="join-title">Choose a module</h1>
          <div className="pick-list">
            {course.modules.map((m) => (
              <button key={m.id} className="pick-row" onClick={() => setSelectedModuleId(m.id)}>
                {m.unit} <span className="setup-optional">· {m.durationMinutes} min</span>
              </button>
            ))}
          </div>
          <button className="skip-link" onClick={() => (joinable.length > 1 ? setSelectedCourseId(null) : onBack())}>
            ← {joinable.length > 1 ? "Choose a different course" : "Back to role select"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-eyebrow">{course.code} · Live Session</div>
        <h1 className="join-title">{course.title}</h1>
        <p className="join-sub">{module_.unit}</p>
        <input
          className="join-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onJoin(course, module_, name)}
        />
        <button className="join-btn" disabled={!name.trim()} onClick={() => onJoin(course, module_, name)}>
          Join lecture
        </button>
        <div className="join-hint">Mic + speaker recommended. The lecturer speaks aloud and you can interrupt anytime.</div>
        <button
          className="skip-link"
          onClick={() => (course.modules.length > 1 ? setSelectedModuleId(null) : joinable.length > 1 ? setSelectedCourseId(null) : onBack())}
        >
          ← {course.modules.length > 1 ? "Choose a different module" : joinable.length > 1 ? "Choose a different course" : "Back to role select"}
        </button>
      </div>
    </div>
  );
}

// Lecturer home base: every course they've built, every module saved so
// far, and the two things a lecturer actually needs from here — add
// another module to a course, or preview one as a student would see it.
// Saving a module always lands back here, never in a live session.
function LecturerDashboard({ courses, dbStatus, lecturerEmail, onNewCourse, onEditCourse, onAddModule, onPreviewModule, onBack, onSignOut }) {
  const statusLabel = {
    connected: { text: "Connected to Supabase — courses persist across refreshes", cls: "ok" },
    loading: { text: "Connecting to Supabase…", cls: "loading" },
    error: { text: "Couldn't reach Supabase — working locally this session only", cls: "warn" },
    local: { text: "No database configured — changes are lost on refresh (see SUPABASE_URL in the code)", cls: "warn" },
  }[dbStatus];

  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="join-eyebrow">Lecturer dashboard {lecturerEmail && <span className="setup-optional">· {lecturerEmail}</span>}</div>
        <h1 className="join-title">Your courses</h1>
        <p className="join-sub">Build a course module by module. Saving publishes it for students — it won't drop you into a live session.</p>
        <div style={{ display: "flex", gap: 14 }}>
          <button className="skip-link" onClick={onBack}>← Back to role select</button>
          {onSignOut && <button className="skip-link" onClick={onSignOut}>Sign out</button>}
        </div>
      </div>

      {statusLabel && <div className={`db-status ${statusLabel.cls}`}>{statusLabel.text}</div>}

      <div className="dash-toolbar">
        <button className="explain-btn" onClick={onNewCourse}><Sparkles size={14} /> New course</button>
      </div>

      {courses.length === 0 && <div className="empty-hint">No courses yet — create one to get started.</div>}

      <div className="course-list">
        {courses.map((course) => (
          <div className="course-card" key={course.id}>
            <div className="course-card-head">
              <div>
                <strong>{course.code}</strong> — {course.title}
                {course.institution && <span className="setup-optional"> · {course.institution}</span>}
              </div>
              <button className="icon-btn" onClick={() => onEditCourse(course)} title="Edit course details">
                <Settings2 size={14} />
              </button>
            </div>

            {course.modules.length === 0 ? (
              <div className="empty-hint">No modules yet — add the first one below.</div>
            ) : (
              <div className="module-list">
                {course.modules.map((m) => (
                  <div className="module-row" key={m.id}>
                    <div>
                      <div className="module-row-title">{m.unit}</div>
                      <div className="module-row-meta">{m.durationMinutes} min · {PACE_OPTIONS.find((p) => p.id === m.pace)?.label} · {m.slides.length} slides</div>
                    </div>
                    <button className="nav-btn" onClick={() => onPreviewModule(course, m)}>Preview as student</button>
                  </div>
                ))}
              </div>
            )}

            <button className="skip-link" style={{ marginTop: 4 }} onClick={() => onAddModule(course)}>+ Add another module</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main meeting room
// ---------------------------------------------------------------------------
function LectureRoom({ curriculum, settings, studentName, role, onLeave, onEditSession }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState("slides"); // 'slides' | 'ide'
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [lecturerState, setLecturerState] = useState("idle"); // idle | explaining | answering | loading
  const [handRaised, setHandRaised] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [interrupted, setInterrupted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [typedCode, setTypedCode] = useState("");
  const [autopilotOn, setAutopilotOn] = useState(true);
  const [ttsNotice, setTtsNotice] = useState("");
  const [aiNotice, setAiNotice] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const audioRef = useRef(null);
  const activeResolveRef = useRef(null);
  const lastSpokenTextRef = useRef("");
  const typingIntervalRef = useRef(null);
  const explainedSlides = useRef(new Set());
  const messagesEndRef = useRef(null);

  const stateRef = useRef("idle");
  const interruptedRef = useRef(false);
  const slideIndexRef = useRef(0);
  const autopilotEnabledRef = useRef(true);
  const autopilotRunningRef = useRef(false);
  const introDoneRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
  useEffect(() => { autopilotEnabledRef.current = autopilotOn; }, [autopilotOn]);
  // Chrome in particular can silently drop the very first speechSynthesis
  // utterance on a fresh page if the voice list hasn't loaded yet — this
  // nudges it to load early rather than on the lecturer's opening line.
  useEffect(() => {
    window.speechSynthesis && window.speechSynthesis.getVoices();
  }, []);

  const setLecturerState2 = (s) => {
    stateRef.current = s;
    setLecturerState(s);
  };

  // Fresh session whenever a new/edited curriculum is launched.
  useEffect(() => {
    explainedSlides.current = new Set();
    introDoneRef.current = false;
    setSlideIndex(0);
    setMessages([]);
    setLecturerState2("idle");
    setViewMode("slides");
    setAutopilotOn(true);
  }, [curriculum]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const slide = curriculum.slides[Math.min(slideIndex, curriculum.slides.length - 1)];
  const wordBudget = computeWordBudget(settings.durationMinutes, curriculum.slides.length, settings.pace);
  const toneDesc = (TONE_OPTIONS.find((t) => t.id === settings.tone) || TONE_OPTIONS[0]).desc;
  const lecturerIdentity = `a ${toneDesc} university lecturer teaching ${curriculum.code} — ${curriculum.title}${settings.institution ? ` at ${settings.institution}` : ""}`;

  // Code reveals fresh on a new slide: full code if it's already been taught,
  // blank (waiting to be live-typed) if this is the first visit.
  useEffect(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    setTypedCode(slide.hasCode && explainedSlides.current.has(slideIndex) ? slide.code : "");
  }, [slideIndex, slide]);

  // Fallback estimate used for the browser-voice path (and to kick off code
  // typing immediately, before we'd otherwise know real audio duration).
  const estimateSpeechDurationMs = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1500, (words / AVG_SPEAKING_WPM) * 60000);
  };

  const animateTyping = useCallback((code, durationMs, startFrom = 0) => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    const start = performance.now();
    const remainingLen = code.length - startFrom;
    typingIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      setTypedCode(code.slice(0, startFrom + Math.floor(progress * remainingLen)));
      if (progress >= 1) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    }, 40);
  }, []);

  const addMessage = (speaker, text, type = "chat") => {
    setMessages((m) => [...m, { id: Date.now() + Math.random(), speaker, text, type }]);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Polls until the lecturer state machine returns to idle — used after an
  // interruption so the autopilot loop waits for the Q&A exchange to
  // actually finish before it resumes teaching.
  const waitForIdle = () =>
    new Promise((resolve) => {
      const check = () => {
        if (!mountedRef.current || stateRef.current === "idle") return resolve();
        setTimeout(check, 150);
      };
      check();
    });

  // Cuts off whatever is currently being said — browser voice or ElevenLabs
  // audio — and resolves any in-flight speakInterruptible() call with
  // `false` immediately (pause() doesn't fire a natural completion event,
  // so callers would otherwise hang waiting for one).
  const stopSpeaking = useCallback(() => {
    interruptedRef.current = true;
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (activeResolveRef.current) {
      activeResolveRef.current(false);
      activeResolveRef.current = null;
    }
  }, []);

  // Unified speech: tries ElevenLabs for natural voice if configured, falls
  // back to the browser's built-in (robotic) speechSynthesis otherwise or
  // on any request failure. Resolves `true` if it finished naturally,
  // `false` if it was interrupted (student asked a question, or navigation
  // happened) — callers use that to decide whether to wait for the
  // resulting Q&A to finish before continuing.
  const speakInterruptible = useCallback(
    async (text, { onDurationKnown } = {}) => {
      interruptedRef.current = false;
      lastSpokenTextRef.current = text;

      if (settings.voiceProvider === "elevenlabs" && settings.elevenLabsApiKey) {
        const voiceId = settings.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs default "Rachel" voice
        try {
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: { "xi-api-key": settings.elevenLabsApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              model_id: "eleven_multilingual_v2",
              // Stability near the default (0.5+) sounds steady but flat —
              // this is the single biggest lever for "robotic" complaints.
              // Dropping it toward 0.4 lets pitch/timing vary naturally
              // between takes, the way a real person's delivery does.
              // A little style adds warmth without tipping into caricature.
              voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
            }),
          });
          if (!res.ok) throw new Error(`ElevenLabs request failed (${res.status})`);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          setTtsNotice("");
          const result = await new Promise((resolve, reject) => {
            activeResolveRef.current = resolve;
            audio.onloadedmetadata = () => {
              if (isFinite(audio.duration)) onDurationKnown && onDurationKnown(audio.duration * 1000);
            };
            audio.onended = () => resolve(true);
            audio.onerror = () => resolve(false);
            // A rejected play() here is almost always the browser's autoplay
            // policy blocking audio that wasn't triggered by a direct click
            // — surface it instead of resolving silently, so the caller's
            // catch block below can show the "tap to enable" affordance.
            audio.play().catch((err) => reject(err));
          });
          URL.revokeObjectURL(url);
          activeResolveRef.current = null;
          audioRef.current = null;
          return result;
        } catch (e) {
          const blockedByAutoplay = e && (e.name === "NotAllowedError" || e.name === "NotSupportedError");
          setTtsNotice(
            blockedByAutoplay
              ? "Your browser blocked auto-playing audio — tap the 🔊 button to enable the lecturer's voice."
              : "Couldn't reach ElevenLabs for that line — used the browser voice instead."
          );
          if (blockedByAutoplay) setAudioBlocked(true);
          // falls through to the browser voice below (it may also be blocked,
          // but is worth trying — browsers treat speechSynthesis and
          // HTMLMediaElement autoplay policy somewhat differently)
        }
      }

      onDurationKnown && onDurationKnown(estimateSpeechDurationMs(text));
      if (!window.speechSynthesis) return true;
      window.speechSynthesis.cancel();
      return new Promise((resolve) => {
        activeResolveRef.current = resolve;
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        u.pitch = 1;
        u.onend = () => resolve(true);
        utteranceRef.current = u;
        window.speechSynthesis.speak(u);
      });
    },
    [settings.voiceProvider, settings.elevenLabsApiKey, settings.elevenLabsVoiceId]
  );

  // Every spoken AI call goes through here instead of callClaude directly,
  // so a rate limit or provider error surfaces as a visible notice (and a
  // sensible spoken fallback line) instead of the lecturer just going
  // quiet or saying something generic with no explanation why.
  const askLecturer = useCallback(async (system, prompt, fallback) => {
    try {
      const text = await callClaude(system, prompt);
      if (text) setAiNotice("");
      return text || fallback;
    } catch (e) {
      setAiNotice(
        e && e.rateLimited
          ? "The AI lecturer is getting a lot of requests right now — using a fallback line until it clears up."
          : "Had trouble reaching the AI lecturer just now — using a fallback line."
      );
      return fallback;
    }
  }, []);

  const generateExplanation = useCallback(
    async (targetSlide) => {
      const system = `You are ${lecturerIdentity}. You are mid-lecture, speaking out loud to a room of students. Keep this explanation to about ${wordBudget} words. ${NATURAL_SPEECH_STYLE}`;
      const prompt = targetSlide.hasCode
        ? `Current slide: "${targetSlide.title}". Teaching notes: ${targetSlide.notes} You are about to type this code live on screen while you talk: ${targetSlide.code} Narrate it roughly in the order it will be typed, top to bottom, like you're writing it in front of the class.`
        : `Current slide: "${targetSlide.title}". Teaching notes: ${targetSlide.notes}`;
      return askLecturer(system, prompt, "Sorry, I lost my train of thought for a moment — let's continue.");
    },
    [lecturerIdentity, wordBudget, askLecturer]
  );

  // Teaches one slide end-to-end: switches to the right view, explains it
  // (typing code live in sync with real or estimated speech duration),
  // rides out any interruption, then briefly checks understanding before
  // handing back control to the autopilot loop.
  const teachSlide = useCallback(
    async (index) => {
      const targetSlide = curriculum.slides[index];
      setViewMode(targetSlide.hasCode ? "ide" : "slides");
      setLecturerState2("loading");
      const explanation = await generateExplanation(targetSlide);
      if (!mountedRef.current) return;
      addMessage("lecturer", explanation, "explain");
      setLecturerState2("explaining");
      if (targetSlide.hasCode) setTypedCode("");

      const completed = await speakInterruptible(explanation, {
        onDurationKnown: (ms) => {
          if (targetSlide.hasCode) animateTyping(targetSlide.code, ms, 0);
        },
      });
      if (!mountedRef.current) return;
      if (targetSlide.hasCode) {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setTypedCode(targetSlide.code);
      }
      explainedSlides.current.add(index);

      if (!completed) {
        setInterrupted(true);
        await waitForIdle(); // let the question-answer exchange finish first
        setInterrupted(false);
        if (!mountedRef.current || !autopilotEnabledRef.current) return;
      }

      // Quick, human "did that land?" check before moving on.
      const isLast = index === curriculum.slides.length - 1;
      setLecturerState2("loading");
      const checkSystem = `You are ${lecturerIdentity}. In one short, warm sentence, check whether the student followed what you just covered${
        isLast ? ", and let them know that wraps up today's material" : `, before moving on to "${curriculum.slides[index + 1].title}"`
      }. ${NATURAL_SPEECH_STYLE}`;
      const checkText = await askLecturer(
        checkSystem,
        `You just finished explaining "${targetSlide.title}".`,
        isLast ? "That's everything for today — nicely done!" : "Does that make sense so far?"
      );
      if (!mountedRef.current) return;
      const safeCheck = checkText;
      addMessage("lecturer", safeCheck, "explain");
      setLecturerState2("explaining");
      const checkCompleted = await speakInterruptible(safeCheck);
      if (!mountedRef.current) return;
      if (!checkCompleted) await waitForIdle();
      setLecturerState2("idle");
      if (!isLast) await sleep(900);
    },
    [curriculum, generateExplanation, speakInterruptible, animateTyping, lecturerIdentity, askLecturer]
  );

  const runIntro = useCallback(async () => {
    setLecturerState2("loading");
    const system = `You are ${lecturerIdentity}. A student named ${studentName} just joined your live virtual classroom. Warmly welcome them by name, briefly introduce yourself as their AI lecturer, and give a short overview of what today's session (${curriculum.unit}) will cover. Under ${Math.max(
      50,
      Math.round(wordBudget * 0.7)
    )} words. ${NATURAL_SPEECH_STYLE}`;
    const prompt = `Course: ${curriculum.code} — ${curriculum.title}. Today's topics in order: ${curriculum.slides.map((s) => s.title).join(", ")}.`;
    const text = await askLecturer(system, prompt, `Welcome, ${studentName}! Today we're covering ${curriculum.unit}.`);
    if (!mountedRef.current) return;
    const safeText = text;
    addMessage("lecturer", safeText, "explain");
    setLecturerState2("explaining");
    const completed = await speakInterruptible(safeText);
    if (!mountedRef.current) return;
    if (!completed) await waitForIdle();
    setLecturerState2("idle");
    await sleep(500);
    introDoneRef.current = true;
  }, [lecturerIdentity, studentName, curriculum, wordBudget, speakInterruptible, askLecturer]);

  const runAutopilot = useCallback(async () => {
    if (!introDoneRef.current) {
      await runIntro();
    }
    for (let i = slideIndexRef.current; i < curriculum.slides.length; i++) {
      if (!mountedRef.current || !autopilotEnabledRef.current) return;
      setSlideIndex(i);
      await teachSlide(i);
    }
  }, [runIntro, teachSlide, curriculum]);

  // Drives the whole session automatically: starts on mount / whenever
  // autopilot is (re)enabled, and stops cleanly when paused (e.g. by manual
  // Prev/Next) — resuming later picks up from the current slide, not zero.
  useEffect(() => {
    if (autopilotOn && !autopilotRunningRef.current) {
      autopilotRunningRef.current = true;
      runAutopilot().finally(() => {
        autopilotRunningRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotOn, curriculum]);

  const handleQuestion = useCallback(
    async (questionText) => {
      addMessage(studentName, questionText, "question");
      if (stateRef.current === "explaining") {
        stopSpeaking();
      }
      setLecturerState2("answering");
      const answerBudget = Math.max(45, Math.round(wordBudget * 0.6));
      const system = `You are ${lecturerIdentity}. A student just raised their hand and asked a question mid-lecture. Answer it directly and briefly (about ${answerBudget} words). If you were mid-explanation, don't restate everything — just answer, then briefly say you'll continue the lecture. ${NATURAL_SPEECH_STYLE}`;
      const prompt = `You were covering: "${slide.title}" (${slide.notes}). The student asks: "${questionText}"`;
      const answer = await askLecturer(system, prompt, "Good question — let me pick that up right after this.");
      if (!mountedRef.current) return;
      const safeAnswer = answer;
      addMessage("lecturer", safeAnswer, "answer");
      setLecturerState2("answering");
      await speakInterruptible(safeAnswer);
      if (!mountedRef.current) return;
      setLecturerState2("idle");
      setHandRaised(false);
    },
    [studentName, slide, lecturerIdentity, wordBudget, speakInterruptible, stopSpeaking, askLecturer]
  );

  const continueTypingCode = useCallback(() => {
    if (!slide.hasCode || typedCode.length >= slide.code.length) return;
    setLecturerState2("explaining");
    const remaining = slide.code.length - typedCode.length;
    const durationMs = Math.max(800, remaining * 45);
    animateTyping(slide.code, durationMs, typedCode.length);
    setTimeout(() => setLecturerState2("idle"), durationMs + 60);
  }, [slide, typedCode, animateTyping]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    handleQuestion(chatInput.trim());
    setChatInput("");
  };

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current && recognitionRef.current.stop();
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcriptPiece;
        else interim += transcriptPiece;
      }
      setInterimText(interim);
      if (final.trim()) {
        recognition.stop();
        handleQuestion(final.trim());
      }
    };

    recognition.onerror = (e) => {
      setIsListening(false);
      setInterimText("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        addMessage("system", "Mic permission was blocked — allow microphone access in your browser to ask by voice, or type your question instead.", "system");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [handleQuestion]);

  const toggleHandRaise = () => {
    if (handRaised) {
      stopListening();
      setHandRaised(false);
      return;
    }
    setHandRaised(true);
    startListening();
  };

  // Manual navigation always pauses autopilot — otherwise the AI-driven
  // loop and a manually-jumping student would fight over the current slide.
  const changeSlide = (dir) => {
    stopSpeaking();
    setAutopilotOn(false);
    setLecturerState2("idle");
    setInterrupted(false);
    setSlideIndex((i) => Math.max(0, Math.min(curriculum.slides.length - 1, i + dir)));
  };

  const toggleAutopilot = () => {
    if (autopilotOn) {
      stopSpeaking();
      setLecturerState2("idle");
      setInterrupted(false);
    }
    setAutopilotOn((v) => !v);
  };

  // Guaranteed fallback: this handler runs inside a real click, so it will
  // satisfy every browser's autoplay/gesture requirement regardless of why
  // audio was blocked. Re-primes both audio paths and, if the lecturer had
  // already said something, replays it.
  const enableAudio = () => {
    primeAudioForVoice();
    setAudioBlocked(false);
    setTtsNotice("");
    if (lastSpokenTextRef.current) {
      speakInterruptible(lastSpokenTextRef.current);
    }
  };

  useEffect(() => {
    if (viewMode === "ide" && !slide.hasCode) setViewMode("slides");
  }, [slide, viewMode]);

  const statusLabel = () => {
    if (lecturerState === "loading") return "Thinking…";
    if (lecturerState === "answering") return "Answering your question…";
    if (lecturerState === "explaining") return slide.hasCode ? "Typing and explaining…" : "Explaining…";
    if (autopilotOn) return "Auto-lecture running — raise your hand anytime";
    return "Auto-lecture paused — use Prev/Next, or resume it above";
  };

  return (
    <div className="room">
      <div className="topbar">
        <div className="topbar-title">
          <span className="dot-live" /> {curriculum.code} · {curriculum.unit}
        </div>
        <div className="topbar-right">
          <div className="topbar-slide">{slide.title} · {slideIndex + 1}/{curriculum.slides.length}</div>
          <div className="topbar-budget" title="Words per slide, computed from lecture length & pacing">
            <Clock size={12} /> {settings.durationMinutes}min · {PACE_OPTIONS.find((p) => p.id === settings.pace)?.label}
          </div>
          <button
            className={`topbar-edit ${audioBlocked ? "audio-blocked" : ""}`}
            onClick={enableAudio}
            title="Tap if you can't hear the lecturer — unlocks/replays audio"
          >
            <Volume2 size={13} /> {audioBlocked ? "Tap to enable sound" : "Replay voice"}
          </button>
          <button className={`topbar-edit ${autopilotOn ? "on" : ""}`} onClick={toggleAutopilot} title="Toggle automatic lecture">
            {autopilotOn ? <Volume2 size={13} /> : <VideoOff size={13} />} {autopilotOn ? "Auto-lecture on" : "Auto-lecture off"}
          </button>
          {role === "lecturer" && onEditSession && (
            <button className="topbar-edit" onClick={onEditSession} title="Edit session settings">
              <Settings2 size={13} /> Edit session
            </button>
          )}
        </div>
      </div>

      {ttsNotice && (
        <div className={`tts-notice ${audioBlocked ? "clickable" : ""}`} onClick={audioBlocked ? enableAudio : undefined}>
          <AlertTriangle size={12} /> {ttsNotice}
        </div>
      )}
      {aiNotice && (
        <div className="tts-notice">
          <AlertTriangle size={12} /> {aiNotice}
        </div>
      )}

      <div className="body">
        <div className="main-col">
          <div className="tiles">
            <div className={`tile lecturer-tile ${lecturerState === "explaining" || lecturerState === "answering" ? "speaking" : ""}`}>
              <div className="avatar lecturer-avatar">L</div>
              <div className="tile-label">Lecturer {lecturerState === "loading" && <Loader2 className="spin" size={12} />} {(lecturerState === "explaining" || lecturerState === "answering") && <Volume2 size={12} />}</div>
            </div>
            <div className="tile student-tile">
              {camOn ? <div className="avatar student-avatar">{studentName[0]?.toUpperCase()}</div> : <VideoOff size={20} color="#8B93A1" />}
              <div className="tile-label">{studentName} {handRaised && <Hand size={12} color="#E8A33D" />}</div>
            </div>
          </div>

          <div className="stage-switch">
            <button className={viewMode === "slides" ? "active" : ""} onClick={() => setViewMode("slides")}>
              <PresentationIcon size={14} /> Slides
            </button>
            <button className={viewMode === "ide" ? "active" : ""} disabled={!slide.hasCode} onClick={() => setViewMode("ide")}>
              <Code2 size={14} /> Code editor
            </button>
          </div>

          <div className="stage">
            {viewMode === "slides" ? (
              <div className="slide">
                <div className="slide-eyebrow">{curriculum.unit}</div>
                <h2>{slide.title}</h2>
                <ul>
                  {slide.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                {interrupted && lecturerState !== "idle" && (
                  <div className="paused-ribbon">Paused mid-explanation to answer a question — will continue after</div>
                )}
              </div>
            ) : (
              <div className="ide">
                <div className="ide-bar">
                  {slide.title.replace(/\s+/g, "")}.java
                  {lecturerState === "explaining" && slide.hasCode && (
                    <span className="live-tag"><span className="live-dot" /> typing live</span>
                  )}
                </div>
                {!explainedSlides.current.has(slideIndex) && typedCode === "" ? (
                  <div className="ide-placeholder">// The lecturer will type this live while explaining.{"\n"}// Starting automatically…</div>
                ) : (
                  <pre className="ide-code">
                    <span dangerouslySetInnerHTML={{ __html: highlightJava(typedCode) }} />
                    {typedCode.length < slide.code.length && <span className="type-cursor">▍</span>}
                  </pre>
                )}
              </div>
            )}
          </div>

          <div className="stage-actions">
            <button className="nav-btn" disabled={slideIndex === 0} onClick={() => changeSlide(-1)}>
              <ChevronLeft size={16} /> Prev
            </button>
            {slide.hasCode && lecturerState === "idle" && typedCode.length > 0 && typedCode.length < slide.code.length ? (
              <button className="explain-btn" onClick={continueTypingCode}>
                Continue typing code
              </button>
            ) : (
              <div className="status-pill">{statusLabel()}</div>
            )}
            <button className="nav-btn" disabled={slideIndex === curriculum.slides.length - 1} onClick={() => changeSlide(1)}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {chatOpen && (
          <div className="side-panel">
            <div className="side-header">Chat & questions</div>
            <div className="side-messages">
              {messages.length === 0 && <div className="empty-hint">Your lecturer will greet you in a moment…</div>}
              {messages.map((m) => (
                <div key={m.id} className={`msg msg-${m.type}`}>
                  <div className="msg-speaker">{m.speaker === "lecturer" ? "Lecturer" : m.speaker}</div>
                  <div className="msg-text">{m.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="side-input-wrap">
              {isListening && (
                <div className="listening-banner">
                  <span className="listening-dot" /> Listening… {interimText && <em>"{interimText}"</em>}
                </div>
              )}
              <div className="side-input">
                <input
                  placeholder={
                    !voiceSupported
                      ? "Voice not supported here — type your question…"
                      : handRaised
                      ? "Ask your question, or just speak…"
                      : "Raise your hand to ask…"
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                />
                <button onClick={sendChat} disabled={!chatInput.trim()}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="controlbar">
        <button className={`ctrl ${micOn ? "on" : ""}`} onClick={() => setMicOn((v) => !v)} title="Mic">
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button className={`ctrl ${camOn ? "on" : ""}`} onClick={() => setCamOn((v) => !v)} title="Camera">
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button
          className={`ctrl ${handRaised ? "raised" : ""} ${isListening ? "listening" : ""}`}
          onClick={toggleHandRaise}
          title="Raise hand to ask by voice"
        >
          <Hand size={18} />
        </button>
        <button className={`ctrl ${chatOpen ? "on" : ""}`} onClick={() => setChatOpen((v) => !v)} title="Chat">
          <MessageSquare size={18} />
        </button>
        <button className="ctrl leave labeled" onClick={onLeave} title="Leave the meeting">
          <PhoneOff size={18} /> <span>Leave</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell — owns the stage machine: role -> setup (lecturer) / join
// (student) -> room. Curriculum + settings are lifted here so they survive
// navigating back and forth (e.g. lecturer editing session mid-demo).
// ---------------------------------------------------------------------------
export default function SEMAIApp() {
  const [stage, setStage] = useState("role"); // role | auth | dashboard | courseMeta | moduleSetup | join | room
  const [role, setRole] = useState(null);
  const [courses, setCourses] = useState([DEFAULT_COURSE]);
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseDraft, setCourseDraft] = useState(null);
  const [editingCourse, setEditingCourse] = useState(false);
  const [roomData, setRoomData] = useState(null); // { curriculum, settings }
  const [studentName, setStudentName] = useState("Student");
  const [dbStatus, setDbStatus] = useState(supabaseEnabled() ? "loading" : "local"); // loading | connected | error | local
  const [session, setSession] = useState(null); // { accessToken, refreshToken, user: {id, email} } | null

  // Try to restore a lecturer session on load (refreshing it, since access
  // tokens expire after ~1hr but refresh tokens last much longer). Silently
  // does nothing if Supabase isn't configured or nothing was stored.
  useEffect(() => {
    if (!supabaseEnabled()) return;
    const stored = loadSessionLocally();
    if (!stored) return;
    refreshLecturerSession(stored.refreshToken)
      .then((fresh) => {
        setSession(fresh);
        saveSessionLocally(fresh);
      })
      .catch(() => saveSessionLocally(null)); // stored session is stale/invalid — just drop it
  }, []);

  // Load once on mount. If Supabase isn't configured (blank URL/key) or the
  // request fails, we just keep the in-memory DEFAULT_COURSE state — same
  // behavior as before this feature existed.
  useEffect(() => {
    if (!supabaseEnabled()) return;
    let cancelled = false;
    fetchCoursesFromSupabase()
      .then((loaded) => {
        if (cancelled) return;
        setCourses(loaded.length > 0 ? loaded : [DEFAULT_COURSE]);
        setDbStatus("connected");
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Supabase load failed:", e);
        setDbStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const emptySetup = () => ({
    moduleSettings: { ...DEFAULT_MODULE_DRAFT_SETTINGS },
    rawText: "",
    fileName: "",
    draft: null,
    phase: "input", // input | extracting | generating | preview
    error: "",
  });
  const [setup, setSetupState] = useState(emptySetup);
  const patchSetup = (patch) => setSetupState((s) => ({ ...s, ...patch }));

  const activeCourse = courses.find((c) => c.id === activeCourseId) || null;
  // Only Supabase-backed courses have a real owner_id to filter on. Without
  // Supabase configured, everything stays in the old single-user local mode
  // (no auth gate at all — see the role-select handler below).
  const myCourses = supabaseEnabled() && session ? courses.filter((c) => c.ownerId === session.user.id) : courses;

  const handleAuthenticated = (newSession) => {
    setSession(newSession);
    saveSessionLocally(newSession);
    setStage("dashboard");
  };

  const handleSignOut = () => {
    if (session) signOutLecturer(session.accessToken);
    setSession(null);
    saveSessionLocally(null);
    setStage("role");
  };

  const handleNewCourse = () => {
    setCourseDraft({
      id: makeId("course"), code: "", title: "", institution: "",
      tone: "conversational", voiceProvider: "browser", elevenLabsApiKey: "", elevenLabsVoiceId: "",
      ownerId: session ? session.user.id : null,
      modules: [],
    });
    setEditingCourse(false);
    setStage("courseMeta");
  };

  const handleEditCourse = (course) => {
    setCourseDraft({ ...course });
    setEditingCourse(true);
    setStage("courseMeta");
  };

  const handleCourseMetaContinue = () => {
    setCourses((cs) => (cs.some((c) => c.id === courseDraft.id) ? cs.map((c) => (c.id === courseDraft.id ? courseDraft : c)) : [...cs, courseDraft]));
    setActiveCourseId(courseDraft.id);
    if (supabaseEnabled()) {
      saveCourseToSupabase(courseDraft, session?.accessToken).catch((e) => console.error("Supabase course save failed:", e));
    }
    if (editingCourse) {
      setStage("dashboard");
    } else {
      setSetupState(emptySetup());
      setStage("moduleSetup");
    }
  };

  const handleAddModule = (course) => {
    setActiveCourseId(course.id);
    setSetupState(emptySetup());
    setStage("moduleSetup");
  };

  // Saving a module just adds it to the course and returns to the
  // dashboard — it does NOT open a live session. Only the explicit
  // "Save & preview as student" path does that.
  const handleSaveModule = (moduleObj) => {
    setCourses((cs) => cs.map((c) => (c.id === activeCourseId ? { ...c, modules: [...c.modules, moduleObj] } : c)));
    if (supabaseEnabled()) {
      saveModuleToSupabase(activeCourseId, moduleObj, session?.accessToken).catch((e) => console.error("Supabase module save failed:", e));
    }
    setStage("dashboard");
  };

  const handleSaveAndPreview = (moduleObj) => {
    const course = courses.find((c) => c.id === activeCourseId);
    const updatedCourse = { ...course, modules: [...course.modules, moduleObj] };
    setCourses((cs) => cs.map((c) => (c.id === activeCourseId ? updatedCourse : c)));
    if (supabaseEnabled()) {
      saveModuleToSupabase(activeCourseId, moduleObj, session?.accessToken).catch((e) => console.error("Supabase module save failed:", e));
    }
    primeAudioForVoice();
    setRoomData(buildRoomData(updatedCourse, moduleObj));
    setStudentName("Lecturer (preview)");
    setStage("room");
  };

  const handlePreviewModule = (course, module) => {
    primeAudioForVoice();
    setRoomData(buildRoomData(course, module));
    setStudentName("Lecturer (preview)");
    setStage("room");
  };

  const handleJoin = (course, module, name) => {
    primeAudioForVoice(); // must run inside this click-triggered call, not later in a useEffect
    setRoomData(buildRoomData(course, module));
    setStudentName(name);
    setStage("room");
  };

  const handleLeaveRoom = () => {
    setStage(role === "lecturer" ? "dashboard" : "join");
  };

  return (
    <>
      <GlobalStyles />
      {stage === "role" && (
        <RoleSelectScreen
          onSelectRole={(r) => {
            setRole(r);
            if (r === "lecturer") {
              // Only gate on real auth when there's an actual database to
              // scope ownership against — without Supabase configured this
              // stays exactly the old single-user local mode.
              setStage(supabaseEnabled() && !session ? "auth" : "dashboard");
            } else {
              setStage("join");
            }
          }}
        />
      )}
      {stage === "auth" && <AuthScreen onAuthenticated={handleAuthenticated} onBack={() => setStage("role")} />}
      {stage === "dashboard" && (
        <LecturerDashboard
          courses={myCourses}
          dbStatus={dbStatus}
          lecturerEmail={session?.user?.email}
          onNewCourse={handleNewCourse}
          onEditCourse={handleEditCourse}
          onAddModule={handleAddModule}
          onPreviewModule={handlePreviewModule}
          onBack={() => setStage("role")}
          onSignOut={session ? handleSignOut : null}
        />
      )}
      {stage === "courseMeta" && courseDraft && (
        <CourseMetaScreen
          draft={courseDraft}
          editing={editingCourse}
          onChange={(patch) => setCourseDraft((d) => ({ ...d, ...patch }))}
          onContinue={handleCourseMetaContinue}
          onCancel={() => setStage("dashboard")}
        />
      )}
      {stage === "moduleSetup" && activeCourse && (
        <ModuleSetupScreen
          course={activeCourse}
          setup={setup}
          patchSetup={patchSetup}
          onSaveModule={handleSaveModule}
          onSaveAndPreview={handleSaveAndPreview}
          onCancel={() => setStage("dashboard")}
        />
      )}
      {stage === "join" && <JoinScreen courses={courses} onJoin={handleJoin} onBack={() => setStage("role")} />}
      {stage === "room" && roomData && (
        <LectureRoom
          curriculum={roomData.curriculum}
          settings={roomData.settings}
          studentName={studentName}
          role={role}
          onLeave={handleLeaveRoom}
          onEditSession={role === "lecturer" ? () => setStage("dashboard") : null}
        />
      )}
    </>
  );
}


// ---------------------------------------------------------------------------
// Styling — token system:
// bg #14181C, panel #1E2530, chalkboard #2F6F4F, live-amber #E8A33D,
// code-blue #4C7EF3, text #EDEFF2 / #8B93A1
// ---------------------------------------------------------------------------
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

      * { box-sizing: border-box; }
      .room, .join-screen, .setup-screen { font-family: 'Inter', sans-serif; color: #EDEFF2; background: #14181C; }

      /* Join / role screens */
      .join-screen { min-height: 560px; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
      .join-card { max-width: 380px; width: 100%; text-align: center; }
      .join-card.wide { max-width: 480px; }
      .pick-list { display: flex; flex-direction: column; gap: 8px; text-align: left; margin: 18px 0; }
      .pick-row { padding: 12px 14px; border-radius: 10px; border: 1px solid #2A313C; background: #1E2530; color: #EDEFF2; font-size: 13px; text-align: left; cursor: pointer; }
      .pick-row:hover { border-color: #E8A33D; }
      .join-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #E8A33D; margin-bottom: 14px; }
      .join-title { font-family: 'Space Grotesk', sans-serif; font-size: 26px; line-height: 1.2; margin: 0 0 8px; }
      .join-sub { color: #8B93A1; font-size: 14px; margin: 0 0 28px; }
      .join-input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #2A313C; background: #1E2530; color: #EDEFF2; font-size: 14px; margin-bottom: 12px; outline: none; }
      .join-input:focus { border-color: #E8A33D; }
      .join-btn { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #2F6F4F; color: #EDEFF2; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
      .join-btn:disabled { background: #2A313C; color: #565E6B; cursor: not-allowed; }
      .join-btn:not(:disabled):hover { background: #37855D; }
      .join-btn.secondary { background: #1E2530; border: 1px solid #2A313C; color: #C7CCD4; }
      .join-btn.secondary:hover { background: #232A34; }
      .join-hint { color: #565E6B; font-size: 12px; margin-top: 16px; }

      /* Setup screen */
      .setup-screen { min-height: 560px; max-width: 920px; margin: 0 auto; padding: 32px 20px 60px; }
      .setup-header { text-align: center; margin-bottom: 28px; }
      .setup-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; align-items: start; }
      .setup-col { display: flex; flex-direction: column; gap: 8px; }
      .setup-col.narrow { max-width: 420px; margin: 0 auto; }
      .course-context-note { font-size: 11px; color: #565E6B; margin-top: 10px; line-height: 1.5; }

      .db-status { font-size: 11px; padding: 7px 12px; border-radius: 8px; margin-bottom: 14px; display: inline-block; }
      .db-status.ok { color: #6FBF8A; background: rgba(111,191,138,0.1); border: 1px solid rgba(111,191,138,0.25); }
      .db-status.warn { color: #E8A33D; background: rgba(232,163,61,0.1); border: 1px solid rgba(232,163,61,0.25); }
      .db-status.loading { color: #8B93A1; background: #1A1F27; border: 1px solid #232A34; }
      .dash-toolbar { display: flex; justify-content: flex-end; margin-bottom: 18px; }
      .course-list { display: flex; flex-direction: column; gap: 14px; }
      .course-card { background: #1E2530; border: 1px solid #232A34; border-radius: 12px; padding: 16px; }
      .course-card-head { display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 10px; }
      .module-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
      .module-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #1A1F27; border: 1px solid #232A34; border-radius: 9px; }
      .module-row-title { font-size: 13px; color: #EDEFF2; margin-bottom: 2px; }
      .module-row-meta { font-size: 11px; color: #565E6B; }
      .preview-actions-right { display: flex; gap: 10px; }
      .setup-label { font-size: 12px; font-weight: 600; color: #8B93A1; display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
      .setup-optional { font-weight: 400; color: #565E6B; text-transform: none; letter-spacing: 0; }
      .dropzone { border: 1.5px dashed #2A313C; border-radius: 12px; padding: 22px; text-align: center; color: #8B93A1; font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: border-color 0.15s, background 0.15s; }
      .dropzone:hover { border-color: #E8A33D; background: rgba(232,163,61,0.05); }
      .setup-or { text-align: center; color: #565E6B; font-size: 11px; margin: 6px 0; }
      .setup-textarea { width: 100%; min-height: 180px; padding: 12px; border-radius: 10px; border: 1px solid #2A313C; background: #1A1F27; color: #EDEFF2; font-size: 13px; font-family: 'JetBrains Mono', monospace; line-height: 1.6; resize: vertical; outline: none; }
      .setup-textarea:focus { border-color: #E8A33D; }
      .setup-input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2A313C; background: #1E2530; color: #EDEFF2; font-size: 13px; outline: none; margin-bottom: 4px; }
      .setup-input:focus { border-color: #E8A33D; }
      .setup-slider { width: 100%; accent-color: #E8A33D; }
      .pill-row { display: flex; gap: 6px; flex-wrap: wrap; }
      .pill { padding: 7px 12px; border-radius: 20px; border: 1px solid #2A313C; background: #1A1F27; color: #8B93A1; font-size: 12px; cursor: pointer; }
      .pill.active { background: #2F6F4F; color: #EDEFF2; border-color: #2F6F4F; }
      .setup-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #C7CCD4; margin-top: 12px; cursor: pointer; }
      .budget-readout { font-size: 11px; color: #E8A33D; background: rgba(232,163,61,0.1); border: 1px solid rgba(232,163,61,0.25); border-radius: 8px; padding: 8px 10px; margin-top: 12px; }
      .setup-error { display: flex; align-items: center; gap: 6px; color: #F0A0A0; font-size: 12px; margin-top: 10px; }
      .skip-link { background: none; border: none; color: #565E6B; font-size: 12px; text-decoration: underline; cursor: pointer; margin-top: 10px; padding: 4px; }

      .preview-wrap { display: flex; flex-direction: column; gap: 14px; }
      .preview-toolbar { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #C7CCD4; flex-wrap: wrap; gap: 8px; }
      .slide-card-list { display: flex; flex-direction: column; gap: 12px; max-height: 460px; overflow-y: auto; padding-right: 4px; }
      .slide-card { background: #1E2530; border: 1px solid #232A34; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
      .slide-card-head { display: flex; align-items: center; gap: 8px; }
      .slide-card-title { flex: 1; font-family: 'Space Grotesk', sans-serif; font-size: 15px; background: none; border: none; border-bottom: 1px solid #2A313C; color: #EDEFF2; padding: 4px 0; outline: none; }
      .icon-btn { background: none; border: none; color: #565E6B; cursor: pointer; padding: 4px; }
      .icon-btn:hover { color: #F0A0A0; }
      .slide-card-bullets, .slide-card-notes, .slide-card-code { width: 100%; border-radius: 8px; border: 1px solid #2A313C; background: #1A1F27; color: #C7CCD4; font-size: 12.5px; padding: 8px 10px; outline: none; resize: vertical; }
      .slide-card-code { font-family: 'JetBrains Mono', monospace; }
      .preview-actions { display: flex; justify-content: space-between; gap: 10px; }

      /* Room shell — fixed to the viewport height, nothing here should grow
         the outer page. Only .stage and .side-messages scroll internally. */
      .room { height: 100vh; max-height: 720px; display: flex; flex-direction: column; overflow: hidden; }
      .topbar { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid #232A34; font-size: 13px; }
      .topbar-title { font-weight: 600; display: flex; align-items: center; gap: 8px; }
      .topbar-right { display: flex; align-items: center; gap: 12px; }
      .dot-live { width: 7px; height: 7px; border-radius: 50%; background: #E8A33D; box-shadow: 0 0 0 3px rgba(232,163,61,0.2); }
      .topbar-slide { color: #8B93A1; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
      .topbar-budget { display: flex; align-items: center; gap: 4px; color: #565E6B; font-size: 11px; }
      .topbar-edit { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 7px; border: 1px solid #232A34; background: #1A1F27; color: #8B93A1; font-size: 11px; cursor: pointer; }
      .topbar-edit:hover { color: #EDEFF2; border-color: #37404D; }
      .topbar-edit.on { background: rgba(232,163,61,0.12); color: #E8A33D; border-color: rgba(232,163,61,0.35); }
      .topbar-edit.audio-blocked { background: rgba(240,160,160,0.12); color: #F0A0A0; border-color: rgba(240,160,160,0.4); animation: pulse-ring 1.2s ease-in-out infinite; }
      .tts-notice { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 6px 20px; font-size: 11px; color: #E8A33D; background: rgba(232,163,61,0.08); border-bottom: 1px solid rgba(232,163,61,0.2); }
      .tts-notice.clickable { cursor: pointer; text-decoration: underline; }

      .body { flex: 1 1 auto; display: flex; overflow: hidden; min-height: 0; }
      .main-col { flex: 1; display: flex; flex-direction: column; padding: 16px 20px; gap: 12px; min-width: 0; min-height: 0; }

      .tiles { flex: 0 0 auto; display: flex; gap: 10px; height: 90px; }
      .tile { flex: 1; max-width: 220px; background: #1E2530; border-radius: 12px; border: 1px solid #232A34; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; position: relative; transition: border-color 0.2s, box-shadow 0.2s; }
      .tile.speaking { border-color: #E8A33D; box-shadow: 0 0 0 2px rgba(232,163,61,0.25); }
      .avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 14px; }
      .lecturer-avatar { background: #2F6F4F; color: #EDEFF2; }
      .student-avatar { background: #35404E; color: #EDEFF2; }
      .tile-label { font-size: 11px; color: #8B93A1; display: flex; align-items: center; gap: 4px; }

      .stage-switch { flex: 0 0 auto; display: flex; gap: 8px; }
      .stage-switch button { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; border: 1px solid #232A34; background: #1A1F27; color: #8B93A1; font-size: 12px; cursor: pointer; }
      .stage-switch button.active { background: #232A34; color: #EDEFF2; border-color: #37404D; }
      .stage-switch button:disabled { opacity: 0.35; cursor: not-allowed; }

      .stage { flex: 1 1 auto; background: #1E2530; border: 1px solid #232A34; border-radius: 14px; padding: 28px; overflow-y: auto; min-height: 0; }
      .slide-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #E8A33D; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
      .slide h2 { font-family: 'Space Grotesk', sans-serif; font-size: 24px; margin: 0 0 16px; }
      .slide ul { margin: 0; padding-left: 18px; color: #C7CCD4; line-height: 1.9; font-size: 14px; }
      .paused-ribbon { margin-top: 18px; padding: 8px 12px; background: rgba(232,163,61,0.12); border: 1px solid rgba(232,163,61,0.35); color: #E8A33D; font-size: 12px; border-radius: 8px; }

      .ide { display: flex; flex-direction: column; height: 100%; }
      .ide-bar { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8B93A1; margin-bottom: 10px; border-bottom: 1px solid #232A34; padding-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
      .live-tag { display: flex; align-items: center; gap: 5px; color: #E8A33D; font-size: 11px; }
      .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #E8A33D; animation: pulse 1s ease-in-out infinite; }
      .ide-placeholder { font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.7; color: #565E6B; white-space: pre-wrap; font-style: italic; }
      .ide-code { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.7; color: #C7CCD4; margin: 0; white-space: pre-wrap; }
      .type-cursor { color: #E8A33D; animation: pulse 0.8s step-end infinite; }
      .tok-keyword { color: #4C7EF3; }
      .tok-string { color: #E8A33D; }
      .tok-comment { color: #565E6B; font-style: italic; }

      .stage-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; }
      .nav-btn { display: flex; align-items: center; gap: 4px; padding: 8px 12px; border-radius: 8px; border: 1px solid #232A34; background: #1A1F27; color: #C7CCD4; font-size: 12px; cursor: pointer; }
      .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .explain-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; border-radius: 8px; border: none; background: #2F6F4F; color: #EDEFF2; font-weight: 600; font-size: 13px; cursor: pointer; }
      .explain-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .stage-actions .explain-btn { flex: 1; }
      .status-pill { flex: 1; text-align: center; padding: 10px; border-radius: 8px; background: #1A1F27; border: 1px solid #232A34; color: #8B93A1; font-size: 12px; }
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .side-panel { width: 260px; flex: 0 0 260px; border-left: 1px solid #232A34; display: flex; flex-direction: column; min-height: 0; }
      .side-header { flex: 0 0 auto; padding: 14px 16px; font-size: 12px; font-weight: 600; color: #8B93A1; border-bottom: 1px solid #232A34; }
      .side-messages { flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
      .empty-hint { color: #565E6B; font-size: 12px; }
      .msg-speaker { font-size: 11px; color: #565E6B; margin-bottom: 3px; }
      .msg-text { font-size: 13px; line-height: 1.5; color: #C7CCD4; }
      .msg-question .msg-speaker { color: #4C7EF3; }
      .msg-answer .msg-speaker, .msg-explain .msg-speaker { color: #E8A33D; }
      .msg-system { opacity: 0.8; }
      .msg-system .msg-speaker { color: #F0A0A0; }
      .side-input-wrap { flex: 0 0 auto; border-top: 1px solid #232A34; }
      .listening-banner { display: flex; align-items: center; gap: 6px; padding: 8px 16px 0; font-size: 11px; color: #E8A33D; }
      .listening-banner em { color: #C7CCD4; font-style: normal; }
      .listening-dot { width: 7px; height: 7px; border-radius: 50%; background: #E8A33D; animation: pulse 1s ease-in-out infinite; flex-shrink: 0; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      .side-input { display: flex; gap: 6px; padding: 12px 16px; }
      .side-input input { flex: 1; padding: 9px 10px; border-radius: 8px; border: 1px solid #2A313C; background: #1A1F27; color: #EDEFF2; font-size: 12px; outline: none; }
      .side-input button { padding: 9px 10px; border-radius: 8px; border: none; background: #2F6F4F; color: #EDEFF2; cursor: pointer; }
      .side-input button:disabled { background: #2A313C; color: #565E6B; }

      .controlbar { flex: 0 0 auto; display: flex; justify-content: center; gap: 10px; padding: 14px; border-top: 1px solid #232A34; }
      .ctrl { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #232A34; background: #1A1F27; color: #8B93A1; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .ctrl.labeled { width: auto; padding: 0 16px; gap: 7px; font-size: 13px; font-weight: 600; }
      .ctrl.on { background: #232A34; color: #EDEFF2; }
      .ctrl.raised { background: rgba(232,163,61,0.15); color: #E8A33D; border-color: rgba(232,163,61,0.4); }
      .ctrl.listening { animation: pulse-ring 1.2s ease-in-out infinite; }
      @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,163,61,0.4); } 50% { box-shadow: 0 0 0 6px rgba(232,163,61,0); } }
      .ctrl.leave { background: #4A2323; color: #F0A0A0; border-color: #5C2A2A; }

      @media (max-width: 720px) {
        .setup-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
