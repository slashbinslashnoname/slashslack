import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import secureSession from "@fastify/secure-session";
import crypto from "node:crypto";
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

const IS_PROD = process.env.NODE_ENV === "production";
const HTTPS_ORIGIN = (process.env.PUBLIC_ORIGIN || "").startsWith("https://");

function sessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  // In production a strong, explicit secret is mandatory — never forge sessions
  // with a known/default value.
  if (IS_PROD && (!secret || secret.length < 32 || /change-?me/i.test(secret))) {
    throw new Error(
      "SESSION_SECRET must be set to a random 32+ character value in production (e.g. `openssl rand -hex 24`)",
    );
  }
  // Derive a 32-byte key from the secret (or a dev-only random one).
  const material = secret || crypto.randomBytes(32).toString("hex");
  return crypto.createHash("sha256").update(material).digest();
}

async function main() {
  seed();

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" }, bodyLimit: 30 * 1024 * 1024 });

  // security headers (CSP tuned for the SPA: external images/media allowed,
  // no inline/external scripts, no framing)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        mediaSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  await app.register(secureSession, {
    key: sessionKey(),
    cookieName: "slashslack_session",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: HTTPS_ORIGIN, // require HTTPS for the cookie when served over https
      maxAge: 60 * 60 * 24 * 30,
    },
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

  // serve uploaded (user-controlled) files with locked-down headers
  await app.register(fastifyStatic, {
    root: path.resolve(UPLOAD_DIR),
    prefix: "/uploads/",
    decorateReply: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // a served upload may never execute scripts or be framed
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
    },
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
