const { buildRuntimeTest, buildRuntimeQuestion, toOptionList } = require("./runtime");
const { checkAnswer, normalizeText, parseNumber } = require("./answers");
const { buildRuntimeSchema } = require("./normalizers/buildRuntimeSchema");

module.exports = {
  buildRuntimeTest,
  buildRuntimeQuestion,
  toOptionList,
  checkAnswer,
  normalizeText,
  parseNumber,
  buildRuntimeSchema
};
