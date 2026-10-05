const test = require("node:test");
const assert = require("node:assert/strict");
const { getExamPresetCatalog, resolveGenerationProfile } = require("../packages/exam-presets/src");

test("catalog has every ОГЭ and ЕГЭ profile task", () => {
  const catalog = getExamPresetCatalog();
  const counts = Object.fromEntries(catalog.exams.map((exam) => [exam.examType, exam.tasks.length]));

  assert.deepEqual(counts, { OGE: 25, EGE_PROFILE: 19 });
});

test("exam mode resolves the full variant size", () => {
  const profile = resolveGenerationProfile({ mode: "exam", examType: "OGE" });
  assert.equal(profile.questionCount, 25);
});
