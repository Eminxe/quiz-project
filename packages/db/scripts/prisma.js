// Runs the Prisma CLI with the repository-level .env loaded,
// so DATABASE_URL lives in one place for api, worker and migrations.
const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const result = spawnSync("prisma", process.argv.slice(2), {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env
});

process.exit(result.status ?? 1);
