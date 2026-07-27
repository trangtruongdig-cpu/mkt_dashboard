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

## Triển khai lên Vercel

Repo này chưa phải git repository. Khởi tạo và đẩy lên GitHub trước:

```bash
git init && git add -A && git commit -m "Khởi tạo dashboard marketing PTIT"
git branch -M main
git remote add origin git@github.com:<tài-khoản>/<tên-repo>.git
git push -u origin main
```

`.gitignore` đã loại các file tài liệu nhiệm vụ (`*.doc`, `*.docx`, `*.pdf`, `*.xlsx`) và
mọi file `.env` — kiểm tra lại bằng `git status` trước khi commit.

Tạo **hai project Vercel từ cùng một repo**. Cả hai đều cần bật
_Include files outside of the Root Directory in the Build Step_ (mặc định đã bật với monorepo).

### Project 1 — `api`

| Thiết lập | Giá trị |
|---|---|
| Root Directory | `apps/api` |
| Framework Preset | **Other** |
| Build / Install Command | để trống — đã khai trong `apps/api/vercel.json` |

Environment Variables:

```
NODE_ENV=production
DATA_SOURCE=demo
CORS_ORIGINS=https://<tên-project-web>.vercel.app
```

Deploy xong kiểm tra: `https://<tên-project-api>.vercel.app/api/docs`

### Project 2 — `web`

| Thiết lập | Giá trị |
|---|---|
| Root Directory | `apps/web` |
| Framework Preset | Next.js (tự nhận) |
| Build / Install Command | để trống — đã khai trong `apps/web/vercel.json` |

Environment Variables:

```
NEXT_PUBLIC_API_URL=https://<tên-project-api>.vercel.app
```

Deploy `api` trước để lấy tên miền, rồi mới điền biến cho `web`. Nếu chưa có API, cứ deploy
`web` trước — trang tự hiển thị dữ liệu mẫu và ghi rõ trên giao diện là đang dùng dữ liệu mẫu.

> Vercel chỉ phục vụ giai đoạn demo và xem trước. Hệ thống hoàn chỉnh (PostgreSQL, Airbyte,
> worker PhoBERT, Metabase, Matomo) chạy bằng Docker Compose trên máy chủ của Học viện —
> serverless không giữ được tiến trình chạy nền và kết nối cơ sở dữ liệu lâu dài.

## Các bước tiếp theo

1. `apps/worker` — crawler báo chí (news-please) và chấm sắc thái tiếng Việt (PhoBERT).
2. `dbt/` — mô hình `stg__` → `int__` → `mart__`, lược đồ hợp nhất đa kênh.
3. `airbyte/` — connector Facebook Pages, GA4, Google Search Console, TikTok, YouTube.
4. `docker-compose.yml` — đóng gói toàn hệ thống để nghiệm thu.
