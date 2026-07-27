# syntax=docker/dockerfile:1

# Ảnh cho worker Python: crawler earned media + lịch chạy nền.
# KHÔNG có HTTP API trong này — worker chỉ nói chuyện với PostgreSQL.

# ---- Tầng build ------------------------------------------------------------
FROM python:3.12-slim AS build

# uv là công cụ quản lý phụ thuộc đã chốt ở CLAUDE.md. Lấy từ ảnh chính thức thay vì
# tải bằng script để bản dựng tái lập được.
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Cài phụ thuộc trước, chép mã nguồn sau: sửa mã không phải cài lại thư viện.
COPY apps/worker/pyproject.toml apps/worker/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY apps/worker/ ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---- Ảnh chạy --------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Không chạy bằng root.
RUN useradd --create-home --uid 1000 appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /app /app

# Nơi chứa dữ liệu tạm khi chạy chế độ DuckDB; ở chế độ PostgreSQL thì không dùng tới.
RUN mkdir -p /app/.data && chown appuser:appuser /app/.data

USER appuser

# Tiến trình lịch. Không có cổng nào mở ra ngoài.
CMD ["python", "-m", "jobs.main"]
