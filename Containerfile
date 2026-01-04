# Containerfile (works with both Podman and Docker)
# Multi-arch compatible - supports ARM64 (Raspberry Pi 5) and AMD64
#
# @see Rule #66-77

FROM oven/bun:1-alpine

WORKDIR /app

# Config files first (cache layer)
COPY package.json bun.lockb* bunfig.toml tsconfig.json ./
RUN bun install --frozen-lockfile --production

# Then source
COPY src/ ./src/

# Runtime configuration via environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["bun", "run", "src/index.ts"]

