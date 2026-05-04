"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config();

const OpenAI = require("openai");

const {
  runCritic,
  criticRequiresRepair,
  extractFailedQuestionPlan,
} = require("../pipeline/runCritic");
const { runRepair } = require("../pipeline/runRepair");
const { finalizeTestVisuals } = require("pipeline/finalizeTest");
const { buildDraftPrompt } = require("../../../../packages/ai/src/prompts/draftPrompt");
const {
  validateTestQuality,
  normalizeQuestionCount,
} = require("./generation/validators/qualityValidator");

const ROOT_DIR = __dirname;
const TESTS_DIR = path.join(ROOT_DIR, "tests");
const HISTORY_DIR = path.join(TESTS_DIR, "history");
const CATALOG_PATH = path.join(TESTS_DIR, "catalog.json");

const TEST_SCHEMA_PATH = path.join(
  ROOT_DIR,
  "generation",
  "schemas",
  "test.schema.json"
);

const MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const SKIP_VISUALS_DURING_GENERATION =
  process.env.SKIP_VISUALS_DURING_GENERATION === "1";
const MAX_DRAFT_STAGE_MS = Number(process.env.MAX_DRAFT_STAGE_MS || 120000);
const MAX_CRITIC_STAGE_MS = Number(process.env.MAX_CRITIC_STAGE_MS || 45000);
const MAX_REPAIR_STAGE_MS = Number(process.env.MAX_REPAIR_STAGE_MS || 60000);
const MAX_MODEL_STAGE_MS = Number(process.env.MAX_MODEL_STAGE_MS || 120000);
const MAX_VISUAL_STAGE_MS = Number(process.env.MAX_VISUAL_STAGE_MS || 12000);
const PIPELINE_MAX_ROUNDS = Number(process.env.PIPELINE_MAX_ROUNDS || 1);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const testSchema = JSON.parse(fs.readFileSync(TEST_SCHEMA_PATH, "utf8"));

const SUPPORTED_VISUAL_TEMPLATES = new Set([
  "quadratic_graph",
  "line_graph",
  "probability_urn",
  "triangle_geometry",
  "number_line_interval",
  "math_grid",
  "two_function_graph",
]);

const SUPPORTED_VISUAL_MODES = new Set(["image", "video"]);

const SUPPORTED_TYPES = new Set([
  "single",
  "numeric",
  "short_text",
  "find_error",
  "order_steps",
]);

function withTimeout(promise, ms, label = "operation") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms} ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function getTimestampParts() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  return {
    fullCompact: `${yyyy}${mm}${dd}_${hh}${mi}${ss}`,
    iso: now.toISOString(),
  };
}

function transliterate(value = "") {
  const map = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return String(value)
    .split("")
    .map((ch) => {
      const lower = ch.toLowerCase();
      const t = map[lower];
      if (!t) return ch;
      return ch === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join("");
}

function slugify(value = "") {
  return transliterate(String(value))
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "test";
}

function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n"].includes(v)) return false;
  }
  return fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildRuntimeTestSchema(baseSchema, questionCount) {
  const schema = cloneJson(baseSchema);

  if (
    Number.isInteger(questionCount) &&
    questionCount > 0 &&
    schema &&
    schema.properties &&
    schema.properties.questions
  ) {
    schema.properties.questions.minItems = questionCount;
    schema.properties.questions.maxItems = questionCount;
  }

  return schema;
}

function normalizeLatexDelimiters(text = "") {
  return String(text || "")
    .replaceAll("$begin:math:text$", "\\(")
    .replaceAll("$end:math:text$", "\\)")
    .replaceAll("$begin:display:math$", "\\[")
    .replaceAll("$end:display:math$", "\\]")
    .replaceAll("\\\\(", "\\(")
    .replaceAll("\\\\)", "\\)")
    .replaceAll("\\\\[", "\\[")
    .replaceAll("\\\\]", "\\]")
    .trim();
}

function cleanInlineMathText(text = "") {
  return normalizeLatexDelimiters(String(text || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeBarePoint(text = "") {
  const s = cleanInlineMathText(text);
  return /^\(?\s*-?\d+([.,]\d+)?\s*[;,]\s*-?\d+([.,]\d+)?\s*\)?$/.test(s);
}

function looksLikeNamedPoint(text = "") {
  const s = cleanInlineMathText(text);
  return /^[A-ZА-Я]\s*\(\s*-?\d+([.,]\d+)?\s*[;,]\s*-?\d+([.,]\d+)?\s*\)$/.test(
    s
  );
}

function toNamedPoint(text = "", index = 0) {
  const s = cleanInlineMathText(text);
  if (!looksLikeBarePoint(s)) return s;
  if (looksLikeNamedPoint(s)) return s;

  const letter = String.fromCharCode(65 + index);
  const inner = s.replace(/^\(/, "").replace(/\)$/, "").trim();
  return `${letter}(${inner})`;
}

function splitStructuredMathLines(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return [];

  return raw
    .split(/\n|\\\\/)
    .map((line) => cleanInlineMathText(line))
    .filter(Boolean);
}

function normalizeSupplementaryMathLines(rawValue = "") {
  const lines = splitStructuredMathLines(rawValue);

  return lines.map((line, index) => {
    if (looksLikeBarePoint(line)) {
      return toNamedPoint(line, index);
    }
    return line;
  });
}

function buildStructuredDisplayQuestionLatex(rawValue = "") {
  const lines = normalizeSupplementaryMathLines(rawValue);
  if (!lines.length) return "";
  return lines.join("\n");
}

function extractSupplementaryFromQuestionText(questionText = "") {
  const text = cleanInlineMathText(questionText);
  if (!text) return "";

  const lines = [];

  const namedPoints = text.match(
    /[A-ZА-Я]\s*\(\s*-?\d+(?:[.,]\d+)?\s*[;,]\s*-?\d+(?:[.,]\d+)?\s*\)/g
  );
  if (namedPoints && namedPoints.length) {
    namedPoints.forEach((p) => lines.push(cleanInlineMathText(p)));
  }

  const barePoints = text.match(
    /\(\s*-?\d+(?:[.,]\d+)?\s*[;,]\s*-?\d+(?:[.,]\d+)?\s*\)/g
  );
  if ((!namedPoints || !namedPoints.length) && barePoints && barePoints.length) {
    barePoints.forEach((p, index) => lines.push(toNamedPoint(p, index)));
  }

  const equations = text.match(/(?:y|f\(x\))\s*=\s*[^,;]+/gi);
  if (equations && equations.length) {
    equations.forEach((eq) => lines.push(cleanInlineMathText(eq)));
  }

  const unique = [];
  const seen = new Set();

  lines.forEach((line) => {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
  });

  return unique.join("\n");
}

function buildNormalizedDisplayQuestionLatex(questionText = "", rawDisplay = "") {
  const source =
    cleanInlineMathText(rawDisplay) ||
    extractSupplementaryFromQuestionText(questionText) ||
    "";

  return buildStructuredDisplayQuestionLatex(source);
}

function blankVisualParams() {
  return {
    a: null,
    b: null,
    c: null,
    m: null,
    red: null,
    blue: null,
    green: null,
    x_min: null,
    x_max: null,
    y_min: null,
    y_max: null,
    left: null,
    right: null,
    left_closed: null,
    right_closed: null,
    functions: null,
  };
}

function normalizeVisualParams(template, rawParams = {}) {
  const p = rawParams && typeof rawParams === "object" ? rawParams : {};
  const base = blankVisualParams();

  switch (template) {
    case "quadratic_graph":
      return {
        ...base,
        a: toFiniteNumber(p.a, 1),
        b: toFiniteNumber(p.b, 0),
        c: toFiniteNumber(p.c, 0),
        x_min: toFiniteNumber(p.x_min, -6),
        x_max: toFiniteNumber(p.x_max, 6),
        y_min: toFiniteNumber(p.y_min, -6),
        y_max: toFiniteNumber(p.y_max, 6),
      };

    case "line_graph":
      return {
        ...base,
        m: toFiniteNumber(p.m, 1),
        b: toFiniteNumber(p.b, 0),
        x_min: toFiniteNumber(p.x_min, -6),
        x_max: toFiniteNumber(p.x_max, 6),
        y_min: toFiniteNumber(p.y_min, -6),
        y_max: toFiniteNumber(p.y_max, 6),
      };

    case "probability_urn":
      return {
        ...base,
        red: Math.max(0, Math.round(toFiniteNumber(p.red, 3))),
        blue: Math.max(0, Math.round(toFiniteNumber(p.blue, 2))),
        green: Math.max(0, Math.round(toFiniteNumber(p.green, 1))),
      };

    case "triangle_geometry":
      return {
        ...base,
        a: toFiniteNumber(p.a, 3),
        b: toFiniteNumber(p.b, 4),
        c: toFiniteNumber(p.c, 5),
      };

    case "number_line_interval": {
      let left = toFiniteNumber(p.left, -2);
      let right = toFiniteNumber(p.right, 3);
      if (left > right) [left, right] = [right, left];

      return {
        ...base,
        left,
        right,
        left_closed: toBoolean(p.left_closed, false),
        right_closed: toBoolean(p.right_closed, false),
      };
    }

    case "math_grid":
      return {
        ...base,
        x_min: toFiniteNumber(p.x_min, -5),
        x_max: toFiniteNumber(p.x_max, 5),
        y_min: toFiniteNumber(p.y_min, -3),
        y_max: toFiniteNumber(p.y_max, 3),
      };

    case "two_function_graph": {
      const rawFunctions = Array.isArray(p.functions) ? p.functions : [];

      const functions = rawFunctions
        .map((fn) => {
          const kind = String(fn?.kind || "").trim().toLowerCase();

          if (kind === "quadratic") {
            return {
              kind: "quadratic",
              a: toFiniteNumber(fn?.a, 1),
              b: toFiniteNumber(fn?.b, 0),
              c: toFiniteNumber(fn?.c, 0),
              m: null,
            };
          }

          if (kind === "line") {
            return {
              kind: "line",
              a: null,
              b: toFiniteNumber(fn?.b, 0),
              c: null,
              m: toFiniteNumber(fn?.m, 1),
            };
          }

          return null;
        })
        .filter(Boolean);

      return {
        ...base,
        x_min: toFiniteNumber(p.x_min, -6),
        x_max: toFiniteNumber(p.x_max, 6),
        y_min: toFiniteNumber(p.y_min, -6),
        y_max: toFiniteNumber(p.y_max, 6),
        functions: functions.length
          ? functions
          : [
              { kind: "quadratic", a: 1, b: 0, c: 0, m: null },
              { kind: "line", a: null, b: 0, c: null, m: 1 },
            ],
      };
    }

    default:
      return base;
  }
}

function defaultModeForTemplate() {
  return "image";
}

function normalizeVisualBlueprint(rawBlueprint, fallbackText = "") {
  if (!rawBlueprint || typeof rawBlueprint !== "object") return null;

  const template = String(rawBlueprint.template || "").trim();
  if (!SUPPORTED_VISUAL_TEMPLATES.has(template)) return null;

  const modeRaw = String(rawBlueprint.mode || "").trim().toLowerCase();
  const mode = SUPPORTED_VISUAL_MODES.has(modeRaw)
    ? modeRaw
    : defaultModeForTemplate(template);

  const caption = normalizeLatexDelimiters(
    rawBlueprint.caption || rawBlueprint.title || "Визуализация"
  );

  const alt = normalizeLatexDelimiters(
    rawBlueprint.alt || caption || fallbackText || "Визуализация к вопросу"
  );

  return {
    template,
    mode,
    params: normalizeVisualParams(template, rawBlueprint.params || {}),
    caption,
    alt,
  };
}

function normalizeQuestionType(rawQuestion) {
  const q = rawQuestion && typeof rawQuestion === "object" ? rawQuestion : {};

  if (typeof q.type === "string" && q.type.trim()) {
    return q.type.trim();
  }

  if (Array.isArray(q.options) && q.options.length > 0) return "single";
  if (Array.isArray(q.items) && q.items.length > 0) return "order_steps";
  if (Array.isArray(q.solutionBlocks) && q.solutionBlocks.length > 0)
    return "find_error";
  return "short_text";
}

function normalizeOptionText(option) {
  if (typeof option === "string") {
    return normalizeLatexDelimiters(option).trim();
  }

  if (option && typeof option === "object") {
    const candidate =
      option.text ??
      option.label ??
      option.content ??
      option.value ??
      option.option ??
      option.title ??
      "";

    return normalizeLatexDelimiters(String(candidate)).trim();
  }

  return normalizeLatexDelimiters(String(option ?? "")).trim();
}

function normalizeCorrectIndex(rawCorrect, optionsLength) {
  if (Number.isInteger(rawCorrect)) {
    return Math.max(0, Math.min(rawCorrect, Math.max(optionsLength - 1, 0)));
  }

  if (typeof rawCorrect === "string") {
    const trimmed = rawCorrect.trim().toUpperCase();

    const map = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
      E: 4,
      F: 5,
      А: 0,
      Б: 1,
      В: 2,
      Г: 3,
      Д: 4,
      Е: 5,
    };

    if (trimmed in map) {
      return Math.max(0, Math.min(map[trimmed], Math.max(optionsLength - 1, 0)));
    }

    const asNumber = Number(trimmed);
    if (Number.isInteger(asNumber)) {
      return Math.max(0, Math.min(asNumber, Math.max(optionsLength - 1, 0)));
    }
  }

  return 0;
}

function normalizeSingleQuestion(rawQuestion, index) {
  const q = rawQuestion || {};

  const options = Array.isArray(q.options)
    ? q.options.map((x) => normalizeOptionText(x)).filter(Boolean)
    : [];

  const correct = normalizeCorrectIndex(q.correct ?? q.answer, options.length);

  const questionText = normalizeLatexDelimiters(
    q.question || q.text || q.prompt || ""
  );

  return {
    id: q.id ?? index + 1,
    type: "single",
    skill: q.skill || "Общая тема",
    question: questionText,
    displayQuestionLatex: buildNormalizedDisplayQuestionLatex(
      questionText,
      q.displayQuestionLatex || ""
    ),
    explanation: normalizeLatexDelimiters(q.explanation || ""),
    difficulty: Number.isInteger(q.difficulty) ? q.difficulty : 2,
    answerFormatHint: normalizeLatexDelimiters(q.answerFormatHint || ""),
    pedagogyIntent: normalizeLatexDelimiters(q.pedagogyIntent || ""),
    diagnosticTags: Array.isArray(q.diagnosticTags)
      ? q.diagnosticTags.map((x) => String(x))
      : [],
    solutionDepth: String(q.solutionDepth || "medium").trim(),
    options,
    correct,
  };
}

function normalizeNumericQuestion(rawQuestion, index) {
  const q = rawQuestion || {};
  const questionText = normalizeLatexDelimiters(
    q.question || q.text || q.prompt || ""
  );

  return {
    id: q.id ?? index + 1,
    type: "numeric",
    skill: q.skill || "Общая тема",
    question: questionText,
    displayQuestionLatex: buildNormalizedDisplayQuestionLatex(
      questionText,
      q.displayQuestionLatex || ""
    ),
    explanation: normalizeLatexDelimiters(q.explanation || ""),
    difficulty: Number.isInteger(q.difficulty) ? q.difficulty : 2,
    answerFormatHint: normalizeLatexDelimiters(q.answerFormatHint || ""),
    pedagogyIntent: normalizeLatexDelimiters(q.pedagogyIntent || ""),
    diagnosticTags: Array.isArray(q.diagnosticTags)
      ? q.diagnosticTags.map((x) => String(x))
      : [],
    solutionDepth: String(q.solutionDepth || "medium").trim(),
    answer: {
      value: toFiniteNumber(q.answer?.value, 0),
      tolerance: toFiniteNumber(q.answer?.tolerance, 0),
      format: String(q.answer?.format || "number"),
    },
  };
}

function normalizeShortTextQuestion(rawQuestion, index) {
  const q = rawQuestion || {};
  let accepted = [];

  if (Array.isArray(q.answer?.accepted)) {
    accepted = q.answer.accepted
      .map((x) => normalizeLatexDelimiters(String(x)))
      .filter(Boolean);
  }

  if (
    !accepted.length &&
    typeof q.answer?.display === "string" &&
    q.answer.display.trim()
  ) {
    accepted = [normalizeLatexDelimiters(q.answer.display)];
  }

  if (
    !accepted.length &&
    typeof q.answer?.value === "string" &&
    q.answer.value.trim()
  ) {
    accepted = [normalizeLatexDelimiters(q.answer.value)];
  }

  if (
    !accepted.length &&
    typeof q.correctAnswer === "string" &&
    q.correctAnswer.trim()
  ) {
    accepted = [normalizeLatexDelimiters(q.correctAnswer)];
  }

  if (!accepted.length && typeof q.correct === "string" && q.correct.trim()) {
    accepted = [normalizeLatexDelimiters(q.correct)];
  }

  const display = normalizeLatexDelimiters(q.answer?.display || accepted[0] || "");
  const questionText = normalizeLatexDelimiters(
    q.question || q.text || q.prompt || ""
  );

  return {
    id: q.id ?? index + 1,
    type: "short_text",
    skill: q.skill || "Общая тема",
    question: questionText,
    displayQuestionLatex: buildNormalizedDisplayQuestionLatex(
      questionText,
      q.displayQuestionLatex || ""
    ),
    explanation: normalizeLatexDelimiters(q.explanation || ""),
    difficulty: Number.isInteger(q.difficulty) ? q.difficulty : 2,
    answerFormatHint: normalizeLatexDelimiters(
      q.answerFormatHint || "Введите ответ в указанном формате"
    ),
    pedagogyIntent: normalizeLatexDelimiters(q.pedagogyIntent || ""),
    diagnosticTags: Array.isArray(q.diagnosticTags)
      ? q.diagnosticTags.map((x) => String(x))
      : [],
    solutionDepth: String(q.solutionDepth || "medium").trim(),
    answer: {
      accepted,
      display,
      caseInsensitive: q.answer?.caseInsensitive !== false,
      trim: q.answer?.trim !== false,
      normalizeSpaces: q.answer?.normalizeSpaces !== false,
    },
  };
}

function toReadableTextBlock(value) {
  if (typeof value === "string") {
    return normalizeLatexDelimiters(value).trim();
  }

  if (value && typeof value === "object") {
    const parts = [];

    if (typeof value.title === "string" && value.title.trim()) {
      parts.push(normalizeLatexDelimiters(value.title).trim());
    }

    if (typeof value.text === "string" && value.text.trim()) {
      parts.push(normalizeLatexDelimiters(value.text).trim());
    }

    if (typeof value.content === "string" && value.content.trim()) {
      parts.push(normalizeLatexDelimiters(value.content).trim());
    }

    if (typeof value.step === "string" && value.step.trim()) {
      parts.push(normalizeLatexDelimiters(value.step).trim());
    }

    if (parts.length) {
      return parts.join(": ");
    }

    return JSON.stringify(value);
  }

  return String(value ?? "").trim();
}

function normalizeFindErrorQuestion(rawQuestion, index) {
  const q = rawQuestion || {};
  const questionText = normalizeLatexDelimiters(
    q.question || q.text || q.prompt || ""
  );

  return {
    id: q.id ?? index + 1,
    type: "find_error",
    skill: q.skill || "Общая тема",
    question: questionText,
    displayQuestionLatex: buildNormalizedDisplayQuestionLatex(
      questionText,
      q.displayQuestionLatex || ""
    ),
    explanation: normalizeLatexDelimiters(q.explanation || ""),
    difficulty: Number.isInteger(q.difficulty) ? q.difficulty : 3,
    answerFormatHint: normalizeLatexDelimiters(
      q.answerFormatHint || "Укажите номер блока с ошибкой"
    ),
    pedagogyIntent: normalizeLatexDelimiters(q.pedagogyIntent || ""),
    diagnosticTags: Array.isArray(q.diagnosticTags)
      ? q.diagnosticTags.map((x) => String(x))
      : [],
    solutionDepth: String(q.solutionDepth || "deep").trim(),
    solutionBlocks: Array.isArray(q.solutionBlocks)
      ? q.solutionBlocks.map((x) => toReadableTextBlock(x))
      : [],
    answer: {
      wrongBlock: Number.isInteger(q.answer?.wrongBlock)
        ? q.answer.wrongBlock
        : 1,
    },
  };
}

function normalizeOrderStepsQuestion(rawQuestion, index) {
  const q = rawQuestion || {};
  const questionText = normalizeLatexDelimiters(
    q.question || q.text || q.prompt || ""
  );

  return {
    id: q.id ?? index + 1,
    type: "order_steps",
    skill: q.skill || "Общая тема",
    question: questionText,
    displayQuestionLatex: buildNormalizedDisplayQuestionLatex(
      questionText,
      q.displayQuestionLatex || ""
    ),
    explanation: normalizeLatexDelimiters(q.explanation || ""),
    difficulty: Number.isInteger(q.difficulty) ? q.difficulty : 2,
    answerFormatHint: normalizeLatexDelimiters(
      q.answerFormatHint || "Расположите шаги в правильном порядке"
    ),
    pedagogyIntent: normalizeLatexDelimiters(q.pedagogyIntent || ""),
    diagnosticTags: Array.isArray(q.diagnosticTags)
      ? q.diagnosticTags.map((x) => String(x))
      : [],
    solutionDepth: String(q.solutionDepth || "deep").trim(),
    items: Array.isArray(q.items)
      ? q.items.map((x) => toReadableTextBlock(x))
      : [],
    answer: {
      order: Array.isArray(q.answer?.order)
        ? q.answer.order.map((x) => Number(x))
        : [],
    },
  };
}

function normalizeQuestionShape(rawQuestion, index) {
  const type = normalizeQuestionType(rawQuestion);
  let normalized;

  if (type === "single") normalized = normalizeSingleQuestion(rawQuestion, index);
  else if (type === "numeric")
    normalized = normalizeNumericQuestion(rawQuestion, index);
  else if (type === "find_error")
    normalized = normalizeFindErrorQuestion(rawQuestion, index);
  else if (type === "order_steps")
    normalized = normalizeOrderStepsQuestion(rawQuestion, index);
  else normalized = normalizeShortTextQuestion(rawQuestion, index);

  const visualBlueprint = normalizeVisualBlueprint(
    rawQuestion?.visualBlueprint || rawQuestion?.visual_blueprint || null,
    normalized.question
  );

  normalized.visualBlueprint = visualBlueprint || null;
  return normalized;
}

function normalizeGeneratedTestShape(testData, fallbackMeta) {
  const test = testData && typeof testData === "object" ? testData : {};
  const questions = Array.isArray(test.questions)
    ? test.questions
    : Array.isArray(test.items)
      ? test.items
      : Array.isArray(test.tasks)
        ? test.tasks
        : [];

  return {
    version: test.version || 2,
    id: String(test.id || fallbackMeta.id),
    title: normalizeLatexDelimiters(test.title || fallbackMeta.title || "Тест"),
    description: normalizeLatexDelimiters(
      test.description || fallbackMeta.description || ""
    ),
    topic: normalizeLatexDelimiters(test.topic || fallbackMeta.topic || ""),
    subtopic: normalizeLatexDelimiters(
      test.subtopic || fallbackMeta.subtopic || ""
    ),
    language: String(test.language || fallbackMeta.language || "ru").trim(),
    examFormat: String(
      test.examFormat || fallbackMeta.examFormat || "custom"
    ).trim(),
    level: normalizeLatexDelimiters(test.level || fallbackMeta.level || ""),
    audience: normalizeLatexDelimiters(
      test.audience || fallbackMeta.audience || ""
    ),
    goal: normalizeLatexDelimiters(test.goal || fallbackMeta.goal || "diagnostic"),
    variantKey: String(test.variantKey || fallbackMeta.variantKey || "").trim(),
    questions: questions.map((q, i) => normalizeQuestionShape(q, i)),
  };
}

function detectSection(topic = "", title = "") {
  const text = `${topic} ${title}`.toLowerCase();

  if (text.includes("алгеб")) return "Алгебра";
  if (text.includes("геометр")) return "Геометрия";
  if (text.includes("тригоном")) return "Тригонометрия";
  if (text.includes("вероят") || text.includes("статист")) return "Вероятность";
  if (
    text.includes("производн") ||
    text.includes("интеграл") ||
    text.includes("предел") ||
    text.includes("анализ")
  ) {
    return "Анализ";
  }

  return "Прочее";
}

function ensureCatalog() {
  ensureDir(TESTS_DIR);
  ensureDir(HISTORY_DIR);

  if (!fs.existsSync(CATALOG_PATH)) {
    writeJson(CATALOG_PATH, []);
  }
}

function updateCatalog(entry) {
  ensureCatalog();
  const catalog = readJson(CATALOG_PATH, []);
  const safeCatalog = Array.isArray(catalog) ? catalog : [];

  const next = safeCatalog.filter((item) => item.id !== entry.id);
  next.push(entry);

  writeJson(CATALOG_PATH, next);
}

function parseEnabledTypes(rawValue) {
  const list = String(rawValue || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => SUPPORTED_TYPES.has(x));

  if (list.length) return list;

  return ["single", "numeric", "short_text", "find_error", "order_steps"];
}

async function readStdinLines() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const lines = [];

  return new Promise((resolve) => {
    rl.on("line", (line) => {
      lines.push(line);
    });

    rl.on("close", () => {
      resolve(lines);
    });
  });
}

function parseStdinPayload(lines) {
  if (lines.length >= 12) {
    const [
      topicRaw,
      subtopicRaw,
      languageRaw,
      examFormatRaw,
      levelRaw,
      questionCountRaw,
      audienceRaw,
      goalRaw,
      toneRaw,
      explanationStyleRaw,
      visualStyleRaw,
      enabledTypesRaw,
    ] = lines;

    return {
      topic: String(topicRaw || "").trim(),
      subtopic: String(subtopicRaw || "").trim(),
      language:
        String(languageRaw || "ru").trim().toLowerCase() === "en" ? "en" : "ru",
      examFormat:
        String(examFormatRaw || "custom").trim().toLowerCase() || "custom",
      level: String(levelRaw || "").trim(),
      questionCount: Number(questionCountRaw),
      audience: String(audienceRaw || "").trim(),
      goal: String(goalRaw || "diagnostic").trim(),
      tone: String(toneRaw || "exam-ready").trim(),
      explanationStyle: String(explanationStyleRaw || "detailed").trim(),
      visualStyle: String(visualStyleRaw || "standard").trim(),
      enabledTypes: parseEnabledTypes(enabledTypesRaw),
    };
  }

  const [topicRaw, levelRaw, questionCountRaw, audienceRaw, toneRaw] = lines;

  return {
    topic: String(topicRaw || "").trim(),
    subtopic: "",
    language: "ru",
    examFormat: "custom",
    level: String(levelRaw || "").trim(),
    questionCount: Number(questionCountRaw),
    audience: String(audienceRaw || "").trim(),
    goal: "diagnostic",
    tone: String(toneRaw || "экзаменационный").trim(),
    explanationStyle: "detailed",
    visualStyle: "standard",
    enabledTypes: ["single", "numeric", "short_text", "find_error", "order_steps"],
  };
}

function validateInput(config) {
  if (!config.topic) {
    throw new Error("Не указана тема теста.");
  }

  if (!config.level) {
    throw new Error("Не указан уровень.");
  }

  if (
    !Number.isInteger(config.questionCount) ||
    config.questionCount < 1 ||
    config.questionCount > 30
  ) {
    throw new Error("Количество вопросов должно быть целым числом от 1 до 30.");
  }

  if (!config.audience) {
    throw new Error("Не указана аудитория.");
  }

  if (!config.tone) {
    throw new Error("Не указан стиль.");
  }

  if (!Array.isArray(config.enabledTypes) || !config.enabledTypes.length) {
    throw new Error("Не выбран ни один тип задания.");
  }
}

function buildFileMeta({ topic, level, language, examFormat }) {
  const ts = getTimestampParts();
  const topicSlug = slugify(topic);
  const levelSlug = slugify(level || "mixed");
  const languageSlug = slugify(language || "ru");
  const formatSlug = slugify(examFormat || "custom");

  const id = `${topicSlug}_${formatSlug}_${languageSlug}_${levelSlug}_${ts.fullCompact}`;
  const filename = `${id}.json`;

  return {
    id,
    filename,
    variantKey: ts.fullCompact,
    createdAt: ts.iso,
  };
}

function buildCatalogEntry(testData, fileMeta) {
  const fileRel = `/tests/${fileMeta.filename}`;

  return {
    id: testData.id,
    title: testData.title,
    description: testData.description,
    file: fileRel,
    section: detectSection(testData.topic, testData.title),
    topic: testData.topic,
    subtopic: testData.subtopic || "",
    level: testData.level,
    language: testData.language,
    examFormat: testData.examFormat,
    audience: testData.audience,
    goal: testData.goal,
    questionCount: Array.isArray(testData.questions)
      ? testData.questions.length
      : 0,
    createdAt: fileMeta.createdAt,
  };
}

function stripGraphDependencyIfNoVisual(question) {
  const q = { ...question };
  const hasVisual = !!q.visualBlueprint;

  if (hasVisual) return q;

  const replacements = [
    [/на рисунке изображ[её]н график/gi, "Рассмотрим функцию"],
    [/по графику/gi, "по свойствам функции"],
    [/используя графический смысл/gi, "решите"],
    [/определите по графику/gi, "определите"],
    [/из графика видно, что/gi, "заметим, что"],
    [/по рисунку/gi, "по условию"],
  ];

  let text = String(q.question || "");
  let latex = String(q.displayQuestionLatex || "");

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
    latex = latex.replace(pattern, replacement);
  });

  q.question = text.trim();
  q.displayQuestionLatex = latex.trim();

  return q;
}

function enrichQuestionsWithVisuals(questions, topic = "") {
  return questions.map((question) => {
    const existing = normalizeVisualBlueprint(
      question.visualBlueprint,
      question.question || ""
    );

    if (existing) {
      return {
        ...question,
        visualBlueprint: existing,
      };
    }

    return stripGraphDependencyIfNoVisual({
      ...question,
      visualBlueprint: null,
    });
  });
}

function extractResponseText(response) {
  return (
    response?.output_text ||
    response?.output?.[0]?.content?.[0]?.text ||
    "{}"
  );
}

async function invokeStructuredModel({
  schemaName,
  schema,
  prompt,
  maxAttempts = 2,
  timeoutMs = 60000,
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await withTimeout(
        client.responses.create({
          model: MODEL,
          input: [
            {
              role: "system",
              content:
                "Return only valid JSON that matches the provided schema exactly. Use only \\(...\\) and \\[...\\] for LaTeX. Never output service markers, markdown, or commentary.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              schema,
              strict: true,
            },
          },
        }),
        timeoutMs,
        `${schemaName} model call`
      );

      const rawText = extractResponseText(response);
      return JSON.parse(rawText);
    } catch (error) {
      lastError = error;
      console.error(
        `[GEN][${schemaName}] attempt ${attempt}/${maxAttempts} failed: ${error.message || error}`
      );
    }
  }

  throw lastError || new Error(`${schemaName} failed after retries.`);
}

async function generateDraft(config) {
  const runtimeSchema = buildRuntimeTestSchema(testSchema, config.questionCount);

  return invokeStructuredModel({
    schemaName: "ems_math_test",
    schema: runtimeSchema,
    prompt: buildDraftPrompt(config),
    maxAttempts: 2,
  });
}

function getQuestionCount(test) {
  return Array.isArray(test?.questions) ? test.questions.length : 0;
}

function buildCountRecoveryCritic(expected, actual, language = "ru") {
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

function buildCountRecoveryPlan(expected, actual) {
  return {
    repairable: Array.from({ length: Math.max(actual, 0) }, (_, i) => i),
    regenerate: Array.from(
      { length: Math.max(expected - actual, 0) },
      (_, i) => actual + i
    ),
  };
}

function buildCountRecoveryInstructions(expected, actual, language = "ru") {
  const isEn = String(language).toLowerCase() === "en";

  if (isEn) {
    return `
COUNT RECOVERY TASK:
- The current test has ${actual} questions.
- The final output MUST have exactly ${expected} questions.
- Keep all strong existing questions.
- Generate the missing ${Math.max(expected - actual, 0)} questions now.
- Do not return partial output.
- Do not shrink the test.`;
  }

  return `
ЗАДАЧА ВОССТАНОВЛЕНИЯ КОЛИЧЕСТВА:
- Сейчас в тесте ${actual} вопросов.
- Финальный результат ДОЛЖЕН содержать ровно ${expected} вопросов.
- Сохрани все сильные уже существующие вопросы.
- Сгенерируй недостающие ${Math.max(expected - actual, 0)} вопросов прямо сейчас.
- Не возвращай частичный результат.
- Не уменьшай тест.`;
}

async function ensureExactQuestionCount(config, test) {
  const expected = Number(config?.questionCount || 0);

  if (!Number.isInteger(expected) || expected <= 0) {
    return test;
  }

  let current = test;

  for (let pass = 1; pass <= 2; pass += 1) {
    const actual = getQuestionCount(current);

    if (actual === expected) {
      return current;
    }

    if (actual > expected) {
      return {
        ...current,
        questions: current.questions.slice(0, expected),
      };
    }

    const repaired = await withTimeout(
      runRepair(
        config,
        current,
        buildCountRecoveryCritic(expected, actual, config.language),
        buildCountRecoveryPlan(expected, actual),
        {
          extraInstructions: buildCountRecoveryInstructions(
            expected,
            actual,
            config.language
          ),
        }
      ),
      MAX_MODEL_STAGE_MS,
      "count recovery repair"
    );

    current = normalizeGeneratedTestShape(repaired, {
      id: current.id,
      title: current.title,
      description: current.description,
      topic: current.topic,
      subtopic: current.subtopic,
      language: current.language,
      examFormat: current.examFormat,
      level: current.level,
      audience: current.audience,
      goal: current.goal,
      variantKey: current.variantKey,
    });

    current.questions = enrichQuestionsWithVisuals(
      current.questions,
      current.topic
    );
  }

  return current;
}

async function generateWithPipeline(config) {
  let draft = normalizeGeneratedTestShape(await generateDraft(config), {
    id: "temp",
    title: `Тест: ${config.topic}`,
    description:
      config.language === "en"
        ? `Generated test on the topic "${config.topic}"`
        : `Сгенерированный тест по теме «${config.topic}»`,
    topic: config.topic,
    subtopic: config.subtopic,
    language: config.language,
    examFormat: config.examFormat,
    level: config.level,
    audience: config.audience,
    goal: config.goal,
    variantKey: "temp",
  });

  draft = await ensureExactQuestionCount(config, draft);
  draft.questions = normalizeQuestionCount(draft.questions, config.questionCount);
  draft.questions = enrichQuestionsWithVisuals(draft.questions, config.topic);

  for (let round = 0; round < PIPELINE_MAX_ROUNDS; round += 1) {
    console.log(`[GEN] pipeline round ${round + 1}/${PIPELINE_MAX_ROUNDS}`);

    const validation = validateTestQuality(draft, config.questionCount);
    const hasFatalValidation =
      Array.isArray(validation?.fatalIssues) &&
      validation.fatalIssues.length > 0;

    const critic = await withTimeout(
      runCritic(config, draft),
      MAX_MODEL_STAGE_MS,
      "runCritic"
    );

    const failedPlan = extractFailedQuestionPlan(critic);
    const needsRepair = hasFatalValidation || criticRequiresRepair(critic);

    if (!needsRepair) {
      return draft;
    }

    const repaired = await withTimeout(
      runRepair(config, draft, critic, failedPlan),
      MAX_MODEL_STAGE_MS,
      "runRepair"
    );

    draft = normalizeGeneratedTestShape(repaired, {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      topic: draft.topic,
      subtopic: draft.subtopic,
      language: draft.language,
      examFormat: draft.examFormat,
      level: draft.level,
      audience: draft.audience,
      goal: draft.goal,
      variantKey: draft.variantKey,
    });

    draft = await ensureExactQuestionCount(config, draft);
    draft.questions = normalizeQuestionCount(draft.questions, config.questionCount);
    draft.questions = enrichQuestionsWithVisuals(draft.questions, config.topic);
  }

  console.warn(
    "[GEN] pipeline did not fully pass quality gate, returning best current draft"
  );
  return draft;
}

async function main() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Не найден OPENAI_API_KEY в .env");
    }

    ensureCatalog();

    const lines = await readStdinLines();
    const config = parseStdinPayload(lines);
    validateInput(config);

    const fileMeta = buildFileMeta({
      topic: config.topic,
      level: config.level,
      language: config.language,
      examFormat: config.examFormat,
    });

    const normalized = await generateWithPipeline(config);

    console.log("[GEN] before finalizeTestVisuals");
    console.log(`[GEN] test id: ${fileMeta.id}`);
    console.log(
      `[GEN] questions before visuals: ${
        Array.isArray(normalized.questions) ? normalized.questions.length : 0
      }`
    );

    let normalizedWithVisuals = normalized;

    if (!SKIP_VISUALS_DURING_GENERATION) {
      try {
        normalizedWithVisuals = await withTimeout(
          finalizeTestVisuals(normalized, {
            testId: fileMeta.id,
            projectRoot: ROOT_DIR,
          }),
          MAX_VISUAL_STAGE_MS,
          "finalizeTestVisuals"
        );
      } catch (error) {
        console.error(`[GEN] visual rendering skipped: ${error.message}`);
        normalizedWithVisuals = normalized;
      }
    } else {
      console.log("[GEN] visuals skipped by env flag");
    }

    console.log("[GEN] after finalizeTestVisuals");
    console.log(
      `[GEN] questions after visuals: ${
        Array.isArray(normalizedWithVisuals.questions)
          ? normalizedWithVisuals.questions.length
          : 0
      }`
    );

    normalizedWithVisuals.id = fileMeta.id;
    normalizedWithVisuals.variantKey = fileMeta.variantKey;

    const testFilePath = path.join(TESTS_DIR, fileMeta.filename);
    const historyFilePath = path.join(HISTORY_DIR, fileMeta.filename);

    console.log("[GEN] before writeJson");
    writeJson(testFilePath, normalizedWithVisuals);
    writeJson(historyFilePath, normalizedWithVisuals);
    console.log("[GEN] after writeJson");

    const catalogEntry = buildCatalogEntry(normalizedWithVisuals, fileMeta);
    console.log("[GEN] before updateCatalog");
    updateCatalog(catalogEntry);
    console.log("[GEN] after updateCatalog");

    console.log(`Название теста: ${normalizedWithVisuals.title}`);
    console.log(`Файл сохранён: ${testFilePath}`);
    console.log(`Добавлен в каталог: ${normalizedWithVisuals.id}`);
  } catch (error) {
    console.error("[GEN][FULL ERROR]", error);
    console.error(`Ошибка: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

main();