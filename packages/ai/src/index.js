const { buildCriticPrompt } = require("./prompts/criticPrompt");
const { buildRepairPrompt } = require("./prompts/repairPrompt");
const { LATEX_RULES } = require("./prompts/shared");

module.exports = {
  buildCriticPrompt,
  buildRepairPrompt,
  LATEX_RULES
};
