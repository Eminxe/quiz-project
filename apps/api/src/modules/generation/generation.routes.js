const { z } = require("zod");
const {
  createGenerationJob,
  getGenerationJobById,
  updateGenerationJob
} = require("@ems/db");
const { enqueueGenerationJob, JOB_TYPES } = require("@ems/queue");
const { getExamPresetCatalog } = require("@ems/exam-presets");
const { hasGenerator } = require("@ems/task-generators");

// Marks the exam numbers that the template engine can generate.
function buildPresetCatalog() {
  const catalog = getExamPresetCatalog();

  return {
    ...catalog,
    exams: catalog.exams.map((exam) => ({
      ...exam,
      tasks: exam.tasks.map((task) => ({
        ...task,
        hasGenerator: hasGenerator(exam.examType, task.taskNumber)
      }))
    }))
  };
}

const generationInputSchema = z.object({
  subject: z.string().min(1).default("math"),
  topic: z.string().min(1).optional().default("general math"),

  mode: z.enum(["practice", "exam"]).default("practice"),
  examType: z.enum(["OGE", "EGE_PROFILE", "CUSTOM"]).optional(),
  examTaskNumber: z.number().int().min(1).max(25).nullable().optional(),
  blockType: z.string().nullable().optional(),
  presetId: z.string().nullable().optional(),

  examFormat: z.string().min(1).default("custom"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.enum(["ru", "en"]).default("ru"),
  questionCount: z.number().int().min(1).max(30).default(10),
  visuals: z.boolean().default(false),
  taskTypes: z.array(z.string()).optional(),
  style: z.string().optional(),
  goal: z.string().optional(),
  timeLimitMinutes: z.number().int().positive().nullable().optional(),
  engine: z.enum(["template", "mock", "ai"]).default("template"),
  seed: z.union([z.string().min(1).max(64), z.number().int()]).optional()
}).passthrough();

const createGenerationJobSchema = z.object({
  userId: z.string().min(1),
  type: z.enum([
    JOB_TYPES.TEST_GENERATION,
    JOB_TYPES.VISUAL_GENERATION,
    JOB_TYPES.REPAIR
  ]),
  inputPayload: generationInputSchema
});

async function generationRoutes(app) {

 app.get("/presets", async () => {
  return {
    ok: true,
    catalog: buildPresetCatalog(),
  };
  });
  app.post("/jobs", async (request, reply) => {
    const parsed = createGenerationJobSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    const { userId, type, inputPayload } = parsed.data;

    const generationJob = await createGenerationJob({
      userId,
      type,
      status: "QUEUED",
      inputPayload
    });

    try {
      await enqueueGenerationJob({
        generationJobId: generationJob.id
      });
    } catch (error) {
      // Without this the job would stay QUEUED forever and the UI would poll it.
      await updateGenerationJob(generationJob.id, {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: `Queue is unavailable: ${error.message}`
      });

      request.log.error({ err: error }, "failed to enqueue generation job");

      return reply.status(503).send({
        ok: false,
        error: "QUEUE_UNAVAILABLE"
      });
    }

    return reply.status(201).send({
      ok: true,
      jobId: generationJob.id,
      status: generationJob.status
    });
  });

  app.get("/jobs/:id", async (request, reply) => {
    const { id } = request.params;

    const generationJob = await getGenerationJobById(id);

    if (!generationJob) {
      return reply.status(404).send({
        ok: false,
        error: "JOB_NOT_FOUND"
      });
    }

    return {
      ok: true,
      job: generationJob
    };
  });
}

module.exports = generationRoutes;
