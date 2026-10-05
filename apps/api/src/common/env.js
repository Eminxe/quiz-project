const path = require("path");
const { z } = require("zod");

require("dotenv").config({ path: path.resolve(__dirname, "../../../../.env") });

const envSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  GENERATED_ASSETS_DIR: z
    .string()
    .default(
      path.resolve(__dirname, "../../../worker-generation/assets/generated")
    )
});

const env = envSchema.parse(process.env);

module.exports = {
  env
};
