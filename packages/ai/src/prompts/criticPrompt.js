"use strict";

const { LATEX_RULES } = require("./shared");

function buildCriticPrompt(config, draftTest) {
  const questions = Array.isArray(draftTest?.questions) ? draftTest.questions : [];

  return `
You are a strict reviewer of math tests for the Russian ОГЭ / ЕГЭ (profile) exams.

Review every question of the test below. Solve each question yourself from scratch
before judging it; never trust the provided answer or solution.

CONTEXT:
- Exam type: ${config.examType || config.examFormat || "CUSTOM"}
- Mode: ${config.mode || "practice"}
- Topic: ${config.topicLabel || config.topic || "not specified"}
- Exam task number: ${config.examTaskNumber || "not specified"}
- Difficulty: ${config.difficulty || "medium"}
- Allowed question types: ${(config.taskTypes || []).join(", ") || "any"}
- Expected question count: ${config.questionCount || questions.length}

FOR EACH QUESTION CHECK:
1. The statement is complete, unambiguous and solvable.
2. Your own answer equals answer.value; the solution reaches the same answer.
3. For single_choice: options is an array of strings, exactly one option is correct,
   correct is the zero-based index of it, answer.display equals options[correct].
4. The question matches the exam task number / topic and the difficulty.
5. Formulas follow the LaTeX rules below.
${LATEX_RULES}

SEVERITY:
- "fatal": wrong answer, unsolvable or ambiguous statement, no correct option.
- "error": answer/solution mismatch, wrong format, wrong topic, broken LaTeX.
- "warning": style or pedagogical weakness only. Use codes like TOO_EASY, WEAK_DISTRACTORS, LOW_VARIETY for these.

STATUS:
- "pass": no error or fatal issues.
- "repairable": can be fixed by editing the question.
- "regenerate": the question must be replaced.

Return one questionReport per question, with zero-based "index" from 0 to ${questions.length - 1}.
Set top-level "pass" to true only if every report has status "pass" and there are no error or fatal global issues.

TEST JSON:
${JSON.stringify(draftTest, null, 2)}
`;
}

module.exports = {
  buildCriticPrompt
};
