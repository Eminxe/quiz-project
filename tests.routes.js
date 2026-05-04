const { listTests, getTestById } = require("@ems/db");
const { buildRuntimeTest } = require("@ems/validation");

function buildTestSummary(test) {
  return {
    id: test.id,
    title: test.title,
    subject: test.subject,
    examFormat: test.examFormat,
    difficulty: test.difficulty,
    language: test.language,
    status: test.status,
    sourceType: test.sourceType,
    version: test.version,
    questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt
  };
}

function parseBooleanQuery(value) {
  return value === true || value === "true" || value === "1" || value === "yes";
}

function getRuntimeOptionsFromQuery(query = {}) {
  const includeAnswers = parseBooleanQuery(query.includeAnswers);
  const includeSolutions = parseBooleanQuery(query.includeSolutions);

  return {
    includeAnswers,
    includeSolutions
  };
}

async function testsRoutes(app) {
  app.get("/", async (request) => {
    const take = request.query && request.query.take
      ? Number(request.query.take)
      : 20;

    const tests = await listTests({
      take: Number.isFinite(take) ? take : 20
    });

    return {
      ok: true,
      tests: tests.map(buildTestSummary)
    };
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params;

    const test = await getTestById(id);

    if (!test) {
      return reply.status(404).send({
        ok: false,
        error: "TEST_NOT_FOUND"
      });
    }

    return {
      ok: true,
      test
    };
  });

  app.get("/:id/runtime", async (request, reply) => {
    const { id } = request.params;

    const test = await getTestById(id);

    if (!test) {
      return reply.status(404).send({
        ok: false,
        error: "TEST_NOT_FOUND"
      });
    }

    const runtimeOptions = getRuntimeOptionsFromQuery(request.query);

    return {
      ok: true,
      test: buildRuntimeTest(test, runtimeOptions)
    };
  });
}

module.exports = testsRoutes;
