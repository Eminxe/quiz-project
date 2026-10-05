const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const pipelineDir = path.resolve(__dirname, "../apps/worker-generation/src/pipeline");

function stubModule(file, exports) {
  const resolved = require.resolve(path.join(pipelineDir, file));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

test("pipeline modules load without OPENAI_API_KEY", () => {
  delete process.env.OPENAI_API_KEY;
  assert.doesNotThrow(() => require(path.join(pipelineDir, "generateDraft")));
  assert.doesNotThrow(() => require(path.join(pipelineDir, "runCritic")));
  assert.doesNotThrow(() => require(path.join(pipelineDir, "runRepair")));
});

test("soft critic warnings do not trigger a repair round", () => {
  const { criticRequiresRepair } = require(path.join(pipelineDir, "runCritic"));

  const passing = {
    pass: true,
    globalIssues: [{ code: "LOW_VARIETY", severity: "warning", message: "" }],
    questionReports: [{ index: 0, pass: true, status: "pass", issues: [] }]
  };

  assert.equal(criticRequiresRepair(passing), false);
  assert.equal(
    criticRequiresRepair({
      ...passing,
      globalIssues: [{ code: "WRONG_TOPIC", severity: "error", message: "" }]
    }),
    true
  );
});

test("repairQuestionCount keeps test metadata", async () => {
  stubModule("runRepair.js", {
    runRepair: async () => ({ questions: [{ id: 1 }, { id: 2 }, { id: 3 }] })
  });

  const { repairQuestionCount } = require(path.join(pipelineDir, "repairQuestionCount"));
  const result = await repairQuestionCount(
    { questionCount: 3, language: "ru" },
    { title: "Мой тест", topic: "t", questions: [{ id: 1 }] }
  );

  assert.equal(result.title, "Мой тест");
  assert.equal(result.questions.length, 3);
});

test("repair output paramsJson becomes visualBlueprint.params", () => {
  const { normalizeGeneratedTestForCritic } = require(path.join(pipelineDir, "normalizeGeneratedTest"));

  const result = normalizeGeneratedTestForCritic({
    questions: [
      {
        type: "numeric",
        prompt: "p",
        answer: { value: "1" },
        visualBlueprint: { template: "line_graph", mode: "image", caption: "", alt: "", paramsJson: "{\"m\":2}" }
      }
    ]
  });

  assert.deepEqual(result.questions[0].visualBlueprint.params, { m: 2 });
});
