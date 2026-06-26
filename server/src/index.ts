import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import secureSession from "@fastify/secure-session";
import { seed, UPLOAD_DIR } from "./db/index.js";
import { initRealtime } from "./realtime/index.js";
import { authRoutes } from "./routes/auth.js";
import { channelRoutes } from "./routes/channels.js";
import { messageRoutes } from "./routes/messages.js";
import { dmRoutes } from "./routes/dms.js";
import { userRoutes } from "./routes/users.js";
import { uploadRoutes } from "./routes/uploads.js";
import { searchRoutes } from "./routes/search.js";
import { notificationRoutes } from "./routes/notifications.js";
import { settingsRoutes } from "./routes/settings.js";
import { extraRoutes } from "./routes/extras.js";
import { inviteRoutes } from "./routes/invites.js";
import { nasaRoutes } from "./routes/nasa.js";
import { webhookRoutes } from "./routes/webhooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

function sessionKey(): Buffer {
  // 32-byte key derived from SESSION_SECRET (padded/truncated)
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me-please-32byte!!";
  const buf = Buffer.alloc(32);
  Buffer.from(secret).copy(buf);
  return buf;
}

async function main() {
  seed();

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" }, bodyLimit: 30 * 1024 * 1024 });

  await app.register(secureSession, {
    key: sessionKey(),
    cookieName: "slashslack_session",
    cookie: { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 },
  });

  await app.register(fastifyMultipart, {
    // hard ceiling; the effective limit is the admin-configurable maxUploadMb
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  });

  // rate limiting — generous global ceiling; auth routes set a tighter per-route limit
  await app.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/api/health",
  });

  // serve uploaded files
  await app.register(fastifyStatic, {
    root: path.resolve(UPLOAD_DIR),
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.get("/api/health", async () => ({ ok: true }));

  // API routes
  await app.register(authRoutes);
  await app.register(channelRoutes);
  await app.register(messageRoutes);
  await app.register(dmRoutes);
  await app.register(userRoutes);
  await app.register(uploadRoutes);
  await app.register(searchRoutes);
  await app.register(notificationRoutes);
  await app.register(settingsRoutes);
  await app.register(extraRoutes);
  await app.register(inviteRoutes);
  await app.register(nasaRoutes);
  await app.register(webhookRoutes);

  // serve the built client (single-container deployment) with SPA fallback
  const clientDist = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: "/",
      decorateReply: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api") || req.raw.url?.startsWith("/uploads")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.type("text/html").send(fs.readFileSync(path.join(clientDist, "index.html")));
    });
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });

  // attach socket.io to the same underlying HTTP server
  initRealtime(app.server);

  app.log.info(`SlashSlack listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
