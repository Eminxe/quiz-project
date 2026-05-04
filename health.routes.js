async function healthRoutes(app) {
  app.get("/", async () => {
    return {
      ok: true,
      service: "api",
      timestamp: new Date().toISOString()
    };
  });
}

module.exports = healthRoutes;