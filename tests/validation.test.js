const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRuntimeTest,
  checkAnswer,
  parseNumber
} = require("../packages/validation/src");

function dbTest(questions) {
  return { id: "t1", title: "T", questions };
}

test("AI single_choice with string options gets option ids and a checkable answer", () => {
  const runtime = buildRuntimeTest(
    dbTest([
      {
        id: "q1",
        orderIndex: 1,
        type: "single_choice",
        prompt: "\\(2+2\\)",
        solution: "4",
        answerJson: {
          answer: { type: "single_choice", value: "\\(4\\)", accepted: ["\\(4\\)"] },
          options: ["\\(3\\)", "\\(4\\)", "\\(5\\)", "\\(6\\)"],
          raw: { correct: 1 }
        }
      }
    ]),
    { includeAnswers: true }
  );

  const question = runtime.questions[0];
  assert.deepEqual(question.options[1], { id: "B", text: "\\(4\\)" });
  assert.equal(question.answer.value, "B");
  assert.equal(checkAnswer("B", question), true);
  assert.equal(checkAnswer("A", question), false);
});

test("mock single_choice with object options keeps its ids", () => {
  const runtime = buildRuntimeTest(
    dbTest([
      {
        id: "q1",
        orderIndex: 1,
        type: "single_choice",
        prompt: "p",
        answerJson: {
          answer: { type: "single_choice", value: "C" },
          options: [
            { id: "A", text: "1" },
            { id: "B", text: "2" },
            { id: "C", text: "3" }
          ]
        }
      }
    ]),
    { includeAnswers: true }
  );

  assert.equal(runtime.questions[0].answer.value, "C");
  assert.equal(checkAnswer("C", runtime.questions[0]), true);
});

test("answers are hidden unless requested", () => {
  const runtime = buildRuntimeTest(
    dbTest([{ id: "q1", orderIndex: 1, type: "numeric", prompt: "p", solution: "s", answerJson: { answer: { value: 1 } } }])
  );

  assert.equal("answer" in runtime.questions[0], false);
  assert.equal("solution" in runtime.questions[0], false);
});

test("numeric answers accept commas, fractions and unicode minus", () => {
  const question = { type: "numeric", answer: { value: "-0.75", accepted: [], tolerance: 0 } };

  assert.equal(checkAnswer("-0,75", question), true);
  assert.equal(checkAnswer("−3/4", question), true);
  assert.equal(checkAnswer("-0.7", question), false);
  assert.equal(checkAnswer("", question), false);
  assert.equal(parseNumber("\\frac{3}{4}"), 0.75);
});

test("full_solution is never auto-graded as correct", () => {
  const question = { type: "full_solution", answer: { value: "x=2", accepted: [] } };
  assert.equal(checkAnswer("x=2", question), false);
});
