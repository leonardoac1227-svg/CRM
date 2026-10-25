# ---- deps
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build
FROM deps AS build
COPY . .
RUN npm run build

# ---- runtime
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node --enable-source-maps dist/server.js"]
