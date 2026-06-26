import type { FastifyInstance } from "fastify";
import { currentUser, requireAuth } from "../auth.js";
import { searchMessages } from "../services/search.js";

export async function searchRoutes(app: FastifyInstance) {
  app.get("/api/search", { preHandler: requireAuth }, async (req) => {
    const user = currentUser(req);
    const { q } = req.query as { q?: string };
    return { results: searchMessages(user.id, q || "") };
  });
}
