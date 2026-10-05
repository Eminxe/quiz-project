const { prisma } = require("../prisma/client");

async function createAttempt(data) {
  return prisma.attempt.create({
    data: {
      userId: data.userId,
      testId: data.testId,
      status: data.status || "IN_PROGRESS"
    }
  });
}

async function getAttemptById(id) {
  return prisma.attempt.findUnique({
    where: { id },
    include: {
      test: {
        include: {
          questions: {
            orderBy: {
              orderIndex: "asc"
            }
          }
        }
      },
      answers: {
        include: {
          question: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

async function submitAttempt(data) {
  const { attemptId, answers, score } = data;

  return prisma.$transaction(async (tx) => {
    await tx.attemptAnswer.deleteMany({
      where: {
        attemptId
      }
    });

    for (const answer of answers) {
      await tx.attemptAnswer.create({
        data: {
          attemptId,
          questionId: answer.questionId,
          valueJson: answer.valueJson,
          isCorrect: answer.isCorrect,
          score: answer.score
        }
      });
    }

    return tx.attempt.update({
      where: {
        id: attemptId
      },
      data: {
        status: "SUBMITTED",
        score,
        submittedAt: new Date()
      },
      include: {
        answers: {
          include: {
            question: true
          }
        },
        test: {
          include: {
            questions: {
              orderBy: {
                orderIndex: "asc"
              }
            }
          }
        }
      }
    });
  });
}

module.exports = {
  createAttempt,
  getAttemptById,
  submitAttempt
};
