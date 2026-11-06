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

Hệ thống chạy trên máy chủ của Học viện, dựng bằng Docker Compose. Không có nhánh triển
khai nào khác: ràng buộc tự chủ hạ tầng ở mục 1 CLAUDE.md loại cả serverless lẫn SaaS khỏi
luồng chính, và `api` còn phải chạy migration lúc khởi động cùng với `worker` chạy nền theo
lịch — serverless không giữ được cả hai.

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

## Các bước tiếp theo

1. `apps/worker` — crawler báo chí (news-please) và chấm sắc thái tiếng Việt (PhoBERT).
2. `dbt/` — mô hình `stg__` → `int__` → `mart__`, lược đồ hợp nhất đa kênh.
3. `airbyte/` — connector Facebook Pages, GA4, Google Search Console, TikTok, YouTube.
4. `docker-compose.yml` — đóng gói toàn hệ thống để nghiệm thu.
