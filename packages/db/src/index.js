const { prisma } = require("./prisma/client");
const usersRepository = require("./repositories/users.repository");
const testsRepository = require("./repositories/tests.repository");
const generationJobsRepository = require("./repositories/generation-jobs.repository");
const attemptsRepository = require("./repositories/attempts.repository");

module.exports = {
  prisma,
  ...usersRepository,
  ...testsRepository,
  ...generationJobsRepository,
  ...attemptsRepository
};
