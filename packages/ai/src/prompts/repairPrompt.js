"use strict";

const { LATEX_RULES, describeQuestionCount } = require("./shared");

function buildRepairPrompt(config, draftTest, criticReport, failedPlan, options = {}) {
  const repairable = failedPlan?.repairable || [];
  const regenerate = failedPlan?.regenerate || [];

  return `
You repair math tests for the Russian ОГЭ / ЕГЭ (profile) exams.

Return the FULL test as {"questions": [...]} with exactly ${describeQuestionCount(config)} questions,
in order, orderIndex starting from 1.

- Questions with zero-based indexes [${repairable.join(", ")}] must be fixed according to the critic report.
- Questions with zero-based indexes [${regenerate.join(", ")}] must be replaced with new questions on the same exam task.
- Every other question must be returned unchanged.

CONTEXT:
- Exam type: ${config.examType || config.examFormat || "CUSTOM"}
- Topic: ${config.topicLabel || config.topic || "not specified"}
- Exam task number: ${config.examTaskNumber || "not specified"}
- Difficulty: ${config.difficulty || "medium"}
- Language: ${config.language === "en" ? "English" : "Russian"}
- Allowed question types: ${(config.taskTypes || []).join(", ") || "any"}

RULES:
- Solve each changed question from scratch and make answer.value, answer.display,
  answer.accepted and the solution agree.
- single_choice: options is an array of 4 strings, correct is the zero-based index,
  answer.value and answer.display equal options[correct].
- Other types: options and correct are null.
- visualBlueprint is null unless the question needs a picture; when present, put the
  template parameters into paramsJson as a JSON object string.
${LATEX_RULES}
${options.extraInstructions || ""}

CRITIC REPORT:
${JSON.stringify(criticReport, null, 2)}

CURRENT TEST:
${JSON.stringify({ questions: draftTest?.questions || [] }, null, 2)}
`;
}

module.exports = {
  buildRepairPrompt
};
