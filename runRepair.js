"use strict";

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { buildRepairPrompt } = require("../../../../packages/ai/src/prompts/repairPrompt");
const { buildRuntimeSchema } = require("../../../../packages/validation/src/normalizers/buildRuntimeSchema");

const repairSchemaPath = path.resolve(
  __dirname,
  "../../../../packages/validation/src/schemas/repair.schema.json"
);

const baseRepairSchema = JSON.parse(fs.readFileSync(repairSchemaPath, "utf8"));

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

function getExpectedQuestionCount(config, draftTest) {
  if (Number.isInteger(config?.questionCount) && config.questionCount > 0) {
    return config.questionCount;
  }

  if (Array.isArray(draftTest?.questions) && draftTest.questions.length > 0) {
    return draftTest.questions.length;
  }

  return 0;
}

function validateRepairPayload(parsed, expectedCount) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Repair output is not an object.");
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error("Repair output does not contain a questions array.");
  }

  if (expectedCount > 0 && parsed.questions.length !== expectedCount) {
    throw new Error(
      `Repair returned ${parsed.questions.length} questions, expected ${expectedCount}.`
    );
  }

  return parsed;
}

async function runRepair(
  config,
  draftTest,
  criticReport,
  failedPlan,
  options = {}
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for repair.");
  }

  const expectedCount = getExpectedQuestionCount(config, draftTest);
  const runtimeSchema = buildRuntimeSchema(baseRepairSchema, expectedCount);

  const prompt = buildRepairPrompt(
    config,
    draftTest,
    criticReport,
    failedPlan,
    options
  );

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        input: [
          {
            role: "system",
            content:
              "Return only valid JSON matching the supplied schema. No markdown. No extra commentary. JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "ems_math_repair",
            schema: runtimeSchema,
            strict: true
          }
        }
      });

      const rawText = extractResponseText(response);
      const parsed = JSON.parse(rawText);

      return validateRepairPayload(parsed, expectedCount);
    } catch (error) {
      lastError = error;
      console.error(
        `[runRepair] attempt ${attempt}/3 failed: ${error.message || error}`
      );
    }
  }

  throw lastError || new Error("runRepair failed after 3 attempts.");
}

module.exports = {
  runRepair
};
