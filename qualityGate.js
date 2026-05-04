"use strict";

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

function normalizeIssueText(issue) {
  if (!issue) return "Unknown issue";

  const code = issue.code ? `[${issue.code}] ` : "";
  const severity = issue.severity ? `(${issue.severity}) ` : "";
  const message = issue.message || "No message";

  return `${code}${severity}${message}`;
}

function buildCriticFailureMessage(critic) {
  const parts = [];

  if (Array.isArray(critic?.globalIssues) && critic.globalIssues.length > 0) {
    parts.push(
      "Global issues:",
      ...critic.globalIssues.map((issue) => `- ${normalizeIssueText(issue)}`)
    );
  }

  if (Array.isArray(critic?.questionReports)) {
    for (const report of critic.questionReports) {
      if (report?.pass === true && report?.status === "pass") continue;

      const number = Number.isInteger(report?.index)
        ? report.index + 1
        : "?";

      parts.push(`Question ${number}: status=${report?.status || "unknown"}`);

      if (Array.isArray(report?.issues) && report.issues.length > 0) {
        for (const issue of report.issues) {
          parts.push(`- ${normalizeIssueText(issue)}`);
        }
      }

      if (report?.recommendedAction) {
        parts.push(`Recommended action: ${report.recommendedAction}`);
      }
    }
  }

  return parts.join("\n").trim() || "AI critic rejected generated test.";
}

function assertCriticPassed(critic) {
  if (!critic) {
    const error = new Error("AI critic did not return a report.");
    error.code = "AI_GENERATION_CRITIC_FAILED";
    error.critic = critic;
    throw error;
  }

  const blockingGlobalIssues = Array.isArray(critic.globalIssues)
    ? critic.globalIssues.filter(isBlockingIssue)
    : [];

  const blockingQuestionReports = Array.isArray(critic.questionReports)
    ? critic.questionReports.filter((report) => {
        const issues = Array.isArray(report?.issues) ? report.issues : [];
        return issues.some(isBlockingIssue);
      })
    : [];

  if (
    blockingGlobalIssues.length === 0 &&
    blockingQuestionReports.length === 0
  ) {
    return;
  }

  const message = buildCriticFailureMessage({
    ...critic,
    globalIssues: blockingGlobalIssues,
    questionReports: blockingQuestionReports
  });

  const error = new Error(message);
  error.code = "AI_GENERATION_CRITIC_FAILED";
  error.critic = critic;
  throw error;
}

function assertQuestionCount(test, expectedCount) {
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) return;

  const actualCount = Array.isArray(test?.questions)
    ? test.questions.length
    : 0;

  if (actualCount !== expectedCount) {
    const error = new Error(
      `Generated test has ${actualCount} questions, expected ${expectedCount}.`
    );
    error.code = "AI_GENERATION_QUESTION_COUNT_MISMATCH";
    throw error;
  }
}

function assertNoEmptyPrompts(test) {
  const questions = Array.isArray(test?.questions) ? test.questions : [];

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const prompt = q?.question || q?.prompt || q?.displayQuestionLatex || "";

    if (!String(prompt).trim()) {
      const error = new Error(`Question ${i + 1} has empty prompt.`);
      error.code = "AI_GENERATION_EMPTY_PROMPT";
      throw error;
    }
  }
}

function assertGeneratedTestIsReleaseReady({ test, critic, expectedCount }) {
  assertQuestionCount(test, expectedCount);
  assertNoEmptyPrompts(test);
  assertCriticPassed(critic);
}

module.exports = {
  assertGeneratedTestIsReleaseReady,
  buildCriticFailureMessage,
};
