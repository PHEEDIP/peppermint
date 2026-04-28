FROM node:22-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY apps/api/package.json    ./apps/api/
COPY apps/client/package.json ./apps/client/
COPY packages/                ./packages/
COPY ecosystem.config.js      ./

RUN corepack enable && yarn install --mode=skip-build

COPY apps/api    ./apps/api
COPY apps/client ./apps/client

RUN cd apps/api && yarn prisma generate
RUN cd apps/api && yarn build
RUN cd apps/client && yarn build

# ── Runner ────────────────────────────────────────────────────
FROM node:22-slim AS runner

# ต้องมี build tools ใน runner ด้วย เพราะต้อง rebuild native addons
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openssl python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pm2

# Copy root package manifests + lockfile สำหรับ npm rebuild
COPY --from=builder /app/package.json    ./package.json
COPY --from=builder /app/yarn.lock       ./yarn.lock
COPY --from=builder /app/.yarnrc.yml     ./.yarnrc.yml

# API
COPY --from=builder /app/apps/api/dist         ./apps/api/dist
COPY --from=builder /app/apps/api/src/prisma   ./apps/api/src/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Root node_modules
COPY --from=builder /app/node_modules          ./node_modules

# Client
COPY --from=builder /app/apps/client/.next/standalone/apps/client/ ./apps/client/
COPY --from=builder /app/apps/client/.next/standalone/node_modules ./node_modules/
COPY --from=builder /app/apps/client/.next/static                  ./apps/client/.next/static
COPY --from=builder /app/apps/client/public                        ./apps/client/public

COPY --from=builder /app/ecosystem.config.js ./

# Rebuild native addons (re2, bcrypt, sharp, @prisma/engines) ให้ตรงกับ runner OS
RUN npm rebuild re2 bcrypt sharp --prefix /app

EXPOSE 3000 5003

CMD ["pm2-runtime", "ecosystem.config.js"]