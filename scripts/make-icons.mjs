// Regenerates the favicon and every PWA icon from the brand mark (src/brand/logo.js).
// Run:  node scripts/make-icons.mjs
import sharp from "sharp";
import fs from "node:fs";
import { logoSvg, maskableSvg } from "../src/brand/logo.js";

const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;
const png = async (svg, size, file) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out(file));

fs.writeFileSync(out("favicon.svg"), logoSvg({ size: 64 }));
await png(logoSvg({ size: 512 }), 192, "icon-192.png");
await png(logoSvg({ size: 512 }), 512, "icon-512.png");
await png(maskableSvg(512), 512, "icon-maskable-512.png");
await png(maskableSvg(512), 180, "apple-touch-icon.png");
console.log("icons written");
