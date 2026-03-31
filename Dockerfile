# ── Build stage ──────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Install better-sqlite3 native deps
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/

# Data volume for SQLite database + pricing config
VOLUME /root/.clawcost

EXPOSE 4100

ENV CLAWCOST_PORT=4100
ENV CLAWCOST_DAILY_BUDGET=5.00
ENV CLAWCOST_MONTHLY_BUDGET=50.00

CMD ["node", "dist/index.js"]
