// Guards the "bigger display" layout so it can't quietly regress: the room must use the whole window,
// and the padding above/below the slide must stay small.
import fs from "node:fs";
const src = fs.readFileSync("src/App.jsx", "utf8");
const css = fs.readFileSync("src/slideKit/slideKit.css", "utf8");
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const rule = (sel) => { const i = src.indexOf(`${sel} {`); return i < 0 ? "" : src.slice(i, src.indexOf("}", i)); };
const pad = (r, prop = "padding") => { const m = new RegExp(`${prop}: ([^;]+);`).exec(r); return m ? m[1].trim().split(/\s+/).map((v) => parseInt(v, 10)) : null; };

t("room height is the full window (dvh), no 720px cap", /\.room \{[^}]*height: 100dvh[^}]*max-height: none/.test(src) && !/max-height: 720px/.test(src));
const stage = pad(rule(".stage"));
t("stage vertical padding is small (<= 20px top and bottom)", stage && stage[0] <= 20, JSON.stringify(stage));
const pStage = pad(rule(".room.presentation .stage"));
t("presentation stage padding: top <= 24, bottom <= 32 (was 44/56)", pStage && pStage[0] <= 24 && pStage[2] <= 32, JSON.stringify(pStage));
t("topbar padding <= 8px vertical", pad(rule(".topbar"))[0] <= 8);
t("main column padding <= 10px vertical", pad(rule(".main-col"))[0] <= 10 && pad(rule(".room.presentation .main-col"))[0] <= 10);
t("controlbar padding <= 10px vertical", pad(rule(".controlbar"))[0] <= 10);
t("slide title/eyebrow margins reduced", /\.slide h2 \{[^}]*margin: 0 0 14px/.test(src) && /margin-bottom: 6px/.test(rule(".slide-eyebrow")));
t("navigation and 'How is this going?' share ONE row (control-strip wrapper)", src.includes('className="control-strip"') && /\.control-strip \{[^}]*flex-wrap: wrap/.test(src));
t("the code view fills the stage height", /\.stage > \.ide \{ flex: 1 1 0; min-height: 0; margin-block: 0; \}/.test(src) && /\.sk-ide \{ flex: 1 1 auto; min-height: 0/.test(css));
t("diagrams/plots scale to the available window height", /\.sk-diagram svg \{[^}]*max-height: calc\(100dvh - 300px\)/.test(css));
t("full-screen button exists and only shows where the browser supports it", src.includes("requestFullscreen") && src.includes("canFullscreen &&") && src.includes("fullscreenchange"));
// the vertical "chrome" budget, summed from the actual numbers
const chrome = pad(rule(".topbar"))[0] * 2 + pad(rule(".main-col"))[0] * 2 + pad(rule(".room.presentation .stage"))[0] + pad(rule(".room.presentation .stage"))[2] + pad(rule(".controlbar"))[0] * 2;
t("total padding budget (top bar + column + stage + control bar) is under 120px", chrome < 120, chrome);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
