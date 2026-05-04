"use strict";

const { runRepair } = require("./runRepair");

function getQuestionCount(test) {
  return Array.isArray(test?.questions) ? test.questions.length : 0;
}

function trimToExpected(test, expected) {
  return {
    ...test,
    questions: Array.isArray(test?.questions)
      ? test.questions.slice(0, expected)
      : [],
  };
}

function buildCountCritic(expected, actual, language = "ru") {
  const isEn = String(language).toLowerCase() === "en";

  return {
    pass: false,
    globalIssues: [
      {
        code: "QUESTION_COUNT_MISMATCH",
        severity: "high",
        message: isEn
          ? `The model returned ${actual} questions, but exactly ${expected} are required.`
          : `Модель вернула ${actual} вопросов, но требуется ровно ${expected}.`,
      },
    ],
    questionReports: [],
  };
}

function buildCountPlan(expected, actual) {
  return {
    repairable: Array.from({ length: Math.max(actual, 0) }, (_, i) => i),
    regenerate: Array.from(
      { length: Math.max(expected - actual, 0) },
      (_, i) => actual + i
    ),
  };
}

function buildExtraInstructions(expected, actual, language = "ru") {
  const isEn = String(language).toLowerCase() === "en";

  if (isEn) {
    return `
COUNT RECOVERY TASK:
- The current test has ${actual} questions.
- The final output MUST have exactly ${expected} questions.
- Keep all strong existing questions.
- Generate the missing ${Math.max(expected - actual, 0)} questions now.
- Do not return partial output.`;
  }

  return `
ЗАДАЧА ВОССТАНОВЛЕНИЯ КОЛИЧЕСТВА:
- Сейчас в тесте ${actual} вопросов.
- Финальный результат ДОЛЖЕН содержать ровно ${expected} вопросов.
- Сохрани все сильные уже существующие вопросы.
- Сгенерируй недостающие ${Math.max(expected - actual, 0)} вопросов прямо сейчас.
- Не возвращай частичный результат.`;
}

async function repairQuestionCount(config, test, maxPasses = 3) {
  const expected = Number(config?.questionCount || 0);

  if (!Number.isInteger(expected) || expected <= 0) {
    return test;
  }

  let current = test;

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const actual = getQuestionCount(current);

    if (actual === expected) {
      return current;
    }

    if (actual > expected) {
      return trimToExpected(current, expected);
    }

    current = await runRepair(
      config,
      current,
      buildCountCritic(expected, actual, config?.language),
      buildCountPlan(expected, actual),
      {
        extraInstructions: buildExtraInstructions(
          expected,
          actual,
          config?.language
        ),
      }
    );
  }

  const finalCount = getQuestionCount(current);
  if (finalCount !== expected) {
    throw new Error(
      `Question count recovery failed: got ${finalCount}, expected ${expected}.`
    );
  }

  return current;
}

module.exports = {
  repairQuestionCount,
};
