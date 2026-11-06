# Dashboard Marketing số & Thương hiệu — PTIT

Hệ thống theo dõi hoạt động marketing số và sức khoẻ thương hiệu của Học viện Công nghệ
Bưu chính Viễn thông. Đây là **bản demo giao diện** — số liệu hiện tại là dữ liệu giả lập,
chưa đấu nối Airbyte và dbt.

Quy ước kỹ thuật bắt buộc: xem [CLAUDE.md](./CLAUDE.md).

## Cấu trúc

```
apps/api          NestJS + Fastify  → API đọc dữ liệu, tài liệu OpenAPI tại /api/docs
apps/web          Next.js           → trang chủ dashboard
packages/shared   zod schema        → hợp đồng dữ liệu dùng chung api ↔ web
```

`packages/shared` là nguồn sự thật duy nhất: backend dùng để kiểm tra dữ liệu trả ra và
sinh tài liệu OpenAPI, frontend dùng đúng bộ schema đó để kiểm tra dữ liệu nhận vào.
Không khai báo lại kiểu dữ liệu API ở nơi khác.

## Chạy cục bộ

```bash
pnpm install
pnpm build          # bắt buộc chạy lần đầu để sinh dist của @ptit/shared
pnpm dev            # web http://localhost:3000 · api http://localhost:3001
```

Kiểm tra nhanh:

```bash
curl http://localhost:3001/api/health
open http://localhost:3001/api/docs
```

Muốn web đọc từ API thật thay vì dữ liệu mẫu, tạo `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Kiểm tra trước khi đẩy code: `pnpm typecheck && pnpm lint && pnpm build`.

## Triển khai

Có HAI nhánh, và chúng không thay thế nhau.

**Docker Compose trên máy chủ Học viện — luồng chính.** Mục 1 CLAUDE.md đòi tự chủ hạ
tầng, và chỉ nhánh này chạy được đủ hệ thống: `api` chạy migration lúc khởi động,
`worker` chạy nền theo lịch, PostgreSQL giữ kho, Metabase và Matomo đứng cùng mạng.
Serverless không giữ được tiến trình nền lẫn kết nối cơ sở dữ liệu lâu dài.

**Vercel — bản xem trước.** Chỉ phục vụ việc xem giao diện từ xa khi chưa có máy chủ.
Nó đọc `DATA_SOURCE=demo` nên không chạm dữ liệu thật.

```bash
cp .env.example .env     # rồi sửa ba mật khẩu bắt buộc
docker compose up -d --build
```

Xong thì mọi thứ nằm sau Caddy ở một cổng duy nhất (mặc định `8080`):

| Đường dẫn | Dịch vụ |
|---|---|
| `/` | giao diện dashboard (Next.js) |
| `/api/docs` | tài liệu OpenAPI của NestJS |
| `/metabase/` | Metabase cho cán bộ tự truy vấn ad-hoc |
| `/matomo/` | Matomo đo lưu lượng website (lần đầu phải chạy trình cài đặt trên giao diện) |

Chỉ `caddy` publish cổng ra ngoài. Khi có tên miền thật, đổi `:80` trong `docker/Caddyfile`
thành tên miền của Học viện là Caddy tự xin chứng chỉ Let's Encrypt.

Mặc định `DATA_SOURCE=demo` — giao diện dựng được ngay và tự ghi rõ "Nguồn: số liệu giả lập".
Chuyển sang `postgres` sau khi đã chạy worker thu thập và `dbt build`.

### Bản xem trước trên Vercel

Hai project từ cùng một repo: `apps/api` và `apps/web`. Cấu hình nằm trong
`apps/api/vercel.json` và `apps/web/vercel.json`, đừng để Vercel tự đoán.

**Vì sao `buildCommand` phải khai tay, và đây là chỗ đã gãy thật:**

```
pnpm --filter @ptit/shared build && pnpm --filter web build
```

`@ptit/shared` khai `main: ./dist/index.js` nên phải được `tsc` build TRƯỚC. Ở máy dev
không ai thấy điều đó vì `pnpm build` đi qua Turborepo, mà `turbo.json` có
`dependsOn: ["^build"]` nên shared luôn được build trước. Vercel thì không dùng Turborepo:
mất `vercel.json`, nó rơi về lệnh mặc định `next build` trong `apps/web` và chết với
25 lỗi `Module not found: Can't resolve '@ptit/shared'`.

Nghĩa là **build xanh ở máy không bảo đảm build xanh trên Vercel**. Trước khi xoá hay sửa
hai tệp đó, chạy đúng lệnh trong `buildCommand` chứ đừng chạy `pnpm build` ở gốc.

`.vercelignore` là lớp chặn để `.env*`, `*.duckdb` và `.codegraph/` không rời khỏi máy.

## Các bước tiếp theo

1. `apps/worker` — crawler báo chí (news-please) và chấm sắc thái tiếng Việt (PhoBERT).
2. `dbt/` — mô hình `stg__` → `int__` → `mart__`, lược đồ hợp nhất đa kênh.
3. `airbyte/` — connector Facebook Pages, GA4, Google Search Console, TikTok, YouTube.
4. `docker-compose.yml` — đóng gói toàn hệ thống để nghiệm thu.
