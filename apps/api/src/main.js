const { env } = require("./common/env");
const { buildApp } = require("./common/app");

async function start() {
  const app = buildApp();

  try {
    await app.listen({
      host: env.API_HOST,
      port: env.API_PORT
    });

    app.log.info(`API started on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (error) {
    console.error("API bootstrap failed:", error);
    process.exit(1);
  }

  const shutdown = async (signal) => {
    try {
      app.log.info(`${signal} received, shutting down API`);
      await app.close();
      process.exit(0);
    } catch (error) {
      console.error("API shutdown failed:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
