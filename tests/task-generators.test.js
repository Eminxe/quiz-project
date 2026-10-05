const test = require("node:test");
const assert = require("node:assert/strict");
const {
  listGenerators,
  generateQuestion,
  generatePracticeSet,
  generateVariant
} = require("../packages/task-generators/src");
const { buildRuntimeQuestion, checkAnswer } = require("../packages/validation/src");

const SEEDS = Array.from({ length: 400 }, (_, i) => `seed-${i}`);

// Turns the LaTeX the generators print into JavaScript, so the tests check
// the answer against what the student actually sees, independently of the
// generator's own arithmetic.
function latexToJs(latex) {
  let s = latex
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\{,\}/g, ".")
    .replace(/\\cdot/g, "*")
    .replace(/:/g, "/");

  let previous;
  do {
    previous = s;
    s = s
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))")
      .replace(/\\sqrt\{([^{}]*)\}/g, "Math.sqrt($1)")
      .replace(/\^\{([^{}]*)\}/g, "**($1)");
  } while (s !== previous);

  return s
    .replace(/\^(\d)/g, "**$1")
    .replace(/(\d)\s*([a-z(])/g, "$1*$2")
    .replace(/\)\s*\(/g, ")*(")
    .replace(/\)\s*([a-z])/g, ")*$1")
    // JS forbids "-x**2"; LaTeX "-x^2" means -(x^2).
    .replace(/([a-z])\*\*(\d)/g, "($1**$2)");
}

function evaluate(latex, scope = {}) {
  const names = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `return (${latexToJs(latex)});`)(...names.map((n) => scope[n]));
}

function firstMath(prompt) {
  return prompt.match(/\\\((.*?)\\\)/)[1];
}

function close(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function forEachSeed(taskNumber, template, fn) {
  for (const seed of SEEDS) {
    const question = generateQuestion({ examType: "OGE", taskNumber, seed, template });
    fn(question, seed);
  }
}

test("every template produces valid, gradable tasks for many seeds", () => {
  for (const { taskNumber, templates } of listGenerators()) {
    for (const template of templates) {
      forEachSeed(taskNumber, template, (question, seed) => {
        const label = `${taskNumber}/${template}/${seed}`;
        assert.ok(question.prompt.length > 20, label);
        assert.doesNotMatch(question.prompt + question.solution, /undefined|NaN|Infinity|\$/, label);
        assert.equal(question.examTaskNumber, taskNumber, label);

        // The same pipeline the site uses must accept the stored answer.
        const runtime = buildRuntimeQuestion(
          {
            id: "q",
            orderIndex: 1,
            type: question.type,
            prompt: question.prompt,
            solution: question.solution,
            answerJson: { answer: question.answer, options: question.options, raw: question }
          },
          { includeAnswers: true }
        );

        const submitted = question.type === "single_choice" ? runtime.answer.value : question.answer.display;
        assert.equal(checkAnswer(submitted, runtime), true, label);
      });
    }
  }
});

test("same seed gives the same task, different seeds give different tasks", () => {
  const a = generateQuestion({ examType: "OGE", taskNumber: 9, seed: 42 });
  const b = generateQuestion({ examType: "OGE", taskNumber: 9, seed: 42 });
  assert.deepEqual(a, b);

  const prompts = new Set(SEEDS.map((seed) => generateQuestion({ examType: "OGE", taskNumber: 9, seed }).prompt));
  assert.ok(prompts.size > SEEDS.length * 0.85, `${prompts.size} distinct of ${SEEDS.length}`);
});

test("№6 and №8: the printed expression evaluates to the answer", () => {
  for (const template of ["fractionSum", "decimalQuotient", "powers", "rootProduct"]) {
    const taskNumber = template === "rootProduct" ? 8 : 6;
    forEachSeed(taskNumber, template, (q, seed) => {
      assert.ok(close(evaluate(firstMath(q.prompt)), q.answer.value), `${template}/${seed}: ${q.prompt}`);
    });
  }

  for (const template of ["powerRules", "shortMultiplication"]) {
    forEachSeed(8, template, (q, seed) => {
      const [expression, assignment] = [...q.prompt.matchAll(/\\\((.*?)\\\)/g)].map((m) => m[1]);
      const [name, value] = assignment.split("=").map((part) => part.trim());
      const scope = { [name]: Number(value.replace("{,}", ".")) };
      assert.ok(close(evaluate(expression, scope), q.answer.value), `${template}/${seed}: ${q.prompt}`);
    });
  }
});

test("№9: the answer is a root of the printed equation and the right one", () => {
  for (const template of ["linear", "quadratic", "proportion"]) {
    forEachSeed(9, template, (q, seed) => {
      const [left, right] = firstMath(q.prompt).split("=");
      const at = (x) => evaluate(left, { x }) - evaluate(right, { x });
      assert.ok(close(at(q.answer.value), 0), `${template}/${seed}: ${q.prompt}`);

      if (template === "quadratic") {
        // Other root by Vieta from the printed coefficients:
        // a = (f(1) + f(-1)) / 2 - f(0), r1·r2 = f(0) / a.
        const a = (at(1) + at(-1)) / 2 - at(0);
        const other = at(0) / a / q.answer.value;
        const wantsLarger = q.prompt.includes("больший");
        assert.ok(wantsLarger ? q.answer.value > other : q.answer.value < other, `${seed}: ${q.prompt}`);
      }
    });
  }
});

test("№13: the marked interval is exactly the solution set", () => {
  for (const template of ["linear", "quadratic"]) {
    forEachSeed(13, template, (q, seed) => {
      const inequality = firstMath(q.prompt)
        .replace(/\\ge/g, ">=")
        .replace(/\\le/g, "<=");
      const [, left, op, right] = inequality.match(/^(.*?)\s*(>=|<=|>|<)\s*(.*)$/);
      const holds = (x) => {
        const l = evaluate(left, { x });
        const r = evaluate(right, { x });
        return { ">": l > r, "<": l < r, ">=": l >= r, "<=": l <= r }[op];
      };

      const interval = q.options[q.correct].replace(/\\\(|\\\)/g, "");
      const contains = (x) =>
        interval.split("\\cup").some((part) => {
          const [, open, a, b, close] = part.trim().match(/^([([])(.*?);\s*(.*?)([)\]])$/);
          const lo = a.includes("infty") ? -Infinity : Number(a);
          const hi = b.includes("infty") ? Infinity : Number(b);
          return (open === "[" ? x >= lo : x > lo) && (close === "]" ? x <= hi : x < hi);
        });

      for (let x = -12; x <= 12; x += 0.5) {
        assert.equal(contains(x), holds(x), `${template}/${seed} at x=${x}: ${q.prompt} -> ${interval}`);
      }
    });
  }
});

test("geometry answers match the numbers in the statement", () => {
  forEachSeed(15, "pythagoras", (q) => {
    const numbers = q.prompt.match(/\d+/g).map(Number);
    const [p, r] = numbers;
    const x = q.answer.value;
    assert.ok(q.prompt.includes("Катеты") ? close(p * p + r * r, x * x) : close(p * p - r * r, x * x), q.prompt);
  });

  forEachSeed(16, "tangent", (q) => {
    const [radius, distance] = q.prompt.match(/\d+/g).map(Number);
    assert.ok(close(radius ** 2 + q.answer.value ** 2, distance ** 2), q.prompt);
  });

  forEachSeed(15, "angles", (q) => {
    const numbers = (q.prompt.match(/(\d+)\^\\circ/g) || []).map((m) => parseInt(m, 10));
    const total = q.prompt.includes("равнобедренном") ? numbers[0] + 2 * q.answer.value : numbers[0] + numbers[1] + q.answer.value;
    assert.equal(total, 180, q.prompt);
    assert.ok(q.answer.value > 0, q.prompt);
  });
});

test("№10: probabilities are between 0 and 1", () => {
  forEachSeed(10, undefined, (q) => {
    assert.ok(q.answer.value > 0 && q.answer.value < 1, q.prompt);
  });
});

test("practice set has distinct tasks and a variant covers every generator", () => {
  const set = generatePracticeSet({ examType: "OGE", taskNumber: 15, count: 10, seed: "p" });
  assert.equal(set.length, 10);
  assert.equal(new Set(set.map((q) => q.prompt)).size, 10);
  assert.deepEqual(set.map((q) => q.orderIndex), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const variant = generateVariant({ examType: "OGE", seed: "v" });
  assert.deepEqual(
    variant.map((q) => q.examTaskNumber),
    listGenerators().map((g) => g.taskNumber)
  );
});
