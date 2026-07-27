# syntax=docker/dockerfile:1

# Ảnh cho API NestJS. Build nhiều tầng: tầng build có toolchain, ảnh chạy thì không.

# ---- Tầng build ------------------------------------------------------------
FROM node:24 AS build
WORKDIR /repo

RUN corepack enable

# Chép trước phần khai báo phụ thuộc để tầng cài đặt được dùng lại từ cache khi
# mã nguồn đổi mà danh sách thư viện không đổi.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --filter api... --filter @ptit/shared...

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm --filter @ptit/shared build && pnpm --filter api build

# `pnpm deploy` gom app cùng đúng phụ thuộc production của nó vào một thư mục
# phẳng, không còn symlink ra ngoài workspace.
RUN pnpm --filter api deploy --prod --legacy /app

# ---- Ảnh chạy --------------------------------------------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Không chạy bằng root. Ảnh node đã có sẵn user `node` uid 1000.
RUN mkdir -p /app && chown -R node:node /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
# Migration đọc lúc khởi động nên phải nằm trong ảnh, không phải chỉ ở tầng build.
COPY --from=build --chown=node:node /repo/apps/api/src/db/migrations ./dist/db/migrations

USER node
EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3002/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
