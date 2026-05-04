"use strict";

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { buildCriticPrompt } = require("../../../../packages/ai/src/prompts/criticPrompt");

const criticSchemaPath = path.resolve(
  __dirname,
  "../../../../packages/validation/src/schemas/critic.schema.json"
);

const criticSchema = JSON.parse(fs.readFileSync(criticSchemaPath, "utf8"));

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

function normalizeIssue(issue, fallbackMessage = "Unknown issue") {
  return {
    code: String(issue?.code || "unknown_issue"),
    severity: ["warning", "error", "fatal"].includes(issue?.severity)
      ? issue.severity
      : "error",
    message: String(issue?.message || fallbackMessage)
  };
}

const SOFT_QUALITY_CODES = new Set([
  "LOW_DIAGNOSTIC_VALUE",
  "LOW_DIAGNOSTIC_VALUE_SET",
  "LOW_DIAGNOSTIC_VALUE_FOR_PRACTICE",
  "SINGLE_CHOICE_DISTRACTORS_WEAK",
  "SINGLE_CHOICE_TOO_EASY_BY_RECOGNITION",
  "TOO_TRIVIAL",
  "TOO_EASY",
  "WEAK_DISTRACTORS",
  "LOW_VARIETY",
  "LOW_PEDAGOGICAL_VALUE"
]);

function isSoftQualityIssue(issue) {
  const code = String(issue?.code || "").trim();
  return SOFT_QUALITY_CODES.has(code);
}

function isBlockingIssue(issue) {
  if (isSoftQualityIssue(issue)) {
    return false;
  }

  return ["error", "fatal"].includes(issue?.severity);
}

function normalizeQuestionReport(report, index) {
  const issues = Array.isArray(report?.issues)
    ? report.issues.map((x) => normalizeIssue(x))
    : [];

  const rawStatus = report?.status;

  const status = ["pass", "repairable", "regenerate"].includes(rawStatus)
    ? rawStatus
    : report?.pass === true
      ? "pass"
      : "repairable";

  const singleChoiceStatus = [
    "not_applicable",
    "pass",
    "repairable",
    "regenerate",
  ].includes(report?.singleChoiceStatus)
    ? report.singleChoiceStatus
    : "not_applicable";

  const visualStatus = [
    "not_applicable",
    "pass",
    "repairable",
    "regenerate",
  ].includes(report?.visualStatus)
    ? report.visualStatus
    : "not_applicable";

  const hasBlockingIssues = issues.some(isBlockingIssue);

  const pass =
    status === "pass" &&
    singleChoiceStatus !== "repairable" &&
    singleChoiceStatus !== "regenerate" &&
    visualStatus !== "repairable" &&
    visualStatus !== "regenerate" &&
    !hasBlockingIssues;

  return {
    index,
    pass,
    status: pass ? "pass" : status,
    singleChoiceStatus,
    visualStatus,
    issues,
    repairStrategy: String(
      report?.repairStrategy || (pass ? "none" : "rewrite_question")
    ),
    recommendedAction: String(
      report?.recommendedAction ||
        (pass ? "No action required." : "Rewrite this question.")
    ),
  };
}
function detectCriticIndexMode(reports) {
  const indexes = reports
    .map((report) => report?.index)
    .filter((index) => Number.isInteger(index));

  if (indexes.includes(0)) {
    return "zero_based";
  }

  return "one_based";
}

function normalizeCriticIndex(index, questionCount, mode) {
  if (!Number.isInteger(index)) {
    return null;
  }

  if (mode === "zero_based") {
    if (index >= 0 && index < questionCount) {
      return index;
    }

    return null;
  }

  if (index >= 1 && index <= questionCount) {
    return index - 1;
  }

  if (index >= 0 && index < questionCount) {
    return index;
  }

  return null;
}



function normalizeCriticReport(critic, questionCount) {
  const safe = critic && typeof critic === "object" ? critic : {};
  const reports = Array.isArray(safe.questionReports)
    ? safe.questionReports
    : [];

  const indexMode = detectCriticIndexMode(reports);
  const byIndex = new Map();

  for (const report of reports) {
    const normalizedIndex = normalizeCriticIndex(
      report?.index,
      questionCount,
      indexMode
    );

    if (normalizedIndex !== null) {
      byIndex.set(normalizedIndex, report);
    }
  }

  const normalizedReports = [];

  for (let i = 0; i < questionCount; i += 1) {
    if (byIndex.has(i)) {
      normalizedReports.push(normalizeQuestionReport(byIndex.get(i), i));
    } else {
      normalizedReports.push({
        index: i,
        pass: false,
        status: "repairable",
        singleChoiceStatus: "not_applicable",
        visualStatus: "not_applicable",
        issues: [
          {
            code: "missing_required_field",
            severity: "fatal",
            message: "Critic did not return a report for this question.",
          },
        ],
        repairStrategy: "rewrite_question",
        recommendedAction: "Return a complete critic report for this question.",
      });
    }
  }

  const globalIssues = Array.isArray(safe.globalIssues)
    ? safe.globalIssues.map((x) => normalizeIssue(x))
    : [];

  const blockingGlobalIssues = globalIssues.filter(isBlockingIssue);

  const pass =
    blockingGlobalIssues.length === 0 &&
    normalizedReports.every(
      (report) => report.pass === true && report.status === "pass"
    );

  return {
    pass,
    globalIssues,
    questionReports: normalizedReports,
  };
}

async function runCritic(config, draftTest) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for critic.");
  }

  const questionCount = Array.isArray(draftTest?.questions)
    ? draftTest.questions.length
    : 0;

  const prompt = buildCriticPrompt(config, draftTest);

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
        name: "ems_math_critic",
        schema: criticSchema,
        strict: true
      }
    }
  });

  const rawText = extractResponseText(response);
  const parsed = JSON.parse(rawText);

  return normalizeCriticReport(parsed, questionCount);
}

function criticRequiresRepair(critic) {
  if (!critic || critic.pass !== true) return true;
  if (Array.isArray(critic.globalIssues) && critic.globalIssues.length > 0) {
    return true;
  }

  if (Array.isArray(critic.questionReports)) {
    return critic.questionReports.some(
      (report) => report.pass !== true || report.status !== "pass"
    );
  }

  return true;
}

function extractFailedQuestionPlan(critic) {
  const repairable = [];
  const regenerate = [];

  const reports = Array.isArray(critic?.questionReports)
    ? critic.questionReports
    : [];

  for (const report of reports) {
    if (!Number.isInteger(report?.index)) continue;

    if (report.status === "regenerate") {
      regenerate.push(report.index);
    } else if (report.status !== "pass" || report.pass !== true) {
      repairable.push(report.index);
    }
  }

  return {
    repairable,
    regenerate
  };
}

module.exports = {
  runCritic,
  criticRequiresRepair,
  extractFailedQuestionPlan
};
