"use strict";

// Pins the number of questions in a JSON schema so structured output
// can't return a shorter or longer test than was requested.
function buildRuntimeSchema(baseSchema, expectedCount) {
  const schema = JSON.parse(JSON.stringify(baseSchema));

  if (Number.isInteger(expectedCount) && expectedCount > 0 && schema.properties?.questions) {
    schema.properties.questions.minItems = expectedCount;
    schema.properties.questions.maxItems = expectedCount;
  }

  return schema;
}

module.exports = {
  buildRuntimeSchema
};
