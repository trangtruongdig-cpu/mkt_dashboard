# syntax=docker/dockerfile:1

# Ảnh cho worker Python: crawler earned media, lắng nghe mạng xã hội, chấm sắc thái,
# và lịch chạy nền. KHÔNG có HTTP API trong này — worker chỉ nói chuyện với PostgreSQL.

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

# ---- Tầng tải model --------------------------------------------------------
# Tách hẳn thành một tầng riêng, và đặt SAU bước cài thư viện nhưng chỉ phụ thuộc vào
# đúng hai file: script tải và file khai báo model. Sửa một dòng trong crawler không làm
# tải lại 1,4GB trọng số.
#
# Mục 6 CLAUDE.md: "Model PhoBERT tải sẵn vào image lúc build, KHÔNG tải từ HuggingFace
# lúc chạy — máy chủ Học viện có thể không ra được Internet, và nghiệm thu phải chạy
# offline được." Tải lúc chạy nghĩa là lần đầu chạy trên máy chủ thật sẽ hỏng, đúng lúc
# không ai kịp sửa.
FROM build AS models

ENV HF_HOME=/models

# Gọi thẳng python của venv, KHÔNG gọi `python` trần: tầng build chưa đặt PATH nên
# `python` trỏ vào Python hệ thống, nơi không có thư viện nào của dự án. Lỗi khi đó là
# `ModuleNotFoundError: No module named 'dotenv'` — nghe như thiếu phụ thuộc, trong khi
# thực ra là gọi nhầm trình thông dịch.
RUN --mount=type=cache,target=/root/.cache/uv \
    /app/.venv/bin/python scripts/download_models.py

# ---- Ảnh chạy --------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    # Trỏ transformers vào thư mục model đã nướng sẵn.
    HF_HOME=/models \
    # Cấm gọi ra HuggingFace lúc chạy. Thiếu file thì báo lỗi ngay thay vì lặng lẽ tải
    # về — nhờ vậy một bản dựng thiếu model bị phát hiện lúc chạy thử, không phải lúc
    # máy chủ mất mạng giữa đêm.
    HF_HUB_OFFLINE=1 \
    NLP_OFFLINE=1 \
    # torch mặc định mở số luồng bằng số nhân CPU. Trong container chạy chung máy với
    # PostgreSQL và hai ứng dụng Node, để mặc định sẽ tranh hết CPU mỗi lần chấm sắc thái.
    OMP_NUM_THREADS=2

# Không chạy bằng root.
RUN useradd --create-home --uid 1000 appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /app /app
COPY --from=models --chown=appuser:appuser /models /models

# Nơi chứa dữ liệu tạm khi chạy chế độ DuckDB; ở chế độ PostgreSQL thì không dùng tới.
RUN mkdir -p /app/.data && chown appuser:appuser /app/.data

USER appuser

# Tiến trình lịch. Không có cổng nào mở ra ngoài.
CMD ["python", "-m", "jobs.main"]
