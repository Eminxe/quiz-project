const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const GENERATION_QUEUE_NAME = "generation";

const JOB_TYPES = {
  TEST_GENERATION: "TEST_GENERATION",
  VISUAL_GENERATION: "VISUAL_GENERATION",
  REPAIR: "REPAIR"
};

function createRedisConnection(options = {}) {
  return new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    // Required by BullMQ for blocking commands used by workers.
    maxRetriesPerRequest: null,
    ...options
  });
}

let generationQueue = null;

function getGenerationQueue() {
  if (!generationQueue) {
    generationQueue = new Queue(GENERATION_QUEUE_NAME, {
      // The API should answer with an error when Redis is down instead of
      // hanging the HTTP request until Redis comes back.
      connection: createRedisConnection({
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      })
    });
  }

  return generationQueue;
}

async function enqueueGenerationJob({ generationJobId, type = JOB_TYPES.TEST_GENERATION }) {
  return getGenerationQueue().add(
    type,
    { generationJobId },
    {
      // The DB row id doubles as the BullMQ job id, so a retry of the same
      // HTTP request can't enqueue the same generation twice.
      jobId: generationJobId,
      attempts: 1,
      removeOnComplete: 1000,
      removeOnFail: 1000
    }
  );
}

function createGenerationWorker(processor, options = {}) {
  return new Worker(GENERATION_QUEUE_NAME, processor, {
    connection: createRedisConnection(),
    concurrency: 1,
    ...options
  });
}

async function closeQueues() {
  if (generationQueue) {
    await generationQueue.close();
    generationQueue = null;
  }
}

module.exports = {
  GENERATION_QUEUE_NAME,
  JOB_TYPES,
  enqueueGenerationJob,
  createGenerationWorker,
  closeQueues
};
