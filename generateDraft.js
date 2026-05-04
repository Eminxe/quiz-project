"use strict";

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function extractResponseText(response) {
  return (
    response?.output_text ||
    response?.output?.[0]?.content?.[0]?.text ||
    "{}"
  );
}

function buildQuestionTypeInstruction(config) {
  const taskTypes = Array.isArray(config.taskTypes) ? config.taskTypes : [];

  if (taskTypes.length === 0) {
    return "Allowed question types: single_choice, numeric, short_text.";
  }

  return `Allowed question types: ${taskTypes.join(", ")}.`;
}

function buildModeInstruction(config) {
  const profile = config.generationProfile || {};

  if (config.mode === "exam") {
    return `
GENERATION MODE: FULL EXAM VARIANT

You are generating a complete exam-style variant.

Exam type: ${config.examType}
Expected number of questions: ${config.questionCount}

Profile instructions:
${profile.instructions || ""}

Important:
- Every question must have orderIndex from 1 to ${config.questionCount}.
- If the profile contains exam task numbers, include examTaskNumber in each question.
- Do not generate all questions from the same topic unless the exam structure requires it.
- Keep the structure consistent with the target exam.
`;
  }

  return `
GENERATION MODE: PRACTICE SET

You are generating a practice set.

Exam type: ${config.examType}
Topic: ${config.topic}
Topic label: ${config.topicLabel || config.topic}
Exam task number: ${config.examTaskNumber || "not specified"}
Question count: ${config.questionCount}

Profile instructions:
${profile.instructions || ""}

Important:
- All questions must train the selected topic or selected exam task.
- Do not mix unrelated topics.
- Keep tasks varied but within the same exam/task family.
`;
}

function buildDraftPrompt(config) {
  const language = config.language === "en" ? "English" : "Russian";

  return `
You are an expert math test generator for EMS MATH.

Generate a math test strictly as JSON.

LANGUAGE:
${language}

CONFIG:
${JSON.stringify(config, null, 2)}

${buildModeInstruction(config)}

STRICT REQUIREMENTS:
- Return exactly ${config.questionCount} questions.
- Difficulty must match: ${config.difficulty}.
- Topic must match: ${config.topic}.
- Exam format must match: ${config.examType || config.examFormat}.
- Each question must be mathematically correct.
- Each question must have a clear prompt.
- Each question must have an answer.
- Each question must have a solution or explanation.
- Use LaTeX where formulas are needed.
- Do not use markdown.
- Do not add commentary outside JSON.
- Do not include answers inside the prompt text.
- Use Russian educational wording if language is ru.

SINGLE CHOICE RULES:
- If type is single_choice, options MUST be an array of strings.
- If type is single_choice, correct MUST be a zero-based index.
- If type is single_choice, answer.display MUST be exactly options[correct].
- If type is single_choice, answer.accepted MUST include options[correct].
- Never use one-based indexing for correct.

ANSWER CONSISTENCY RULES:
- The answer must match the final result in the solution.
- Do not create a question where the options do not contain the correct answer.
- Do not create a question where the solution contradicts answer.value.
- Recalculate the answer after writing the solution.

${buildQuestionTypeInstruction(config)}

OUTPUT JSON STRUCTURE:
{
  "title": "string",
  "subject": "math",
  "topic": "string",
  "examFormat": "string",
  "difficulty": "easy | medium | hard | mixed",
  "language": "ru | en",
  "questions": [
    {
      "id": 1,
      "orderIndex": 1,
      "examTaskNumber": 1,
      "type": "single_choice | numeric | short_text | full_solution",
      "question": "string",
      "prompt": "string",
      "options": [
        { "id": "A", "text": "string" },
        { "id": "B", "text": "string" },
        { "id": "C", "text": "string" },
        { "id": "D", "text": "string" }
      ],
      "correct": 0,
      "answer": {
        "type": "single_choice | numeric | short_text | full_solution",
        "value": "string or number",
        "display": "string",
        "accepted": ["string"],
        "tolerance": 0
      },
      "solution": "string",
      "explanation": "string",
      "solutionBlocks": ["string"],
      "diagnosticTags": ["string"],
      "pedagogyIntent": "string",
      "visualBlueprint": null
    }
  ]
}
`;
}

function normalizeQuestion(question, index, config) {
  const rawType = String(question?.type || "single_choice");
  const type = rawType === "single" ? "single_choice" : rawType;

  return {
    id: question?.id || `q${index + 1}`,
    orderIndex: Number.isInteger(question?.orderIndex)
      ? question.orderIndex
      : index + 1,
    examTaskNumber: question?.examTaskNumber || config.examTaskNumber || null,
    type,
    prompt: String(
      question?.prompt ||
        question?.question ||
        question?.displayQuestionLatex ||
        ""
    ),
    question: question?.question || question?.prompt || "",
    options: Array.isArray(question?.options) ? question.options : null,
    correct: Number.isInteger(question?.correct) ? question.correct : null,
    answer: question?.answer || null,
    solution: String(question?.solution || question?.explanation || ""),
    explanation: question?.explanation || question?.solution || "",
    solutionBlocks: Array.isArray(question?.solutionBlocks)
      ? question.solutionBlocks
      : [],
    diagnosticTags: Array.isArray(question?.diagnosticTags)
      ? question.diagnosticTags
      : [],
    pedagogyIntent: question?.pedagogyIntent || "",
    visualBlueprint: question?.visualBlueprint || null,
    visual: null,
    meta: {
      generatedBy: "ai",
      mode: config.mode,
      examType: config.examType,
      examTaskNumber: question?.examTaskNumber || config.examTaskNumber || null,
      difficulty: config.difficulty,
      topic: config.topic,
      topicLabel: config.topicLabel || config.topic
    }
  };
}

function normalizeDraftTest(parsed, config) {
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  return {
    title:
      parsed?.title ||
      config.generationProfile?.title ||
      (config.language === "ru"
        ? `Тест: ${config.topicLabel || config.topic}`
        : `Test: ${config.topicLabel || config.topic}`),
    subject: parsed?.subject || config.subject,
    topic: parsed?.topic || config.topic,
    examFormat: parsed?.examFormat || config.examType || config.examFormat,
    difficulty: parsed?.difficulty || config.difficulty,
    language: parsed?.language || config.language,
    questionCount: questions.length,
    visuals: Boolean(config.visuals),
    questions: questions.map((question, index) =>
      normalizeQuestion(question, index, config)
    )
  };
}

async function generateDraft(config) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for AI generation.");
  }

  const prompt = buildDraftPrompt(config);

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.2",
    input: [
      {
        role: "system",
        content:
          "Return only valid JSON. No markdown. No explanations. JSON only."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    text: {
      format: {
        type: "json_object"
      }
    }
  });

  const rawText = extractResponseText(response);
  const parsed = JSON.parse(rawText);

  return normalizeDraftTest(parsed, config);
}

module.exports = {
  generateDraft
};
