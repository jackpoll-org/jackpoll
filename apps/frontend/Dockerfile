# syntax=docker/dockerfile:1

# ── Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
# libc6-compat: musl shim some native deps (sharp) expect on Alpine.
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --frozen-lockfile: install exactly what the lockfile pins (and run the
# supply-chain policy checks configured in pnpm-workspace.yaml).
RUN pnpm install --frozen-lockfile

# ── Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time. Only the Next server (the
# /api proxy and Server Components) reads this; the browser always calls the
# same-origin "/api" proxy. Default targets the swarm-internal backend service.
ARG NEXT_PUBLIC_API_URL=http://backend:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# The standalone output bundles only the files the server needs.
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
