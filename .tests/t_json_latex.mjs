import { parseJsonLoose } from "../src/slideKit/json.js";
import { splitRichText, latexError, latexToPlain, renderLatexHTML } from "../src/slideKit/latex.js";
let fail = 0;
const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fail++; console.log("FAIL", name, "\n  got ", JSON.stringify(a), "\n  want", JSON.stringify(b)); } else console.log("ok  ", name); };

// 1. LaTeX written with SINGLE backslashes inside JSON (the dangerous case)
const raw1 = '{"latex":"x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}","t":"\\theta \\times \\beta \\rho \\nu \\neq \\right) \\left( \\alpha \\pi \\sum \\text{hi} \\to y","code":"printf(\\"a\\\\n\\");\\nint x;"}';
const d1 = parseJsonLoose(raw1);
eq("frac/pm/sqrt survive", d1.latex, "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}");
eq("theta times beta rho nu neq right left alpha pi sum text to", d1.t, "\\theta \\times \\beta \\rho \\nu \\neq \\right) \\left( \\alpha \\pi \\sum \\text{hi} \\to y");
eq("code field untouched", d1.code, 'printf("a\\n");\nint x;');
// 2. Properly double-escaped LaTeX
const d2 = parseJsonLoose('```json\n{"latex":"\\\\frac{1}{2}\\\\cdot \\\\beta",}\n```');
eq("properly escaped + fences + trailing comma", d2.latex, "\\frac{1}{2}\\cdot \\beta");
// 3. Rich text splitting
eq("inline math", splitRichText("Area is $\\frac{1}{2}bh$ here"), [{type:"text",value:"Area is "},{type:"math",value:"\\frac{1}{2}bh",display:false},{type:"text",value:" here"}]);
eq("currency stays text", splitRichText("It costs $5 and $10 total"), [{type:"text",value:"It costs $5 and $10 total"}]);
eq("display math", splitRichText("See $$E=mc^2$$ ok"), [{type:"text",value:"See "},{type:"math",value:"E=mc^2",display:true},{type:"text",value:" ok"}]);
// 4. Validation + plain text
eq("valid latex", latexError("\\frac{a}{b}"), null);
eq("invalid latex flagged", typeof latexError("\\frac{a}{") , "string");
eq("plain frac", latexToPlain("\\frac{a+b}{2}"), "(a+b)/(2)");
eq("plain sqrt+sup", latexToPlain("x^{2} + \\sqrt{y} \\times \\pi"), "x² + √(y) × π");
eq("plain sub", latexToPlain("v_{0} + a_1 t"), "v₀ + a₁ t");
eq("katex html non-empty", renderLatexHTML("a^2+b^2=c^2").length > 50, true);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
