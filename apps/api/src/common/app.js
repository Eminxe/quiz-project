const fs = require("fs");
const path = require("path");
const Fastify = require("fastify");
const { env } = require("./env");
const attemptsRoutesModule = require("../modules/attempts/attempts.routes");
const corsModule = require("@fastify/cors");
const healthRoutesModule = require("../modules/health/health.routes");
const usersRoutesModule = require("../modules/users/users.routes");
const testsRoutesModule = require("../modules/tests/tests.routes");
const generationRoutesModule = require("../modules/generation/generation.routes");

function resolvePlugin(mod, label) {
  if (typeof mod === "function") {
    return mod;
  }

  if (mod && typeof mod.default === "function") {
    return mod.default;
  }

  if (mod && typeof mod.plugin === "function") {
    return mod.plugin;
  }

  if (mod && typeof mod === "object") {
    const fn = Object.values(mod).find((value) => typeof value === "function");
    if (fn) {
      return fn;
    }
  }

  throw new TypeError(`Fastify plugin "${label}" is not a function`);
}

function buildApp() {
  const app = Fastify({
    logger: true
  });

  const cors = resolvePlugin(corsModule, "cors");
  const healthRoutes = resolvePlugin(healthRoutesModule, "healthRoutes");
  const usersRoutes = resolvePlugin(usersRoutesModule, "usersRoutes");
  const testsRoutes = resolvePlugin(testsRoutesModule, "testsRoutes");
  const generationRoutes = resolvePlugin(generationRoutesModule, "generationRoutes");
  const attemptsRoutes = resolvePlugin(attemptsRoutesModule, "attemptsRoutes");

  app.register(cors, { origin: true });
  app.register(healthRoutes, { prefix: "/health" });
  app.register(usersRoutes, { prefix: "/users" });
  app.register(testsRoutes, { prefix: "/tests" });
  app.register(generationRoutes, { prefix: "/generation" });
  app.register(attemptsRoutes, { prefix: "/attempts" });

  // Pictures rendered by the generation worker (question.visual.src).
  app.get("/assets/generated/:file", async (request, reply) => {
    const file = path.basename(request.params.file);

    if (!/^[\w.-]+\.(png|mp4)$/.test(file)) {
      return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    }

    const filePath = path.join(env.GENERATED_ASSETS_DIR, file);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    }

    return reply
      .type(file.endsWith(".mp4") ? "video/mp4" : "image/png")
      .send(fs.createReadStream(filePath));
  });

  return app;
}

module.exports = {
  buildApp
};
