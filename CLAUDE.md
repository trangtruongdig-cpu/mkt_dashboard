# CLAUDE.md — Dashboard Marketing số & Thương hiệu PTIT

Hướng dẫn bắt buộc cho Claude Code khi làm việc trong repo này.

## 1. Bối cảnh dự án

Nhiệm vụ nghiên cứu khoa học: xây dựng hệ thống dashboard theo dõi hoạt động marketing số
và sức khoẻ thương hiệu của **Học viện Công nghệ Bưu chính Viễn thông (PTIT)**.

Ràng buộc chi phối mọi quyết định kỹ thuật:

- **Tự chủ hạ tầng.** Toàn bộ hệ thống phải chạy được trên máy chủ của Học viện. Không khoá
  vào GCP/AWS. Không dùng dịch vụ SaaS trả phí trong luồng chính.
- **Mã nguồn mở, giấy phép cho phép.** Chỉ dùng thư viện MIT / Apache-2.0 / BSD / GPL-tương thích.
  Khi thêm dependency mới, ghi rõ giấy phép vào PR/commit message.
- **Tái lập được.** Hội đồng nghiệm thu phải dựng lại được hệ thống từ repo. Mọi thứ chạy qua
  `docker compose up`. Không có bước cấu hình thủ công không ghi tài liệu.
- Ngôn ngữ giao diện và tài liệu: **tiếng Việt**. Tên biến/hàm/bảng: **tiếng Anh**.

Tài liệu nhiệm vụ (QĐ 671/QĐ-BTTTT, thuyết minh dự toán) nằm ở thư mục gốc — đọc trước khi
thay đổi phạm vi chức năng.

## 2. Ngăn xếp công nghệ — ĐÃ CHỐT

Không tự ý thay thế các lựa chọn dưới đây. Muốn đổi, phải hỏi người dùng trước.

### TypeScript — phủ backend + frontend

| Tầng | Công nghệ | Phiên bản |
|---|---|---|
| Monorepo | **pnpm workspaces** + **Turborepo** | Node 24 LTS |
| Backend API | **NestJS** trên **Fastify adapter** | 11+ |
| Validation / DTO | **zod** + **nestjs-zod** (dùng chung với frontend) | — |
| DB access | **Drizzle ORM** + **drizzle-kit** (migration) | — |
| Queue / Cron | **BullMQ** + **Redis** | — |
| API docs | **@nestjs/swagger** (tự sinh OpenAPI) | — |
| Frontend | **Next.js App Router** + **TypeScript strict** | — |
| UI | **Tailwind CSS v4** + **shadcn/ui** | — |
| Charts | **Apache ECharts** (`echarts-for-react`) | — |
| Data fetching | **TanStack Query v5** | — |
| Test | **Vitest** (cả api và web) | — |

### Python — chỉ chạy batch, không có API

| Tầng | Công nghệ | Phiên bản |
|---|---|---|
| Runtime | **Python** + **uv** | 3.12 |
| Lịch chạy | **APScheduler** (nội bộ container worker) | — |
| NLP tiếng Việt | **PhoBERT** (HuggingFace `transformers`) | — |
| Thu thập tin bài | **news-please** | — |
| Transform | **dbt-core** + `dbt-postgres` | 1.8+ |

### Hạ tầng dữ liệu

| Tầng | Công nghệ | Phiên bản |
|---|---|---|
| Ingest (EL) | **Airbyte OSS** (self-host) | latest stable |
| Kho dữ liệu | **PostgreSQL** | 16 |
| BI phụ trợ | **Metabase** (self-host, cho cán bộ tự truy vấn) | — |
| Web analytics | **Matomo** (self-host) | — |
| Đóng gói | **Docker Compose v2** | — |

**Lý do khoá lựa chọn:**

- TypeScript phủ cả `api` và `web` để **dùng chung một bộ zod schema** trong `packages/shared`.
  Sai lệch kiểu dữ liệu giữa backend và frontend trở thành lỗi biên dịch thay vì lỗi runtime.
  Đây là lý do chính chọn NestJS thay vì FastAPI — nếu bỏ monorepo thì lợi ích này mất sạch.
- NestJS thay vì Express/Fastify trần: cấu trúc module + DI làm kiến trúc tự tài liệu hoá,
  và `@nestjs/swagger` sinh sẵn tài liệu API cho hồ sơ nghiệm thu.
- Python **không bị loại bỏ** vì dbt, PhoBERT, news-please không có bản thay thế trong Node.
  Nhưng toàn bộ phần Python là **batch job chạy theo lịch**, ghi kết quả xuống PostgreSQL.
  NestJS chỉ đọc từ PostgreSQL, **không bao giờ gọi HTTP sang worker Python**.
- ECharts thay vì Recharts vì cần treemap / sankey / wordcloud cho social listening.
- Metabase tồn tại song song với dashboard tự viết: dashboard tự viết phục vụ báo cáo lãnh đạo,
  Metabase phục vụ cán bộ tự khai thác ad-hoc.

**Không dùng:** FastAPI/Django/Flask (backend đã là NestJS), Express trần, Prisma, TypeORM,
Redux, styled-components, Chart.js, Recharts, Streamlit, Dash, Tableau, Power BI, Superset,
Airflow, Dagster, MongoDB, Celery.

## 3. Cấu trúc thư mục

```
.
├─ apps/
│  ├─ api/                    # NestJS
│  │  └─ src/
│  │     ├─ modules/          # một thư mục một domain: controller · service · repository
│  │     ├─ common/           # guard, interceptor, filter, pipe
│  │     ├─ db/               # drizzle schema (BẢNG ỨNG DỤNG) + migrations
│  │     └─ config/
│  ├─ web/                    # Next.js
│  │  └─ src/
│  │     ├─ app/              # App Router
│  │     ├─ components/       # ui/ (shadcn) · charts/ · layout/
│  │     ├─ lib/              # api client, utils
│  │     └─ hooks/
│  └─ worker/                 # Python — batch, KHÔNG có HTTP API
│     ├─ crawler/             # news-please
│     ├─ nlp/                 # PhoBERT sentiment
│     ├─ jobs/                # APScheduler
│     └─ tests/
├─ packages/
│  ├─ shared/                 # zod schema + type dùng chung api ↔ web  ★ nguồn sự thật
│  └─ config/                 # eslint, tsconfig, prettier dùng chung
├─ dbt/                       # models/staging · models/intermediate · models/marts
├─ airbyte/                   # cấu hình connector (KHÔNG commit token)
├─ docker/                    # Dockerfile từng service
├─ docs/                      # tài liệu nghiệm thu
├─ docker-compose.yml
├─ turbo.json
├─ pnpm-workspace.yaml
└─ .env.example
```

## 4. Quy tắc Backend (NestJS)

- **Một domain một module.** Mỗi module có `*.controller.ts`, `*.service.ts`, `*.repository.ts`.
  Controller chỉ nhận request → gọi service → trả response. Business logic ở service.
  Truy vấn DB ở repository. **Không viết SQL trong controller hoặc service.**
- **DTO là zod schema, đặt ở `packages/shared`.** Không định nghĩa DTO cục bộ trong `apps/api`.
  Dùng `nestjs-zod` để biến schema thành DTO class có validation và có mặt trong Swagger.
  Frontend import đúng schema đó. Đây là ràng buộc bắt buộc, không có ngoại lệ.
- **Không dùng ORM để đọc bảng mart.** Các bảng `mart__*` do dbt sinh ra — đọc bằng
  `db.execute(sql\`...\`)` của Drizzle trong repository, không khai báo thành Drizzle schema.
  Drizzle schema **chỉ** mô tả bảng nghiệp vụ của ứng dụng (user, cấu hình, audit log).
- **Migration.** Bảng ứng dụng quản lý bằng `drizzle-kit generate` + `migrate`.
  Bảng do dbt sinh ra KHÔNG được đưa vào drizzle-kit — nếu drizzle-kit sinh migration định
  xoá bảng `mart__*` hay `stg__*`, đó là dấu hiệu đã khai báo schema sai.
- **Config.** Đọc qua `@nestjs/config` + zod validate lúc khởi động. Fail fast nếu thiếu biến.
  Không đọc `process.env` rải rác trong code nghiệp vụ.
- **Bí mật.** Token Facebook/Google/TikTok/Zalo chỉ nằm trong biến môi trường. Tuyệt đối không
  commit, không log, không trả về qua API.
- **Job nền** dùng BullMQ (làm mới cache, gửi báo cáo định kỳ, kích hoạt `dbt run`).
  Job dài phải idempotent — chạy lại hai lần không được nhân đôi dữ liệu.
- **Swagger.** Mọi endpoint phải có `@ApiOperation` mô tả bằng tiếng Việt. `/api/docs` phải
  luôn dựng được — đây là sản phẩm nghiệm thu.
- Lint/format: **ESLint** + **Prettier**. `strict: true`, cấm `any`, cấm `@ts-ignore`.
- Test: **Vitest** + `supertest`. Mọi endpoint mới phải có ít nhất 1 test happy path và
  1 test lỗi.

## 5. Quy tắc Frontend (Next.js)

- **Server Components mặc định.** Chỉ thêm `"use client"` khi thật sự cần state/effect/event.
  Component biểu đồ là client component, phần bọc ngoài giữ ở server.
- **TypeScript strict.** Cấm `any`. **Không tự khai báo lại type của dữ liệu API** — luôn
  import từ `packages/shared`. Thấy một `interface` mô tả response API nằm trong `apps/web`
  là dấu hiệu sai, phải chuyển về `packages/shared`.
- **Fetch dữ liệu.** Client component dùng TanStack Query. Server component dùng `fetch` với
  `revalidate` phù hợp. Mọi request đi qua `src/lib/api.ts`, không gọi `fetch` rải rác.
  Response phải `parse` bằng zod schema tương ứng trước khi dùng.
- **UI.** Ưu tiên component có sẵn của shadcn/ui. Chỉ tạo component mới khi shadcn không có.
  Style bằng Tailwind utility, không viết CSS module, không CSS-in-JS.
- **Biểu đồ.** Đặt trong `components/charts/`, mỗi loại một file, nhận dữ liệu qua props —
  component biểu đồ **không tự fetch**. Trục và tooltip phải có nhãn tiếng Việt và đơn vị.
  Định dạng số theo locale `vi-VN`.
  Trước khi viết biểu đồ hoặc chọn màu, đọc skill `dataviz`.
- **Màu sắc.** Bảng màu định nghĩa một chỗ trong Tailwind theme. Không hardcode mã hex trong
  component. Phải đọc được ở cả light và dark mode, tương phản đạt WCAG AA.
- **Không lộ bí mật.** Chỉ biến `NEXT_PUBLIC_*` mới ra tới trình duyệt. Không gọi trực tiếp
  API Facebook/Google từ frontend — luôn đi qua backend.

## 6. Quy tắc Worker Python

- **Worker không có HTTP API.** Không cài FastAPI/Flask vào đây. Nó là tiến trình chạy theo
  lịch: đọc nguồn → xử lý → ghi PostgreSQL. NestJS đọc kết quả từ PostgreSQL.
- Ba nhóm việc: `crawler/` (news-please quét báo VN), `nlp/` (PhoBERT chấm sắc thái bình luận
  và tin bài), `jobs/` (APScheduler định nghĩa lịch).
- **Idempotent bắt buộc.** Mỗi bản ghi có khoá tự nhiên (URL bài báo, comment id) — ghi bằng
  `ON CONFLICT DO NOTHING/UPDATE`. Chạy lại job không được sinh bản ghi trùng.
- Model PhoBERT tải sẵn vào image lúc build, **không tải từ HuggingFace lúc chạy** — máy chủ
  Học viện có thể không ra được Internet, và nghiệm thu phải chạy offline được.
- Kết quả sentiment ghi vào bảng riêng kèm `model_version` và `scored_at`, không ghi đè dữ liệu
  gốc. Phải truy vết được điểm số nào do phiên bản model nào sinh ra.
- Lint/format: **Ruff**. Type check: **mypy** strict. Test: **pytest**.
- Quản lý dependency bằng **uv** (`uv sync`), không dùng pip/poetry.

## 7. Quy tắc dbt

- Ba tầng, đặt tên bắt buộc:
  - `stg__<nguồn>__<thực_thể>` — 1:1 với bảng thô Airbyte, chỉ ép kiểu và đổi tên cột.
  - `int__<chủ_đề>` — logic trung gian, không expose ra ngoài.
  - `mart__<chủ_đề>` — bảng phục vụ dashboard, đây là hợp đồng dữ liệu với backend.
- **Lược đồ hợp nhất đa kênh** bám theo chuẩn `fivetran/dbt_ad_reporting` (Apache-2.0), viết
  lại bằng dbt-core: `mart__account_report`, `mart__campaign_report`, `mart__ad_report`,
  `mart__url_report` với các cột chuẩn `spend / impressions / clicks / conversions` và cột
  `platform` phân biệt Facebook / Google / TikTok / YouTube / Zalo.
- Mọi model phải có `schema.yml`: mô tả model, mô tả cột, và test `unique` + `not_null` cho
  khoá. Model tầng mart bắt buộc thêm test `accepted_values` cho cột `platform`.
- Không sửa dữ liệu thô do Airbyte đổ vào. Mọi biến đổi làm ở dbt.

## 8. Quy tắc Docker

- **Một lệnh dựng toàn hệ thống:** `docker compose up -d`. Nếu một thay đổi phá vỡ điều này,
  thay đổi đó chưa hoàn thành.
- Services: `postgres` · `redis` · `api` · `web` · `worker` · `metabase` · `matomo` ·
  `caddy` (reverse proxy). Airbyte chạy bằng compose riêng của nó, kết nối qua network ngoài
  `ptit_dashboard_net`.
- **Multi-stage build** cho `api`, `web`, `worker`. Ảnh runtime dùng base `-slim`/`alpine`,
  không chứa toolchain build.
  - `api`: build bằng `node:24`, chạy bằng `node:24-slim`. Dùng `pnpm deploy --filter` để
    ảnh runtime chỉ chứa đúng dependency của app đó.
  - `web`: dùng `output: "standalone"` của Next.js.
  - `worker`: `python:3.12-slim`, model PhoBERT nướng sẵn vào layer image.
- **Chạy bằng user không phải root.** Mỗi Dockerfile phải có `USER appuser`.
- **Healthcheck bắt buộc** cho `postgres`, `redis`, `api`. Service phụ thuộc dùng
  `depends_on: condition: service_healthy`.
- **Volume có tên** cho dữ liệu bền vững (`pgdata`, `matomo_data`, `metabase_data`,
  `hf_models`). Không bind-mount thư mục dữ liệu vào host trong cấu hình production.
- Cổng: chỉ `caddy` publish ra ngoài (80/443). Các service khác chỉ mở trong network nội bộ.
  Bản dev có thể publish thêm để debug, đặt ở `docker-compose.override.yml`.
- Pin phiên bản image cụ thể (`postgres:16-alpine`), **không dùng `latest`** cho service dữ liệu.
- `.env` không bao giờ được commit. Mỗi biến mới thêm vào phải có mặt trong `.env.example`
  kèm chú thích tiếng Việt.

## 9. Quy tắc chung khi Claude làm việc

- **Không tự đổi ngăn xếp** ở mục 2. Không thêm framework mới mà không hỏi.
- **Không thêm dependency** chỉ để dùng một hàm tiện ích nhỏ.
- Khi sửa lược đồ dữ liệu, phải sửa đồng bộ **3 nơi**: dbt model → `schema.yml` →
  zod schema ở `packages/shared`. Sửa thiếu một nơi là thay đổi chưa hoàn thành.
  (Không còn nơi thứ 4 vì backend và frontend dùng chung zod schema — giữ nguyên tính chất này,
  đừng nhân bản type.)
- Không tạo file tài liệu `.md` mới trừ khi được yêu cầu. Tài liệu nghiệm thu để trong `docs/`.
- Không commit và không push nếu người dùng không yêu cầu.
- Dữ liệu thật của fanpage/website là dữ liệu vận hành của Học viện — không đưa lên dịch vụ
  bên thứ ba, không đính kèm vào issue/PR công khai.
- Khi viết seed/fixture để demo, dùng dữ liệu giả lập rõ ràng, đặt trong `dbt/seeds/` và ghi
  chú là dữ liệu mẫu — không được lẫn với dữ liệu thật khi nghiệm thu.

## 10. Lệnh thường dùng

```bash
# Toàn hệ thống
docker compose up -d --build
docker compose logs -f api

# Monorepo (từ thư mục gốc)
pnpm install
pnpm dev                 # turbo chạy song song api + web
pnpm lint && pnpm typecheck && pnpm test
pnpm build

# Backend
pnpm --filter api start:dev
pnpm --filter api exec drizzle-kit generate   # tạo migration
pnpm --filter api exec drizzle-kit migrate

# Frontend
pnpm --filter web dev
pnpm --filter web build

# Worker Python (trong container hoặc venv 3.12)
uv sync
uv run python -m jobs.main            # chạy scheduler
uv run ruff check --fix . && uv run mypy .
uv run pytest -q

# dbt
dbt deps && dbt build                 # chạy model + test
dbt test --select mart__
dbt docs generate && dbt docs serve
```

## 11. Trạng thái hiện tại

Repo mới có tài liệu nhiệm vụ và một script ví dụ gọi Claude API (`claude_example.py`) —
script này là phần thử nghiệm, không thuộc kiến trúc chính, có thể xoá khi bắt đầu scaffold.

Máy dev hiện tại: Node 26, Python 3.14, **Docker chưa cài** — cần cài Docker Desktop trước
khi dựng hệ thống. Phiên bản trong container (Node 24 LTS, Python 3.12) mới là phiên bản chuẩn.
Không chạy worker bằng Python 3.14 của máy host vì `torch`/`transformers` chưa hỗ trợ đầy đủ.
Node 26 chạy dev được, nhưng khi nghi ngờ lỗi môi trường thì đối chiếu với Node 24 trong container.
