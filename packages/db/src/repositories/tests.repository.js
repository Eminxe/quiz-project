const { prisma } = require("../prisma/client");

function normalizeQuestionType(type) {
  const value = String(type || "").trim();

  if (value === "single") return "single_choice";
  if (value === "multiple") return "multiple_choice";
  if (value === "number") return "numeric";

  return value || "unknown";
}

function getQuestionPrompt(question) {
  return String(
    question?.prompt ||
      question?.question ||
      question?.displayQuestionLatex ||
      question?.text ||
      ""
  );
}

function getQuestionSolution(question) {
  if (typeof question?.solution === "string" && question.solution.trim()) {
    return question.solution;
  }

  if (typeof question?.explanation === "string" && question.explanation.trim()) {
    return question.explanation;
  }

  if (Array.isArray(question?.solutionBlocks) && question.solutionBlocks.length > 0) {
    return question.solutionBlocks.map(String).join("\n");
  }

  return null;
}

function getQuestionOptions(question) {
  if (!Array.isArray(question?.options)) {
    return null;
  }

  return question.options;
}

function getQuestionAnswer(question) {
  if (question?.answer) {
    return question.answer;
  }

  if (Number.isInteger(question?.correct)) {
    return {
      type: normalizeQuestionType(question?.type),
      value: question.correct
    };
  }

  return null;
}

function getOrderIndex(question, index) {
  if (Number.isInteger(question?.orderIndex)) {
    return question.orderIndex;
  }

  if (Number.isInteger(question?.id)) {
    return question.id;
  }

  return index + 1;
}

function mapGeneratedQuestionToDb(question, index) {
  return {
    orderIndex: getOrderIndex(question, index),
    type: normalizeQuestionType(question?.type),
    prompt: getQuestionPrompt(question),
    solution: getQuestionSolution(question),
    answerJson: {
      answer: getQuestionAnswer(question),
      options: getQuestionOptions(question),
      visual: question?.visual || null,
      visualBlueprint: question?.visualBlueprint || null,
      raw: question
    }
  };
}

async function createTestWithQuestions(data) {
  const questions = Array.isArray(data.questions) ? data.questions : [];

  return prisma.test.create({
    data: {
      authorId: data.authorId,
      title: data.title,
      subject: data.subject,
      examFormat: data.examFormat,
      difficulty: data.difficulty,
      language: data.language,
      status: data.status || "READY",
      sourceType: data.sourceType || "GENERATED",
      version: data.version || 1,
      questions: {
        create: questions.map(mapGeneratedQuestionToDb)
      }
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  });
}

async function getTestById(id) {
  return prisma.test.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  });
}

async function listTests(params = {}) {
  const take = params.take || 20;

  return prisma.test.findMany({
    take,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      questions: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  });
}

module.exports = {
  createTestWithQuestions,
  getTestById,
  listTests
};
