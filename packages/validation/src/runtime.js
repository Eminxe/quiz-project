"use strict";

const { normalizeText } = require("./answers");

const OPTION_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function normalizeType(type) {
  const value = String(type || "").trim();

  if (value === "single" || value === "choice") return "single_choice";
  if (value === "multiple") return "multiple_choice";
  if (value === "number") return "numeric";

  return value || "numeric";
}

// Generated options arrive either as strings (AI pipeline) or as
// { id, text } objects (mock engine, older tests). The client always gets
// { id, text } so it can render and submit a stable option id.
function toOptionList(rawOptions) {
  if (!Array.isArray(rawOptions)) return null;

  const options = rawOptions
    .map((option, index) => {
      if (typeof option === "string" || typeof option === "number") {
        return { id: OPTION_IDS[index] || String(index + 1), text: String(option) };
      }

      if (option && typeof option === "object") {
        return {
          id: String(option.id ?? OPTION_IDS[index] ?? index + 1),
          text: String(option.text ?? option.label ?? option.value ?? "")
        };
      }

      return null;
    })
    .filter((option) => option && option.text.trim());

  return options.length ? options : null;
}

function findCorrectOption(options, rawAnswer, rawCorrect) {
  if (Number.isInteger(rawCorrect) && options[rawCorrect]) {
    return options[rawCorrect];
  }

  const candidates = [
    rawAnswer?.value,
    rawAnswer?.display,
    ...(Array.isArray(rawAnswer?.accepted) ? rawAnswer.accepted : [])
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(String);

  for (const candidate of candidates) {
    const byId = options.find(
      (option) => option.id.toLowerCase() === candidate.trim().toLowerCase()
    );
    if (byId) return byId;
  }

  for (const candidate of candidates) {
    const key = normalizeText(candidate);
    const byText = options.find((option) => normalizeText(option.text) === key);
    if (byText) return byText;
  }

  return null;
}

function buildRuntimeAnswer(type, rawAnswer, options, rawCorrect) {
  if (type === "single_choice" && options) {
    const correct = findCorrectOption(options, rawAnswer, rawCorrect);

    if (!correct) return null;

    return {
      type,
      value: correct.id,
      display: correct.text,
      accepted: [correct.id, correct.text],
      tolerance: null
    };
  }

  if (!rawAnswer || typeof rawAnswer !== "object") {
    return rawAnswer === null || rawAnswer === undefined
      ? null
      : { type, value: rawAnswer, display: String(rawAnswer), accepted: [], tolerance: 0 };
  }

  return {
    type,
    value: rawAnswer.value ?? null,
    display: rawAnswer.display ?? (rawAnswer.value != null ? String(rawAnswer.value) : null),
    accepted: Array.isArray(rawAnswer.accepted) ? rawAnswer.accepted.map(String) : [],
    tolerance: rawAnswer.tolerance ?? 0
  };
}

function buildRuntimeQuestion(question, options = {}) {
  const answerJson =
    question.answerJson && typeof question.answerJson === "object"
      ? question.answerJson
      : {};
  const raw = answerJson.raw && typeof answerJson.raw === "object" ? answerJson.raw : {};

  const type = normalizeType(question.type);
  const runtimeOptions = toOptionList(answerJson.options ?? raw.options);

  const runtime = {
    id: question.id,
    orderIndex: question.orderIndex,
    examTaskNumber: raw.examTaskNumber ?? null,
    type,
    prompt: question.prompt,
    options: runtimeOptions,
    visual: answerJson.visual || null
  };

  if (options.includeAnswers) {
    runtime.answer = buildRuntimeAnswer(
      type,
      answerJson.answer ?? raw.answer,
      runtimeOptions,
      Number.isInteger(raw.correct) ? raw.correct : null
    );
  }

  if (options.includeSolutions) {
    runtime.solution = question.solution || null;
  }

  return runtime;
}

function buildRuntimeTest(test, options = {}) {
  const questions = Array.isArray(test?.questions)
    ? [...test.questions].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  return {
    id: test.id,
    title: test.title,
    subject: test.subject,
    examFormat: test.examFormat,
    difficulty: test.difficulty,
    language: test.language,
    status: test.status,
    createdAt: test.createdAt,
    questionCount: questions.length,
    questions: questions.map((question) => buildRuntimeQuestion(question, options))
  };
}

module.exports = {
  toOptionList,
  buildRuntimeQuestion,
  buildRuntimeTest
};
