async function usersRoutes(app) {
  app.get("/", async () => {
    return {
      ok: true,
      resource: "users"
    };
  });
}

module.exports = usersRoutes;