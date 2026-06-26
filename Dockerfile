# ---------- build stage ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# native build deps for better-sqlite3 / sharp (fallback if no prebuilt binary)
RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# install all workspace deps (dev included, needed to build)
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install

# build everything
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
COPY client ./client
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/slashbinslashnoname/slashslack"
LABEL org.opencontainers.image.description="SlashSlack — self-hosted realtime team chat"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/uploads

COPY --from=build /app/node_modules ./node_modules
# drizzle-orm is kept local to the server workspace by npm; copy it too
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data /app/uploads
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
