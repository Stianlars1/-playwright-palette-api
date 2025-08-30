FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy package files
COPY package*.json ./

# Install dependencies (handle missing lockfile gracefully)
RUN if [ -f package-lock.json ]; then \
        npm ci --omit=dev; \
    else \
        npm install --omit=dev; \
    fi && \
    npm cache clean --force

# Copy and build source
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove unnecessary files
RUN rm -rf src/ tsconfig.json node_modules/.cache

# Security: non-root user
RUN groupadd -r appuser && \
    useradd -r -g appuser -G audio,video appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["npm", "start"]