const { prisma } = require("../prisma/client");

class UsersRepository {
  static createOrGet(email, role = "TEACHER") {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, role }
    });
  }

  static findById(id) {
    return prisma.user.findUnique({
      where: { id }
    });
  }
}

module.exports = {
  UsersRepository
};
