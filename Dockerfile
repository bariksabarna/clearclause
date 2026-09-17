# ── Stage 1: build the Vite client + typecheck everything ────────────────
# Installs ALL dependencies (including dev) and produces the static bundle.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: lean production runner ───────────────────────────────────────
# No source of the client, no devDependencies, no tests — only the compiled
# `dist/`, the server, the shared DTOs, and the runtime dependencies.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node server/ ./server/
COPY --chown=node:node shared/ ./shared/

EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server/index.ts"]