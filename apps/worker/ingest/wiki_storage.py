"""Ghi lượt xem trang Wikipedia xuống kho. Idempotent theo (thương hiệu, tuần).

Bảng THÔ: chỉ chứa số đếm tuyệt đối. Phép chia tỷ trọng thuộc về dbt, không làm ở đây
— khác với bên Trends, số đếm này không cần bước quy thang nào nên bảng thô đúng nghĩa
là dữ liệu gốc, muốn tính lại kiểu gì cũng được.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime
from typing import Any, Protocol

from .settings import WORKER_ROOT, CacheSettings, ConfigError

TABLE = "raw_brand_pageviews"

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    brand_key    TEXT NOT NULL,
    week_start   DATE NOT NULL,
    views        BIGINT NOT NULL,
    article      TEXT NOT NULL,
    project      TEXT NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (brand_key, week_start)
)
"""

# Chỉ ghi lại những tuần đã trọn vẹn nên số liệu về nguyên tắc không đổi. Vẫn dùng
# DO UPDATE để chạy lại job vá được các tuần trước đó bị hụt vì lỗi mạng.
UPSERT = """
INSERT INTO {table} (brand_key, week_start, views, article, project, collected_at)
VALUES ({ph})
ON CONFLICT (brand_key, week_start) DO UPDATE SET
    views        = EXCLUDED.views,
    article      = EXCLUDED.article,
    project      = EXCLUDED.project,
    collected_at = EXCLUDED.collected_at
"""

COLUMN_COUNT = 6


@dataclass(frozen=True)
class PageviewsRow:
    """Một dòng của bảng thô. Thứ tự trường khớp đúng thứ tự cột trong câu INSERT."""

    brand_key: str
    week_start: date
    views: int
    article: str
    project: str
    collected_at: datetime

    def as_row(self) -> tuple[Any, ...]:
        return (
            self.brand_key,
            self.week_start,
            self.views,
            self.article,
            self.project,
            self.collected_at,
        )


class Store(Protocol):
    def upsert(self, rows: list[PageviewsRow]) -> None: ...
    def count(self) -> int: ...
    def close(self) -> None: ...


def wiki_cache_settings() -> CacheSettings:
    """Kho riêng cho lượt xem Wikipedia, tách khỏi kho GA4, Trends và tin bài."""
    goc = CacheSettings.from_env()
    return replace(
        goc,
        duckdb_path=WORKER_ROOT / os.getenv("WIKI_DUCKDB_PATH", ".data/ptit_wiki.duckdb"),
        schema_name=os.getenv("WIKI_SCHEMA", "wiki_raw"),
    )


class DuckDbStore:
    def __init__(self, settings: CacheSettings) -> None:
        import duckdb

        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(settings.duckdb_path))
        self._con.execute(DDL.format(table=TABLE))

    def upsert(self, rows: list[PageviewsRow]) -> None:
        if not rows:
            return
        cau_lenh = UPSERT.format(table=TABLE, ph=", ".join(["?"] * COLUMN_COUNT))
        self._con.executemany(cau_lenh, [r.as_row() for r in rows])
        self._con.commit()

    def count(self) -> int:
        ket_qua = self._con.execute(f"SELECT count(*) FROM {TABLE}").fetchone()
        return int(ket_qua[0]) if ket_qua else 0

    def close(self) -> None:
        self._con.close()


class PostgresStore:
    def __init__(self, settings: CacheSettings) -> None:
        try:
            import psycopg
        except ImportError as loi:  # pragma: no cover — chỉ xảy ra khi chưa dựng Docker
            raise ConfigError(
                "Cần psycopg để ghi vào PostgreSQL: uv add psycopg[binary]. "
                "Hoặc đặt INGEST_CACHE=duckdb để chạy bằng file cục bộ."
            ) from loi

        self._schema = settings.schema_name
        self._con = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )
        with self._con.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {self._schema}")
            cur.execute(DDL.format(table=self._bang()))
        self._con.commit()

    def _bang(self) -> str:
        return f"{self._schema}.{TABLE}"

    def upsert(self, rows: list[PageviewsRow]) -> None:
        if not rows:
            return
        cau_lenh = UPSERT.format(table=self._bang(), ph=", ".join(["%s"] * COLUMN_COUNT))
        with self._con.cursor() as cur:
            cur.executemany(cau_lenh, [r.as_row() for r in rows])
        self._con.commit()

    def count(self) -> int:
        with self._con.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM {self._bang()}")
            ket_qua = cur.fetchone()
        return int(ket_qua[0]) if ket_qua else 0

    def close(self) -> None:
        self._con.close()


def open_store(settings: CacheSettings | None = None) -> Store:
    settings = settings or wiki_cache_settings()
    return DuckDbStore(settings) if settings.kind == "duckdb" else PostgresStore(settings)


def now() -> datetime:
    return datetime.now(UTC)
