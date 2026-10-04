"use strict";

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\dfrac/g, "\\frac")
    .replace(/\\,/g, "")
    .replace(/[{}]/g, "")
    .replace(/−/g, "-")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

// Parses "0,75", "-3", "3/4", "\frac{3}{4}", "−2" into a number; NaN otherwise.
function parseNumber(value) {
  if (typeof value === "number") return value;

  const text = String(value ?? "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/−/g, "-")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .trim();

  if (!text) return NaN;

  const frac = text.match(/^(-?)\\d?frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}$/);
  if (frac) {
    const result = Number(frac[2]) / Number(frac[3]);
    return frac[1] === "-" ? -result : result;
  }

  const slash = text.match(/^(-?[\d.]+)\/(-?[\d.]+)$/);
  if (slash) {
    return Number(slash[1]) / Number(slash[2]);
  }

  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(text) ? Number(text) : NaN;
}

function acceptedValues(expectedAnswer) {
  const accepted = Array.isArray(expectedAnswer?.accepted)
    ? [...expectedAnswer.accepted]
    : [];

  if (expectedAnswer?.value !== null && expectedAnswer?.value !== undefined) {
    accepted.push(expectedAnswer.value);
  }

  return accepted;
}

function matchesAccepted(userValue, expectedAnswer) {
  const user = normalizeText(userValue);

  if (!user) return false;

  return acceptedValues(expectedAnswer).some(
    (item) => normalizeText(item) === user
  );
}

function checkNumeric(userValue, expectedAnswer) {
  const userNumber = parseNumber(userValue);

  if (Number.isFinite(userNumber)) {
    const tolerance = Math.abs(Number(expectedAnswer.tolerance ?? 0)) || 1e-9;

    const hit = acceptedValues(expectedAnswer)
      .map(parseNumber)
      .filter(Number.isFinite)
      .some((expected) => Math.abs(userNumber - expected) <= tolerance);

    if (hit) return true;
  }

  return matchesAccepted(userValue, expectedAnswer);
}

// Answers are only auto-graded for formats with a single checkable answer.
// full_solution (part 2 of ОГЭ/ЕГЭ) needs a teacher or a rubric, so it is never
// auto-marked as correct.
function checkAnswer(userValue, runtimeQuestion) {
  const expectedAnswer = runtimeQuestion?.answer;

  if (!expectedAnswer || runtimeQuestion.type === "full_solution") {
    return false;
  }

  if (runtimeQuestion.type === "numeric") {
    return checkNumeric(userValue, expectedAnswer);
  }

  return matchesAccepted(userValue, expectedAnswer);
}

module.exports = {
  normalizeText,
  parseNumber,
  checkAnswer
};
