import { logoSvg, maskableSvg, BRAND } from "../src/brand/logo.js";
import { nodeCountFor, makeNodes, stepNodes, edgesFor } from "../src/brand/network.js";
import fs from "node:fs";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---- logo
const svg = logoSvg({ size: 120 });
t("valid, sized, self-contained SVG", svg.startsWith("<svg") && svg.endsWith("</svg>") && /viewBox="0 0 120 120"/.test(svg) && /width="120"/.test(svg));
t("scales to any size", /width="32"/.test(logoSvg({ size: 32 })) && /width="512"/.test(logoSvg({ size: 512 })));
const gradIds = [...svg.matchAll(/<(?:linear|radial)Gradient id="([^"]+)"/g)].map((m) => m[1]);
t("every gradient used is defined", [...svg.matchAll(/url\(#([^)]+)\)/g)].every((m) => gradIds.includes(m[1])), gradIds.join());
// A gradient stroke on a perfectly vertical/horizontal line has a zero-width bounding box and silently renders NOTHING.
const lines = [...svg.matchAll(/<line ([^>]+)\/>/g)].map((m) => m[1]);
const attr = (s, k) => (new RegExp(`${k}="([^"]+)"`).exec(s) || [])[1];
const bad = lines.filter((l) => /stroke="url\(/.test(l) && (attr(l, "x1") === attr(l, "x2") || attr(l, "y1") === attr(l, "y2")));
t("no straight line uses a gradient stroke (it would be invisible)", bad.length === 0, bad.join(" | "));
t("accessible: the SVG itself is decorative (the wrapper carries the label)", /aria-hidden="true"/.test(svg));
t("brand identity", BRAND.name === "SEMAI" && BRAND.tagline === "AI-guided learning");
const m = maskableSvg(512);
t("maskable icon is full-bleed with the mark inside the safe zone (scaled down)", /<rect width="120" height="120" fill="#11161C"\/>/.test(m) && /scale\(0\.7\)/.test(m));
t("favicon + icons generated and linked", ["favicon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"].every((f) => fs.existsSync(`public/${f}`) && fs.statSync(`public/${f}`).size > 500) && /favicon\.svg/.test(fs.readFileSync("index.html", "utf8")) && /apple-touch-icon/.test(fs.readFileSync("index.html", "utf8")));
const png = fs.readFileSync("public/icon-512.png");
t("icon-512 really is a 512x512 PNG", png.slice(1, 4).toString() === "PNG" && png.readUInt32BE(16) === 512 && png.readUInt32BE(20) === 512);

// ---- network simulation
t("node count scales with area, with sane bounds", nodeCountFor(360, 640) >= 14 && nodeCountFor(360, 640) <= 46 && nodeCountFor(1920, 1080) === 46 && nodeCountFor(100, 100) === 14);
const nodes = makeNodes(400, 300, 30, seeded(7));
t("nodes are created inside the canvas", nodes.length === 30 && nodes.every((n) => n.x >= 0 && n.x <= 400 && n.y >= 0 && n.y <= 300));
let ok = true;
for (let i = 0; i < 2000; i++) { stepNodes(nodes, 400, 300, 16); if (nodes.some((n) => n.x < 0 || n.x > 400 || n.y < 0 || n.y > 300 || !Number.isFinite(n.x))) { ok = false; break; } }
t("nodes bounce and never leave the canvas over thousands of frames", ok);
const before = nodes.map((n) => [n.x, n.y]);
stepNodes(nodes, 400, 300, 0);
t("zero elapsed time moves nothing", nodes.every((n, i) => n.x === before[i][0] && n.y === before[i][1]));
const far = [{ x: 0, y: 0, vx: 0.02, vy: 0 }];
stepNodes(far, 400, 300, 600000);
t("a long gap (tab was hidden) is capped, so nodes never teleport", far[0].x <= 0.02 * 64 + 1e-9, far[0].x);
const e = edgesFor([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 500, y: 500 }], 100);
t("only nearby nodes are joined, and nearer = stronger", e.length === 1 && e[0].a === 0 && e[0].b === 1 && Math.abs(e[0].alpha - 0.7) < 1e-9);
t("no edges when nothing is near", edgesFor([{ x: 0, y: 0 }, { x: 900, y: 900 }], 100).length === 0);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
