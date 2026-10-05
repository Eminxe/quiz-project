"use strict";

const { createRng } = require("./random");
const { dec, clean, decimalPlaces } = require("./format");

const GENERATORS = [
  require("./oge/task06"),
  require("./oge/task08"),
  require("./oge/task09"),
  require("./oge/task10"),
  require("./oge/task12"),
  require("./oge/task13"),
  require("./oge/task14"),
  require("./oge/task15"),
  require("./oge/task16"),
  require("./oge/task17")
];

const MAX_TRIES = 50;

function findGenerator(examType, taskNumber) {
  return (
    GENERATORS.find(
      (generator) =>
        generator.examType === examType && generator.taskNumber === Number(taskNumber)
    ) || null
  );
}

function hasGenerator(examType, taskNumber) {
  return Boolean(findGenerator(examType, taskNumber));
}

function listGenerators() {
  return GENERATORS.map((generator) => ({
    examType: generator.examType,
    taskNumber: generator.taskNumber,
    templates: Object.keys(generator.templates)
  }));
}

// ОГЭ part 1 answers are integers or finite decimals that fit the answer form.
function isValidNumericAnswer(value) {
  return Number.isFinite(value) && Math.abs(value) < 1e7 && decimalPlaces(value) <= 4;
}

function isValidDraft(draft) {
  if (!draft || typeof draft.prompt !== "string" || !draft.prompt.trim()) return false;
  if (/undefined|NaN|Infinity|\[object/.test(draft.prompt + draft.solution)) return false;

  if (draft.type === "single_choice") {
    return (
      Array.isArray(draft.options) &&
      new Set(draft.options).size === draft.options.length &&
      Number.isInteger(draft.correct) &&
      draft.correct >= 0 &&
      draft.correct < draft.options.length
    );
  }

  return isValidNumericAnswer(draft.answer);
}

function toQuestion(draft, { generator, template, seed }) {
  const meta = {
    generatedBy: "template",
    generator: `${generator.examType}-${generator.taskNumber}:${template}`,
    seed: String(seed)
  };

  if (draft.type === "single_choice") {
    const correctText = draft.options[draft.correct];

    return {
      type: "single_choice",
      examTaskNumber: generator.taskNumber,
      prompt: draft.prompt,
      options: draft.options,
      correct: draft.correct,
      answer: {
        type: "single_choice",
        value: correctText,
        display: correctText,
        accepted: [correctText],
        tolerance: null
      },
      solution: draft.solution,
      meta
    };
  }

  const value = clean(draft.answer);

  return {
    type: "numeric",
    examTaskNumber: generator.taskNumber,
    prompt: draft.prompt,
    options: null,
    correct: null,
    answer: {
      type: "numeric",
      value,
      display: dec(value),
      accepted: [...new Set([dec(value), String(value)])],
      tolerance: 0
    },
    solution: draft.solution,
    meta
  };
}

// One task for an exam number. A template may reject unlucky random numbers
// (returns null or fails validation); then the next number from the same
// seeded stream is tried, so the result is still reproducible.
function generateQuestion({ examType, taskNumber, seed, template: templateName }) {
  const generator = findGenerator(examType, taskNumber);

  if (!generator) {
    throw new Error(`No generator for ${examType} task ${taskNumber}`);
  }

  const rng = createRng(`${examType}:${taskNumber}:${seed}`);
  const names = Object.keys(generator.templates);

  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const template = templateName || rng.pick(names);
    const draft = generator.templates[template](rng);
    const normalized = draft ? { type: "numeric", ...draft } : null;

    if (isValidDraft(normalized)) {
      return toQuestion(normalized, { generator, template, seed });
    }
  }

  throw new Error(`Generator ${examType}-${taskNumber} failed to produce a valid task`);
}

// Several different tasks for one number (practice mode).
function generatePracticeSet({ examType, taskNumber, count, seed }) {
  const questions = [];
  const prompts = new Set();

  for (let i = 0; questions.length < count && i < count * 20; i += 1) {
    const question = generateQuestion({ examType, taskNumber, seed: `${seed}:${i}` });

    if (!prompts.has(question.prompt)) {
      prompts.add(question.prompt);
      questions.push(question);
    }
  }

  return questions.map((question, index) => ({ ...question, orderIndex: index + 1 }));
}

// A variant: one task per exam number that has a generator.
function generateVariant({ examType, seed, taskNumbers }) {
  const numbers = (taskNumbers || GENERATORS.filter((g) => g.examType === examType).map((g) => g.taskNumber))
    .filter((number) => hasGenerator(examType, number))
    .sort((a, b) => a - b);

  return numbers.map((taskNumber, index) => ({
    ...generateQuestion({ examType, taskNumber, seed }),
    orderIndex: index + 1
  }));
}

module.exports = {
  hasGenerator,
  listGenerators,
  generateQuestion,
  generatePracticeSet,
  generateVariant
};
