# ── Build stage ──
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Remove .env if accidentally copied (secrets come from Cloud Run env vars)
RUN rm -f .env

USER appuser

# Cloud Run sets PORT=8080 by default
EXPOSE 8080

CMD ["node", "server.js"]
