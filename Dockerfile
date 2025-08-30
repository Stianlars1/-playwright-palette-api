# ---- Build stage (needs devDeps for tsc) ----
FROM mcr.microsoft.com/playwright:v1.55.0-noble AS build
WORKDIR /app

# 1) Install dev deps regardless of NODE_ENV
COPY package*.json tsconfig.json ./
# force include dev deps even if env injects production
RUN npm ci --no-audit --no-fund --include=dev

# 2) Build
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM mcr.microsoft.com/playwright:v1.55.0-noble AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only prod deps in final image
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Bring compiled JS
COPY --from=build /app/dist ./dist

# Hardened non-root user with video/audio groups (Chrome needs it)
RUN groupadd -r appuser && useradd -r -g appuser -G audio,video appuser \
  && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
# Railway provides PORT; your server already honors it and exposes /health. :contentReference[oaicite:2]{index=2}
CMD ["node", "dist/server.js"]
