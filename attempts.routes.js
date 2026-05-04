const { z } = require("zod");
const {
  createAttempt,
  getAttemptById,
  submitAttempt
} = require("@ems/db");

const { buildRuntimeTest } = require("@ems/validation");

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

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\dfrac/g, "\\frac")
    .replace(/\\,/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function checkSingleChoice(userValue, expectedAnswer) {
  if (!expectedAnswer) {
    return false;
  }

  const expected = normalizeText(expectedAnswer.value);
  const user = normalizeText(userValue);

  if (user === expected) {
    return true;
  }

  const accepted = Array.isArray(expectedAnswer.accepted)
    ? expectedAnswer.accepted
    : [];

  return accepted.some((item) => normalizeText(item) === user);
}

function checkNumeric(userValue, expectedAnswer) {
  if (!expectedAnswer) {
    return false;
  }

  const expectedValue = Number(expectedAnswer.value);
  const userNumber = Number(String(userValue).replace(",", "."));

  if (Number.isFinite(expectedValue) && Number.isFinite(userNumber)) {
    const tolerance = Number(expectedAnswer.tolerance ?? 0);
    return Math.abs(userNumber - expectedValue) <= tolerance;
  }

  const accepted = Array.isArray(expectedAnswer.accepted)
    ? expectedAnswer.accepted
    : [];

  return accepted.some((item) => normalizeText(item) === normalizeText(userValue));
}

function checkText(userValue, expectedAnswer) {
  if (!expectedAnswer) {
    return false;
  }

  const accepted = Array.isArray(expectedAnswer.accepted)
    ? [...expectedAnswer.accepted]
    : [];

  if (expectedAnswer.value !== null && expectedAnswer.value !== undefined) {
    accepted.push(expectedAnswer.value);
  }

  return accepted.some((item) => normalizeText(item) === normalizeText(userValue));
}

function checkAnswer(userValue, runtimeQuestion) {
  const type = runtimeQuestion.type;
  const expectedAnswer = runtimeQuestion.answer;

  if (type === "single_choice") {
    return checkSingleChoice(userValue, expectedAnswer);
  }

  if (type === "numeric") {
    return checkNumeric(userValue, expectedAnswer);
  }

  return checkText(userValue, expectedAnswer);
}

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

    const checkedAnswers = parsed.data.answers.map((answer) => {
      const runtimeQuestion = questionById.get(answer.questionId);
      const isCorrect = runtimeQuestion
        ? checkAnswer(answer.value, runtimeQuestion)
        : false;

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
