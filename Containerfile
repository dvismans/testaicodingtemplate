# Containerfile (works with both Podman and Docker)
# Multi-arch compatible - supports ARM64 (Raspberry Pi 5) and AMD64
#
# @see Rule #66-77

FROM oven/bun:1-alpine

WORKDIR /app

# Config files first (cache layer)
COPY package.json bun.lockb* bunfig.toml tsconfig.json ./
RUN bun install --frozen-lockfile --production

# Then source and static files
COPY src/ ./src/
COPY public/ ./public/

# Runtime configuration via environment variables
ENV NODE_ENV=production
# PORT comes from .env via compose.yaml env_file

# Expose common ports (actual port from .env)
EXPOSE 3000 8083

# Note: HEALTHCHECK not supported in OCI format (Podman)
# Health monitoring done externally

CMD ["bun", "run", "src/index.ts"]

