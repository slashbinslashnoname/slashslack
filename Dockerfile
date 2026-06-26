# syntax=docker/dockerfile:1

# ---------- build: compile TS + bundle the client ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
COPY client ./client
RUN npm run build

# ---------- prod-deps: server+shared runtime deps only (no dev, no client) ----------
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
# The client is pre-built to static files — its deps (react, lucide-react, …)
# are not needed at runtime. Drop the client workspace before installing.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.workspaces=['shared','server'];p.devDependencies={};p.scripts={};fs.writeFileSync('package.json',JSON.stringify(p))" \
 && npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# ---------- runtime: slim base + only what's needed to run ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/uploads
LABEL org.opencontainers.image.source="https://github.com/slashbinslashnoname/slashslack"
LABEL org.opencontainers.image.description="SlashSlack — self-hosted realtime team chat"
LABEL org.opencontainers.image.licenses="MIT"

# package.json files + production node_modules (root + any nested workspace deps).
# Use COPY --chown so we don't duplicate node_modules in a separate `chown -R` layer.
COPY --chown=node:node --from=prod-deps /app ./
# built artifacts only (no source)
COPY --chown=node:node --from=build /app/shared/dist ./shared/dist
COPY --chown=node:node --from=build /app/server/dist ./server/dist
COPY --chown=node:node --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data /app/uploads && chown node:node /app/data /app/uploads
USER node
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
