"use strict";

const LATEX_RULES = `
LATEX RULES:
- Every formula, number with a unit power, fraction, root or variable goes inside \\( ... \\) for inline math or \\[ ... \\] for display math.
- Never use $...$ or $$...$$ delimiters: the site renders only \\( \\) and \\[ \\].
- Write fractions as \\frac{a}{b}, roots as \\sqrt{x}, degrees as ^\\circ.
- answer.value for numeric questions is a plain decimal number without LaTeX (for example "0.75" or "-3").
`;

function describeQuestionCount(config) {
  return Number.isInteger(config?.questionCount) && config.questionCount > 0
    ? config.questionCount
    : "the same number of";
}

module.exports = {
  LATEX_RULES,
  describeQuestionCount
};
