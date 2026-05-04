const Fastify = require("fastify");
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

  return app;
}

module.exports = {
  buildApp
};
