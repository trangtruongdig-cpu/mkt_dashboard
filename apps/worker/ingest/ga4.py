"""
Hút dữ liệu Google Analytics 4 về kho bằng connector chính thức của Airbyte.

Chạy qua PyAirbyte nên KHÔNG cần Docker — vẫn đúng connector
`source-google-analytics-data-api` mà Airbyte OSS dùng, cùng lược đồ cấu hình.
Khi Học viện dựng được Docker, bê nguyên khối config sang giao diện Airbyte là chạy.

Dùng OAuth của tài khoản người dùng nên **quyền xem (viewer) trên property là đủ**;
không cần quyền quản trị GA4.
"""

from __future__ import annotations

import os
from typing import Any

from .settings import CacheSettings, Ga4Settings, load_custom_reports

CONNECTOR_NAME = "source-google-analytics-data-api"

# Connector GA4 của Airbyte là loại low-code, trong manifest có kèm thành phần Python
# riêng. PyAirbyte mặc định chặn chạy mã tuỳ chỉnh; không bật cờ này thì connector
# không chạy được kể cả lệnh `spec`.
#
# An toàn ở đây vì đây là connector chính thức của Airbyte, cài từ PyPI, phiên bản ghim
# trong uv.lock. Nếu sau này thêm connector từ nguồn khác, phải xem lại quyết định này.
os.environ.setdefault("AIRBYTE_ENABLE_UNSAFE_CODE", "true")


def build_source_config(settings: Ga4Settings) -> dict[str, Any]:
    """Dựng khối cấu hình connector. Không log giá trị trả về — có bí mật bên trong."""
    return {
        "property_ids": [settings.property_id],
        "credentials": {
            "auth_type": "Client",
            "client_id": settings.client_id,
            "client_secret": settings.client_secret,
            "refresh_token": settings.refresh_token,
        },
        "date_ranges_start_date": settings.start_date,
        "window_in_days": settings.window_in_days,
        "keep_empty_rows": False,
        "custom_reports_array": load_custom_reports(),
    }


def create_source(settings: Ga4Settings | None = None) -> Any:
    import airbyte as ab

    settings = settings or Ga4Settings.load()
    return ab.get_source(
        CONNECTOR_NAME,
        config=build_source_config(settings),
        install_if_missing=True,
    )


def create_cache(settings: CacheSettings | None = None) -> Any:
    settings = settings or CacheSettings.from_env()

    if settings.kind == "duckdb":
        from airbyte.caches import DuckDBCache

        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        return DuckDBCache(
            db_path=str(settings.duckdb_path),
            schema_name=settings.schema_name,
        )

    from airbyte.caches import PostgresCache

    return PostgresCache(
        host=settings.postgres_host,
        port=settings.postgres_port,
        username=settings.postgres_user,
        password=settings.postgres_password,
        database=settings.postgres_db,
        schema_name=settings.schema_name,
    )


def print_spec() -> None:
    """Cài connector và in lược đồ cấu hình. Không cần thông tin đăng nhập."""
    import airbyte as ab

    source = ab.get_source(CONNECTOR_NAME, install_if_missing=True)
    source.print_config_spec()


def check_connection() -> None:
    """Kiểm tra thông tin đăng nhập và quyền truy cập property."""
    from .ga4_api import check_access

    print(f"Kết nối GA4 hợp lệ: {check_access(Ga4Settings.load())}")


def _ghi_duckdb(bang: dict[str, list[dict[str, Any]]]) -> None:
    """
    Ghi từng báo cáo thành một bảng trong DuckDB.

    Nạp qua file JSON tạm để DuckDB tự suy ra kiểu cột — khỏi phải kéo thêm pandas
    chỉ để dựng bảng.

    Ghi đè toàn bộ bảng mỗi lượt, không nạp tăng dần: dữ liệu là số liệu tổng hợp
    theo ngày, khối lượng nhỏ, và GA4 còn hiệu chỉnh số liệu vài ngày sau đó — nạp
    lại toàn bộ vừa đơn giản vừa luôn khớp với nguồn.
    """
    import json as _json
    import tempfile
    from pathlib import Path as _Path

    import duckdb

    settings = CacheSettings.from_env()
    settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(str(settings.duckdb_path))
    try:
        con.execute(f'CREATE SCHEMA IF NOT EXISTS "{settings.schema_name}"')

        for ten, rows in bang.items():
            if not rows:
                print(f"  {ten}: không có dòng nào, bỏ qua")
                continue

            with tempfile.NamedTemporaryFile(
                "w", suffix=".json", delete=False, encoding="utf-8"
            ) as f:
                _json.dump(rows, f, ensure_ascii=False)
                duong_dan = f.name

            try:
                con.execute(
                    f'CREATE OR REPLACE TABLE "{settings.schema_name}"."{ten}" AS '
                    f"SELECT * FROM read_json_auto(?)",
                    [duong_dan],
                )
            finally:
                _Path(duong_dan).unlink(missing_ok=True)
    finally:
        con.close()

    print(f"\nĐã ghi vào {settings.duckdb_path}")


def run_sync(streams: list[str] | None = None) -> None:
    """
    Đồng bộ dữ liệu GA4 về kho.

    Gọi thẳng Data API thay vì qua connector Airbyte — lý do ghi trong `ga4_api.py`.
    Định nghĩa báo cáo vẫn đọc từ `airbyte/config/ga4-custom-reports.json` nên khi
    chuyển sang Airbyte OSS thì không phải viết lại.
    """
    from .ga4_api import fetch_all

    settings = Ga4Settings.load()
    print(f"Đang kéo dữ liệu property {settings.property_id} từ {settings.start_date}…")

    du_lieu = fetch_all(settings)

    if streams:
        du_lieu = {k: v for k, v in du_lieu.items() if k in streams}

    _ghi_duckdb(du_lieu)
