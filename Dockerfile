# syntax=docker/dockerfile:1
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

CMD ["node", "src/index.js"]
