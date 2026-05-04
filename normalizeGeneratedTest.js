"use strict";

function normalizeType(type) {
  const value = String(type || "").trim();

  if (value === "single") return "single_choice";
  if (value === "choice") return "single_choice";

  return value || "numeric";
}

function optionToText(option) {
  if (typeof option === "string") return option;

  if (option && typeof option === "object") {
    return String(option.text || option.label || option.value || "");
  }

  return "";
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\dfrac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1/$2")
    .replace(/[{}]/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .trim();
}

function unique(values) {
  const result = [];
  const seen = new Set();

  for (const value of values) {
    const text = String(value ?? "").trim();

    if (!text) continue;

    const key = normalizeText(text);

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(text);
  }

  return result;
}

function getAnswerCandidates(question) {
  const answer = question?.answer || {};
  const candidates = [];

  candidates.push(answer.value);
  candidates.push(answer.display);

  if (Array.isArray(answer.accepted)) {
    candidates.push(...answer.accepted);
  }

  candidates.push(question?.correctAnswer);
  candidates.push(question?.expectedAnswer);

  return unique(candidates);
}

function findOptionIndexByAnswer(question, optionTexts) {
  const candidates = getAnswerCandidates(question).map(normalizeText);

  if (candidates.length === 0) {
    return -1;
  }

  for (let i = 0; i < optionTexts.length; i += 1) {
    const optionKey = normalizeText(optionTexts[i]);

    if (candidates.includes(optionKey)) {
      return i;
    }
  }

  return -1;
}

function resolveCorrectIndex(question, optionTexts) {
  const byAnswer = findOptionIndexByAnswer(question, optionTexts);

  if (byAnswer >= 0) {
    return byAnswer;
  }

  const rawCorrect = question?.correct;

  if (Number.isInteger(rawCorrect)) {
    if (rawCorrect >= 0 && rawCorrect < optionTexts.length) {
      return rawCorrect;
    }

    if (rawCorrect >= 1 && rawCorrect <= optionTexts.length) {
      return rawCorrect - 1;
    }
  }

  return null;
}

function normalizeSingleChoiceQuestion(question) {
  const optionTexts = Array.isArray(question?.options)
    ? question.options.map(optionToText).filter((text) => text.trim())
    : [];

  const normalized = {
    ...question,
    type: "single_choice",
    options: optionTexts,
  };

  const correctIndex = resolveCorrectIndex(question, optionTexts);

  if (correctIndex === null || !optionTexts[correctIndex]) {
    return normalized;
  }

  const correctText = optionTexts[correctIndex];

  normalized.correct = correctIndex;
  normalized.answer = {
    ...(question.answer || {}),
    type: "single_choice",
    value: correctText,
    display: correctText,
    accepted: unique([
      correctText,
      ...(Array.isArray(question?.answer?.accepted)
        ? question.answer.accepted
        : []),
    ]),
    tolerance: null,
  };

  return normalized;
}

function normalizeNumericQuestion(question) {
  const answer = question?.answer || {};

  return {
    ...question,
    type: "numeric",
    options: [],
    correct: null,
    answer: {
      ...answer,
      type: "numeric",
      accepted: Array.isArray(answer.accepted)
        ? answer.accepted
        : answer.display || answer.value !== undefined
          ? [String(answer.display ?? answer.value)]
          : [],
      tolerance:
        answer.tolerance === undefined || answer.tolerance === null
          ? 0
          : answer.tolerance,
    },
  };
}

function normalizeQuestion(question, index, config = {}) {
  const type = normalizeType(question?.type);

  const base = {
    ...question,
    id: question?.id || `q${index + 1}`,
    orderIndex: Number.isInteger(question?.orderIndex)
      ? question.orderIndex
      : index + 1,
    examTaskNumber:
      question?.examTaskNumber || config.examTaskNumber || null,
    prompt: String(
      question?.prompt ||
        question?.question ||
        question?.displayQuestionLatex ||
        ""
    ),
    question: String(
      question?.question ||
        question?.prompt ||
        question?.displayQuestionLatex ||
        ""
    ),
    solution: String(question?.solution || question?.explanation || ""),
    explanation: String(question?.explanation || question?.solution || ""),
  };

  if (type === "single_choice") {
    return normalizeSingleChoiceQuestion(base);
  }

  if (type === "numeric") {
    return normalizeNumericQuestion(base);
  }

  return {
    ...base,
    type,
  };
}

function normalizeGeneratedTestForCritic(test, config = {}) {
  const questions = Array.isArray(test?.questions) ? test.questions : [];

  return {
    ...test,
    questions: questions.map((question, index) =>
      normalizeQuestion(question, index, config)
    ),
    questionCount: questions.length,
  };
}

module.exports = {
  normalizeGeneratedTestForCritic,
};
