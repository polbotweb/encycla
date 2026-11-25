# syntax=docker/dockerfile:1
# Pin the base image by digest in production (see docs/DEPLOYMENT.md 7.1).
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
# The TikTok live connector (tiktok-live-connector, AGPL-3.0-only, unofficial) is an optional
# dependency. It is left out of the image unless the operator opts in: --build-arg WITH_TIKTOK=true
ARG WITH_TIKTOK=false
COPY . .
RUN pnpm run build
RUN if [ "$WITH_TIKTOK" = "true" ]; then pnpm prune --prod; else pnpm prune --prod --no-optional; fi

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S encycla && adduser -S encycla -G encycla
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data/questions.json ./data/questions.json
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY --from=build /app/LICENSE /app/CREDITS.md ./
RUN mkdir -p /app/data/db /app/data/image-cache \
  && chown -R encycla:encycla /app/data/db /app/data/image-cache
USER encycla
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
