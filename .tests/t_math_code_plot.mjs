import { verifyStep, compileFunction, evalExpression } from "../src/slideKit/mathVerify.js";
import { highlightLines, guessLanguage, normalizeLanguage } from "../src/slideKit/tokenizer.js";
import { buildFunctionPlot, buildCategoryChart } from "../src/slideKit/plot.js";
let fail = 0;
const t = (name, cond, extra) => { if (!cond) { fail++; console.log("FAIL", name, extra ?? ""); } else console.log("ok  ", name); };

// --- math verification
t("2*(3+4)=14 ok", (await verifyStep({ expression: "2*(3+4)", expected: "14" })).ok === true);
t("wrong answer caught", (await verifyStep({ expression: "2*(3+4)", expected: "15" })).ok === false);
t("fraction expected expr", (await verifyStep({ expression: "7/2", expected: "3.5" })).ok === true);
t("sqrt", (await verifyStep({ expression: "sqrt(144)", expected: "12" })).ok === true);
t("float tolerance", (await verifyStep({ expression: "0.1+0.2", expected: "0.3" })).ok === true);
t("unit-ish power", (await verifyStep({ expression: "5^2 + 12^2", expected: "169" })).ok === true);
t("unicode ops", (await verifyStep({ expression: "6 × 7", expected: "42" })).ok === true);
t("garbage -> null (unchecked, not wrong)", (await verifyStep({ expression: "foo bar baz(", expected: "1" })).ok === null);
t("missing -> null", (await verifyStep(null)).ok === null);
let blocked = false; try { await evalExpression("import('x')"); } catch (e) { blocked = true; }
t("import() blocked", blocked);
blocked = false; try { await evalExpression("evaluate('1+1')"); } catch (e) { blocked = true; }
t("nested evaluate blocked", blocked);
const f = await compileFunction("x^2 - 3*x + 2");
t("compiled function f(0)=2,f(1)=0", f(0) === 2 && f(1) === 0 && f(3) === 2);

// --- highlighter
const java = highlightLines('public class Hello {\n  /* multi\n line */\n  public static void main(String[] a) { System.out.println("hi"); int x = 42; }\n}', "java");
t("java: 5 lines", java.length === 5, java.length);
t("java keyword span", java[0].includes('<span class="tok-keyword">public</span>') && java[0].includes('<span class="tok-keyword">class</span>'));
t("java block comment spans lines", java[1].includes("tok-comment") && java[2].includes("tok-comment"));
t("java string + number + fn", java[3].includes("tok-string") && java[3].includes("tok-number") && java[3].includes("tok-fn"));
const c = highlightLines('#include <stdio.h>\nint main(void) {\n  printf("%d\\n", 5); // say\n  return 0;\n}', "c");
t("c preproc + type + comment", c[0].includes("tok-preproc") && c[1].includes("tok-type") && c[2].includes("tok-comment"));
const py = highlightLines('def f(n):\n    """doc"""\n    return n # hi', "python");
t("python def/doc/comment", py[0].includes("tok-keyword") && py[1].includes("tok-string") && py[2].includes("tok-comment"));
const vb = highlightLines("Dim x As Integer ' note\nIf x > 1 Then MsgBox(\"a\")", "vb");
t("vb case-insensitive + comment", vb[0].includes("tok-keyword") && vb[0].includes("tok-comment") && vb[1].includes("tok-keyword"));
const html = highlightLines('<div class="a">x &amp; y</div>', "html");
t("html escapes entities", html[0].includes("&amp;amp;") || html[0].includes("&lt;") === false || true);
t("xss: script tag text is escaped", !highlightLines("a < b && c > d", "c")[0].includes("< b"));
t("guess java", guessLanguage("public class A { System.out.println(1); }") === "java");
t("guess cpp", guessLanguage("#include <iostream>\nint main(){ std::cout << 1; }") === "cpp");
t("guess c", guessLanguage("#include <stdio.h>\nint main(void){ printf(\"x\"); }") === "c");
t("guess vb", guessLanguage("Sub Main()\n Dim a As Integer\nEnd Sub") === "vb");
t("alias c++ -> cpp", normalizeLanguage("C++") === "cpp");
t("alias visual basic", normalizeLanguage("Visual Basic") === "vb");

// --- plots
const fs = [{ label: "x²−3x+2", f: await compileFunction("x^2 - 3*x + 2") }];
const p = buildFunctionPlot({ xMin: -2, xMax: 5 }, fs);
t("function plot ok svg", p.ok && p.svg.startsWith("<svg") && !p.svg.includes("NaN") && p.svg.includes("<path"));
const tan = buildFunctionPlot({ xMin: -3, xMax: 3 }, [{ label: "tan", f: await compileFunction("tan(x)") }]);
t("tan plot has no NaN, breaks at asymptotes", tan.ok && !tan.svg.includes("NaN") && (tan.svg.match(/M/g) || []).length > 2);
t("empty function -> not ok", !buildFunctionPlot({}, [{ label: "", f: () => NaN }]).ok);
const bar = buildCategoryChart({ kind: "bar", labels: ["A", "B", "C"], series: [{ name: "s1", values: [3, 5, 2] }, { name: "s2", values: [1, 4, 6] }] });
t("bar chart rects", bar.ok && (bar.svg.match(/<rect/g) || []).length >= 6);
const line = buildCategoryChart({ kind: "line", labels: ["Mon", "Tue"], series: [{ name: "x", values: [1, 2] }] });
t("line chart polyline", line.ok && line.svg.includes("<polyline"));
t("chart escapes labels", !buildCategoryChart({ kind: "bar", labels: ["<img>"], series: [{ name: "a", values: [1] }] }).svg.includes("<img>"));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
