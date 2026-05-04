const {
  getGenerationJobById,
  updateGenerationJob,
  createTestWithQuestions
} = require("@ems/db");

const { generateTestFromInput } = require("../services/generation.service");

async function processGenerationJob(generationJobId) {
  const jobRecord = await getGenerationJobById(generationJobId);

  if (!jobRecord) {
    throw new Error(`Generation job not found: ${generationJobId}`);
  }

  await updateGenerationJob(generationJobId, {
    status: "RUNNING",
    startedAt: new Date(),
    errorMessage: null
  });

  try {
    const result = await generateTestFromInput(jobRecord.inputPayload);

    const generatedTest = result.test;

    const savedTest = await createTestWithQuestions({
      authorId: jobRecord.userId,
      title: generatedTest.title,
      subject: generatedTest.subject,
      examFormat: generatedTest.examFormat,
      difficulty: generatedTest.difficulty,
      language: generatedTest.language,
      status: "READY",
      sourceType: "GENERATED",
      version: 1,
      questions: generatedTest.questions
    });

    const finalResult = {
      ...result,
      testId: savedTest.id,
      savedTest: {
        id: savedTest.id,
        title: savedTest.title,
        status: savedTest.status,
        questionCount: savedTest.questions.length
      }
    };

    await updateGenerationJob(generationJobId, {
      status: "COMPLETED",
      finishedAt: new Date(),
      resultPayload: finalResult,
      errorMessage: null
    });

    return finalResult;
  } catch (error) {
    await updateGenerationJob(generationJobId, {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: error && error.message ? error.message : String(error)
    });

    throw error;
  }
}

module.exports = {
  processGenerationJob
};
