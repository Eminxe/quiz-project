const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const { createGenerationWorker } = require("@ems/queue");
const { logger } = require("@ems/observability");
const { processGenerationJob } = require("./processors/generation.processor");

const worker = createGenerationWorker(async (job) => {
  logger.info({ jobId: job.id, name: job.name }, "generation job started");
  const result = await processGenerationJob(job.data.generationJobId);
  logger.info({ jobId: job.id, testId: result.testId }, "generation job completed");
  return { testId: result.testId };
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error }, "generation job failed");
});

worker.on("error", (error) => {
  logger.error({ err: error }, "generation worker error");
});

logger.info("generation worker is listening");

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down worker`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
