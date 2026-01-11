FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/updater/package.json ./packages/updater/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the core package first
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build core package (required by web)
RUN pnpm --filter @mejor-tasa/core build

# Build the web app
RUN pnpm --filter @mejor-tasa/web build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built standalone app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
