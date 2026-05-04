const { prisma } = require("../prisma/client");

async function createGenerationJob(data) {
  return prisma.generationJob.create({
    data: {
      userId: data.userId,
      type: data.type,
      status: data.status || "QUEUED",
      inputPayload: data.inputPayload
    }
  });
}

async function getGenerationJobById(id) {
  return prisma.generationJob.findUnique({
    where: { id }
  });
}

async function updateGenerationJob(id, data) {
  return prisma.generationJob.update({
    where: { id },
    data
  });
}

module.exports = {
  createGenerationJob,
  getGenerationJobById,
  updateGenerationJob
};
