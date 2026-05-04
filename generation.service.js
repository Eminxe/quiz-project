const { normalizeGeneratedTestForCritic } = require("../pipeline/normalizeGeneratedTest");
const { assertGeneratedTestIsReleaseReady } = require("../pipeline/qualityGate");
const path = require("path");

const { generateDraft } = require("../pipeline/generateDraft");
const {
  runCritic,
  criticRequiresRepair,
  extractFailedQuestionPlan
} = require("../pipeline/runCritic");
const { runRepair } = require("../pipeline/runRepair");
const { repairQuestionCount } = require("../pipeline/repairQuestionCount");
const { finalizeTestVisuals } = require("../pipeline/finalizetest");
const { resolveGenerationProfile } = require("@ems/exam-presets");

function normalizeDifficulty(value) {
  const normalized = String(value || "").toLowerCase().trim();

  if (["easy", "low", "basic", "легкий", "лёгкий"].includes(normalized)) {
    return "easy";
  }

  if (["medium", "normal", "standard", "средний"].includes(normalized)) {
    return "medium";
  }

  if (["hard", "advanced", "сложный"].includes(normalized)) {
    return "hard";
  }

  if (["mixed", "exam"].includes(normalized)) {
    return "mixed";
  }

  return "medium";
}

function normalizeLanguage(value) {
  const normalized = String(value || "").toLowerCase().trim();

  if (["ru", "russian", "русский"].includes(normalized)) {
    return "ru";
  }

  if (["en", "english", "английский"].includes(normalized)) {
    return "en";
  }

  return "ru";
}

function normalizeQuestionCount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(number), 1), 30);
}

function normalizeMode(value) {
  const normalized = String(value || "").toLowerCase().trim();

  if (normalized === "exam") return "exam";
  return "practice";
}

function normalizeExamType(value) {
  const normalized = String(value || "").toUpperCase().trim();

  if (normalized === "OGE") return "OGE";
  if (normalized === "EGE_PROFILE") return "EGE_PROFILE";
  if (normalized === "EGE") return "EGE_PROFILE";

  return normalized || "CUSTOM";
}

function normalizeGenerationInput(inputPayload = {}) {
  const base = {
    subject: String(inputPayload.subject || "math"),
    topic: String(inputPayload.topic || "general math"),
    examFormat: String(inputPayload.examFormat || inputPayload.examType || "custom"),
    examType: normalizeExamType(inputPayload.examType || inputPayload.examFormat),
    examTaskNumber: inputPayload.examTaskNumber
      ? Number(inputPayload.examTaskNumber)
      : null,
    blockType: inputPayload.blockType ? String(inputPayload.blockType) : null,
    presetId: inputPayload.presetId ? String(inputPayload.presetId) : null,
    mode: normalizeMode(inputPayload.mode),
    difficulty: normalizeDifficulty(inputPayload.difficulty),
    language: normalizeLanguage(inputPayload.language),
    questionCount: normalizeQuestionCount(inputPayload.questionCount),
    visuals: Boolean(inputPayload.visuals),
    taskTypes: Array.isArray(inputPayload.taskTypes)
      ? inputPayload.taskTypes.map(String)
      : ["single_choice", "numeric"],
    style: String(inputPayload.style || "exam_like"),
    goal: String(inputPayload.goal || "practice"),
    timeLimitMinutes: inputPayload.timeLimitMinutes
      ? Number(inputPayload.timeLimitMinutes)
      : null,
    engine: String(
      inputPayload.engine || process.env.GENERATION_ENGINE || "mock"
    ).toLowerCase()
  };

  const profile = resolveGenerationProfile(base);

  return {
    ...base,
    topic: profile.topic || base.topic,
    topicLabel: profile.topicLabel || profile.title || base.topic,
    questionCount: normalizeQuestionCount(profile.questionCount || base.questionCount),
    difficulty: profile.difficulty || base.difficulty,
    taskTypes: Array.isArray(profile.taskTypes) ? profile.taskTypes : base.taskTypes,
    answerType: profile.answerType || "mixed",
    generationProfile: profile
  };
}

function buildMockQuestion(index, input) {
  const profile = input.generationProfile || {};
  const structure = Array.isArray(profile.structure) ? profile.structure : [];
  const taskPreset = structure[index - 1] || structure[0] || null;

  const taskLabel = taskPreset
    ? `${taskPreset.title}`
    : input.topicLabel || input.topic;

  return {
    id: `q${index}`,
    orderIndex: index,
    examTaskNumber: taskPreset ? taskPreset.taskNumber : input.examTaskNumber,
    type: index % 2 === 0 ? "numeric" : "single_choice",
    prompt:
      input.language === "ru"
        ? `Тестовый вопрос ${index}: ${taskLabel}`
        : `Mock question ${index}: ${taskLabel}`,
    options:
      index % 2 === 0
        ? null
        : [
            { id: "A", text: "Option A" },
            { id: "B", text: "Option B" },
            { id: "C", text: "Option C" },
            { id: "D", text: "Option D" }
          ],
    answer:
      index % 2 === 0
        ? { type: "numeric", value: index }
        : { type: "single_choice", value: "A" },
    solution:
      input.language === "ru"
        ? "Пока это mock-решение. Реальный AI-pipeline подключается через engine = ai."
        : "This is a mock solution. Use engine = ai for real generation.",
    visual: input.visuals
      ? {
          kind: "placeholder",
          caption:
            input.language === "ru"
              ? "Здесь будет визуализация задания"
              : "Question visualization placeholder"
        }
      : null
  };
}

async function generateMockTest(input) {
  const questions = Array.from({ length: input.questionCount }, (_, index) =>
    buildMockQuestion(index + 1, input)
  );

  return {
    kind: "generated_test",
    engine: "mock-generation-service",
    generatedAt: new Date().toISOString(),
    input,
    test: {
      title:
        input.generationProfile?.title ||
        (input.language === "ru"
          ? `Тест: ${input.topicLabel || input.topic}`
          : `Test: ${input.topicLabel || input.topic}`),
      subject: input.subject,
      topic: input.topic,
      examFormat: input.examType || input.examFormat,
      difficulty: input.difficulty,
      language: input.language,
      questionCount: input.questionCount,
      visuals: input.visuals,
      questions
    }
  };
}

function ensureTestShape(test, input) {
  const questions = Array.isArray(test?.questions) ? test.questions : [];

  return {
    title:
      test?.title ||
      input.generationProfile?.title ||
      (input.language === "ru"
        ? `Тест: ${input.topicLabel || input.topic}`
        : `Test: ${input.topicLabel || input.topic}`),
    subject: test?.subject || input.subject,
    topic: test?.topic || input.topic,
    examFormat: test?.examFormat || input.examType || input.examFormat,
    difficulty: test?.difficulty || input.difficulty,
    language: test?.language || input.language,
    questionCount: questions.length,
    visuals: input.visuals,
    questions
  };
}

async function generateAiTest(input) {
  let draftTest = await generateDraft(input);

  draftTest = normalizeGeneratedTestForCritic(draftTest, input);
  draftTest = await repairQuestionCount(input, draftTest);
  draftTest = normalizeGeneratedTestForCritic(draftTest, input);

  let finalTest = draftTest;
  let finalCritic = await runCritic(input, finalTest);

  for (let pass = 1; pass <= 3; pass += 1) {
    if (!criticRequiresRepair(finalCritic)) {
      break;
    }

    const failedPlan = extractFailedQuestionPlan(finalCritic);

    const repaired = await runRepair(
      input,
      finalTest,
      finalCritic,
      failedPlan,
      {
        extraInstructions: `
QUALITY GATE REPAIR PASS ${pass}.

The previous version was rejected by the critic. Fix every reported issue.

STRICT ANSWER CONSISTENCY RULES:
- Recalculate every answer from scratch.
- Do not preserve an answer if it conflicts with the solution.
- For numeric questions: answer.value, answer.display, answer.accepted and solution must all match.
- For single_choice questions: options must be an array of strings.
- For single_choice questions: correct MUST be a zero-based index.
- For single_choice questions: answer.display MUST equal options[correct].
- For single_choice questions: answer.accepted MUST include options[correct].
- Do not use one-based indexing in the correct field.
- Do not use find_error unless it is explicitly allowed in taskTypes.
- Allowed taskTypes: ${(input.taskTypes || []).join(", ")}.
- Return exactly ${input.questionCount} questions.
- Preserve the selected exam profile: ${input.topicLabel || input.topic}.
- Preserve examTaskNumber: ${input.examTaskNumber || "not specified"}.
`
      }
    );

    finalTest = {
      ...finalTest,
      questions: repaired.questions
    };

    finalTest = normalizeGeneratedTestForCritic(finalTest, input);
    finalTest = await repairQuestionCount(input, finalTest);
    finalTest = normalizeGeneratedTestForCritic(finalTest, input);

    finalCritic = await runCritic(input, finalTest);
  }

  if (input.visuals) {
    finalTest = await finalizeTestVisuals(finalTest, {
      testId: `draft-${Date.now()}`,
      projectRoot: path.resolve(".")
    });
  }

  finalTest = ensureTestShape(finalTest, input);
  finalTest = normalizeGeneratedTestForCritic(finalTest, input);

  assertGeneratedTestIsReleaseReady({
    test: finalTest,
    critic: finalCritic,
    expectedCount: input.questionCount
  });

  return {
    kind: "generated_test",
    engine: "ai-generation-pipeline",
    generatedAt: new Date().toISOString(),
    input,
    critic: finalCritic,
    test: finalTest
  };
}

async function generateTestFromInput(inputPayload) {
  const input = normalizeGenerationInput(inputPayload);

  if (input.engine === "ai") {
    return generateAiTest(input);
  }

  return generateMockTest(input);
}

module.exports = {
  normalizeGenerationInput,
  generateTestFromInput
};

