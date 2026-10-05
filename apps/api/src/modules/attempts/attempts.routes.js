const { z } = require("zod");
const {
  createAttempt,
  getAttemptById,
  submitAttempt
} = require("@ems/db");

const { buildRuntimeTest, checkAnswer } = require("@ems/validation");

const createAttemptSchema = z.object({
  userId: z.string().min(1),
  testId: z.string().min(1)
});

const submitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.any()
    })
  )
});

function buildAttemptResponse(attempt) {
  return {
    id: attempt.id,
    userId: attempt.userId,
    testId: attempt.testId,
    status: attempt.status,
    score: attempt.score,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    createdAt: attempt.createdAt,
    answers: Array.isArray(attempt.answers)
      ? attempt.answers.map((answer) => ({
          id: answer.id,
          questionId: answer.questionId,
          value: answer.valueJson,
          isCorrect: answer.isCorrect,
          score: answer.score
        }))
      : []
  };
}

function getUserAnswerValue(attemptAnswer) {
  if (!attemptAnswer) {
    return null;
  }

  if (
    attemptAnswer.valueJson &&
    typeof attemptAnswer.valueJson === "object" &&
    Object.prototype.hasOwnProperty.call(attemptAnswer.valueJson, "value")
  ) {
    return attemptAnswer.valueJson.value;
  }

  return attemptAnswer.valueJson ?? null;
}

function buildAttemptResult(attempt) {
  const runtimeTest = buildRuntimeTest(attempt.test, {
    includeAnswers: true,
    includeSolutions: true
  });

  const answersByQuestionId = new Map();

  if (Array.isArray(attempt.answers)) {
    for (const answer of attempt.answers) {
      answersByQuestionId.set(answer.questionId, answer);
    }
  }

  const questions = runtimeTest.questions.map((question) => {
    const attemptAnswer = answersByQuestionId.get(question.id);
    const userAnswer = getUserAnswerValue(attemptAnswer);

    return {
      questionId: question.id,
      orderIndex: question.orderIndex,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      visual: question.visual,

      userAnswer,
      correctAnswer: question.answer,
      isCorrect: attemptAnswer ? attemptAnswer.isCorrect : false,
      score: attemptAnswer ? attemptAnswer.score : 0,

      solution: question.solution
    };
  });

  const totalQuestions = questions.length;
  const correctAnswers = questions.filter((question) => question.isCorrect).length;
  const wrongAnswers = totalQuestions - correctAnswers;

  return {
    attempt: {
      id: attempt.id,
      userId: attempt.userId,
      testId: attempt.testId,
      status: attempt.status,
      score: attempt.score,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      createdAt: attempt.createdAt
    },
    test: {
      id: runtimeTest.id,
      title: runtimeTest.title,
      subject: runtimeTest.subject,
      examFormat: runtimeTest.examFormat,
      difficulty: runtimeTest.difficulty,
      language: runtimeTest.language,
      questionCount: runtimeTest.questionCount
    },
    summary: {
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      score: attempt.score
    },
    questions
  };
}

async function attemptsRoutes(app) {
  app.post("/", async (request, reply) => {
    const parsed = createAttemptSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    const attempt = await createAttempt({
      userId: parsed.data.userId,
      testId: parsed.data.testId,
      status: "IN_PROGRESS"
    });

    return reply.status(201).send({
      ok: true,
      attempt
    });
  });

  app.get("/:id", async (request, reply) => {
    const attempt = await getAttemptById(request.params.id);

    if (!attempt) {
      return reply.status(404).send({
        ok: false,
        error: "ATTEMPT_NOT_FOUND"
      });
    }

    return {
      ok: true,
      attempt: buildAttemptResponse(attempt)
    };
  });

  app.get("/:id/result", async (request, reply) => {
    const attempt = await getAttemptById(request.params.id);

    if (!attempt) {
      return reply.status(404).send({
        ok: false,
        error: "ATTEMPT_NOT_FOUND"
      });
    }

    if (attempt.status !== "SUBMITTED") {
      return reply.status(409).send({
        ok: false,
        error: "ATTEMPT_NOT_SUBMITTED"
      });
    }

    return {
      ok: true,
      result: buildAttemptResult(attempt)
    };
  });

  app.post("/:id/submit", async (request, reply) => {
    const parsed = submitAttemptSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      });
    }

    const attempt = await getAttemptById(request.params.id);

    if (!attempt) {
      return reply.status(404).send({
        ok: false,
        error: "ATTEMPT_NOT_FOUND"
      });
    }

    if (attempt.status === "SUBMITTED") {
      return reply.status(409).send({
        ok: false,
        error: "ATTEMPT_ALREADY_SUBMITTED"
      });
    }

    const runtimeTest = buildRuntimeTest(attempt.test, {
      includeAnswers: true,
      includeSolutions: true
    });

    const questionById = new Map(
      runtimeTest.questions.map((question) => [question.id, question])
    );

    // Keep one answer per question of this test: a foreign questionId would
    // break the foreign key, a duplicate would break the unique index.
    const answerByQuestionId = new Map();

    for (const answer of parsed.data.answers) {
      if (questionById.has(answer.questionId)) {
        answerByQuestionId.set(answer.questionId, answer);
      }
    }

    const checkedAnswers = [...answerByQuestionId.values()].map((answer) => {
      const runtimeQuestion = questionById.get(answer.questionId);
      const isCorrect = checkAnswer(answer.value, runtimeQuestion);

      return {
        questionId: answer.questionId,
        valueJson: {
          value: answer.value
        },
        isCorrect,
        score: isCorrect ? 1 : 0
      };
    });

    const totalQuestions = runtimeTest.questions.length || 1;
    const earned = checkedAnswers.reduce((sum, answer) => sum + answer.score, 0);
    const score = Math.round((earned / totalQuestions) * 10000) / 100;

    const submitted = await submitAttempt({
      attemptId: attempt.id,
      answers: checkedAnswers,
      score
    });

    return {
      ok: true,
      attempt: buildAttemptResponse(submitted),
      summary: {
        totalQuestions,
        correctAnswers: earned,
        score
      }
    };
  });
}

module.exports = attemptsRoutes;
