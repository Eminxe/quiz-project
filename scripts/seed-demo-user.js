const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});

const { prisma } = require("@ems/db");

async function main() {
  const user = await prisma.user.upsert({
    where: {
      id: "demo-user"
    },
    update: {},
    create: {
      id: "demo-user",
      email: "demo-user@example.com",
      role: "TEACHER"
    }
  });

  console.log("Demo user is ready:");
  console.log(user);
}

main()
  .catch((error) => {
    console.error("Failed to seed demo user:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  