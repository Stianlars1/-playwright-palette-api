FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy package files
COPY package*.json tsconfig.json ./

# Install ALL dependencies first (needed for build)
RUN npm ci --no-audit --no-fund && \
    npm cache clean --force

# Copy source and build
COPY src/ ./src/
RUN npm run build

# Remove dev dependencies and build artifacts
RUN npm prune --omit=dev && \
    rm -rf src/ tsconfig.json node_modules/.cache /tmp/*

# Security: non-root user
RUN groupadd -r appuser && \
    useradd -r -g appuser -G audio,video appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=15s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["npm", "start"]