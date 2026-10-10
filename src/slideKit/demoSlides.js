// Showcase slides appended to the built-in demo module so every new slide type
// can be seen working without generating anything. Content is deliberately
// verified by .tests/t_demo.mjs (maths recomputed, diagram parsed).

export const DEMO_SHOWCASE_SLIDES = [
  {
    type: "code_walkthrough",
    title: "Walkthrough: Area of a Circle",
    bullets: [
      "A variable stores a value; the type (double) says what kind of value",
      "Math.PI is a constant provided by Java's standard library",
      "String + number joins them into text for printing",
    ],
    detail: "Notice how each line does exactly one job: declare the program, store an input, compute a result, then show it. Reading code in this order is a habit worth building early.",
    notes: "Walk through the program line by line using the highlighted lines. Keep the narration tied to the highlighted code.",
    hasCode: true,
    language: "java",
    filename: "Circle.java",
    code: `public class Circle {
    public static void main(String[] args) {
        double radius = 5.0;
        double area = Math.PI * radius * radius;
        System.out.println("Area: " + area);
    }
}`,
    introSay: "Let's read a small program that works out the area of a circle, one line at a time.",
    codeSteps: [
      { lines: [1, 2], say: "First we declare a class called Circle and the main method, which is where Java starts running our program." },
      { lines: [3, 3], say: "Here we store the radius in a variable of type double, which holds decimal numbers. We set it to five." },
      { lines: [4, 4], say: "Now we compute the area. Pi times radius times radius, and we save the answer in a second double called area." },
      { lines: [5, 5], say: "Finally println prints the text Area, followed by the value we calculated, to the console." },
    ],
    expectedOutput: "Area: 78.53981633974483",
    concepts: ["variables", "program structure"],
    prerequisites: [],
    check: {
      question: "In `double radius = 5.0;`, what does the word `double` tell Java?",
      options: ["The variable can hold decimal numbers", "The variable is stored twice", "The value must be doubled", "The variable can never change"],
      answer: 0,
      explanation: "double is the type: it says the variable holds decimal numbers. The tempting answer is that it doubles the value, but doubling would need a multiplication.",
      concept: "variables",
    },
  },
  {
    type: "worked_example",
    title: "Worked Example: Area by Hand",
    bullets: ["Square the radius first, then multiply by pi", "Keep pi exact until the final rounding step"],
    detail: "The program above and this hand calculation must agree, so doing the maths on paper first is a good way to check your code.",
    notes: "Work through the calculation step by step as each step appears.",
    formulas: [{ latex: "A = \\pi r^{2}", caption: "Area of a circle" }],
    problem: { text: "Find the area of a circle with radius $r = 5$ cm.", latex: "A = \\pi r^{2}" },
    problemSay: "Let's check our program by working out the same area by hand, for a circle with a radius of five centimetres.",
    steps: [
      { label: "Substitute", say: "We start with the formula, area equals pi times r squared, and put in r equals five.", latex: "A = \\pi \\times 5^{2}" },
      { label: "Square the radius", say: "Five squared is twenty-five.", latex: "5^{2} = 25", verify: { expression: "5^2", expected: "25" }, verified: true },
      { label: "Multiply by pi", say: "So the area is twenty-five pi, which is about seventy-eight point five four.", latex: "A = 25\\pi \\approx 78.54", verify: { expression: "25*pi", expected: "78.5398163" }, verified: true },
    ],
    finalAnswer: { text: "The area is about 78.54 square centimetres.", latex: "A \\approx 78.54\\ \\text{cm}^{2}" },
    finalSay: "So the area is roughly seventy-eight point five four square centimetres, which matches what our program printed.",
    concepts: ["order of operations", "area of a circle"],
    prerequisites: ["variables"],
    check: {
      question: "What is $3^{2}$ before it is multiplied by $\\pi$?",
      options: ["6", "9", "5", "8"],
      answer: 1,
      explanation: "Three squared is three times three, which is nine. The tempting answer is six, which is what you get by multiplying three by two instead of squaring.",
      concept: "order of operations",
    },
  },
  {
    type: "diagram",
    title: "From Source Code to Output",
    bullets: ["javac turns source into bytecode", "The JVM runs the bytecode", "The same bytecode runs on any device with a JVM"],
    detail: "Each arrow in the diagram is a separate tool or step, which is why compiling and running are always two commands.",
    notes: "Walk through the diagram from left to right, one box at a time.",
    concepts: ["compile and run"],
    prerequisites: ["program structure"],
    check: {
      question: "Which tool turns a .java source file into bytecode?",
      options: ["java", "javac", "JVM", "main"],
      answer: 1,
      explanation: "javac is the compiler that produces bytecode. The tempting answer is java, but that command runs bytecode that already exists.",
      concept: "compile and run",
    },
    diagram: {
      code: `flowchart LR
  A["Source code (.java)"] -->|javac| B["Bytecode (.class)"]
  B -->|java| C["JVM"]
  C --> D["Program output"]`,
      caption: "The compile-then-run pipeline in Java",
    },
  },
  {
    type: "comparison",
    title: "Primitive vs Reference Types",
    bullets: ["Primitives hold the value itself", "References hold the address of an object"],
    detail: "This difference explains many surprising behaviours later, such as why comparing two Strings with == can fail.",
    notes: "Compare the two columns row by row.",
    table: {
      headers: ["Aspect", "Primitive", "Reference"],
      rows: [
        ["Examples", "int, double, boolean, char", "String, arrays, any class"],
        ["Stores", "The actual value", "A pointer to an object"],
        ["Default value", "0, 0.0 or false", "null"],
        ["Compared with", "==", ".equals() for contents"],
      ],
    },
  },
  {
    type: "summary",
    title: "Recap",
    bullets: [],
    detail: "Next time we build on this by writing methods of our own.",
    notes: "Recap the key ideas and ask the check question.",
    takeaways: [
      "Java compiles to bytecode, and the JVM runs it anywhere",
      "Every program starts at the main method",
      "A variable has a type that decides what it can hold",
      "Check your code against a hand calculation",
    ],
    checkQuestion: { question: "Why does Java need two steps, compiling and then running?", answer: "Compiling turns source code into portable bytecode; the JVM then runs that bytecode on whatever device you are using." },
  },
];
