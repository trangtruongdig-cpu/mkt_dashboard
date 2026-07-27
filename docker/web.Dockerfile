# syntax=docker/dockerfile:1

# Ảnh cho giao diện Next.js, dùng chế độ standalone.

# ---- Tầng build ------------------------------------------------------------
FROM node:24 AS build
WORKDIR /repo

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter web... --filter @ptit/shared...

COPY packages/ packages/
COPY apps/web/ apps/web/

# NEXT_PUBLIC_* được nhúng thẳng vào mã JavaScript lúc build, không đọc được lúc chạy —
# nên phải truyền vào ở đây chứ không phải qua `environment` của compose.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @ptit/shared build && pnpm --filter web build

# ---- Ảnh chạy --------------------------------------------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
