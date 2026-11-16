# syntax=docker/dockerfile:1
# Pin the base image by digest in production (see docs/DEPLOYMENT.md 7.1).
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S encycla && adduser -S encycla -G encycla
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data/questions.json ./data/questions.json
COPY --from=build /app/server/db/migrations ./server/db/migrations
RUN mkdir -p /app/data/db && chown -R encycla:encycla /app/data/db
USER encycla
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
