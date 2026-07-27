"""Ghi chỉ số quan tâm tìm kiếm xuống kho. Idempotent theo (thương hiệu, tuần).

Bảng này là bảng THÔ. Nó chỉ chứa mức quan tâm đã quy về cùng thang giữa các lượt gọi
— phép quy thang là một phần của việc thu thập, không khôi phục lại được về sau. Còn
phép chia tỷ trọng (thị phần) thuộc về dbt, không làm ở đây.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime
from typing import Any, Protocol

from .settings import WORKER_ROOT, CacheSettings, ConfigError

TABLE = "raw_brand_search_interest"

# Khoá chính ghép (brand_key, week_start): chạy lại job bao nhiêu lần cũng không sinh
# bản ghi trùng. Mọi cột thời gian dùng TIMESTAMPTZ để không mất múi giờ khi máy dev
# (UTC+7) và máy chủ (UTC) cùng ghi vào một kho.
DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    brand_key       TEXT NOT NULL,
    week_start      DATE NOT NULL,
    interest_index  DOUBLE PRECISION NOT NULL,
    query_term      TEXT NOT NULL,
    geo             TEXT NOT NULL,
    timeframe       TEXT NOT NULL,
    anchor_key      TEXT NOT NULL,
    collected_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (brand_key, week_start)
)
"""

# Google hiệu chỉnh lại số liệu của vài tuần gần nhất sau khi công bố, nên lần chạy sau
# được quyền ghi đè lần chạy trước. Đây là lý do dùng DO UPDATE chứ không DO NOTHING.
UPSERT = """
INSERT INTO {table} (
    brand_key, week_start, interest_index, query_term, geo, timeframe, anchor_key, collected_at
) VALUES ({ph})
ON CONFLICT (brand_key, week_start) DO UPDATE SET
    interest_index = EXCLUDED.interest_index,
    query_term     = EXCLUDED.query_term,
    geo            = EXCLUDED.geo,
    timeframe      = EXCLUDED.timeframe,
    anchor_key     = EXCLUDED.anchor_key,
    collected_at   = EXCLUDED.collected_at
"""

COLUMN_COUNT = 8


@dataclass(frozen=True)
class SearchInterestRow:
    """Một dòng của bảng thô. Thứ tự trường khớp đúng thứ tự cột trong câu INSERT."""

    brand_key: str
    week_start: date
    interest_index: float
    query_term: str
    geo: str
    timeframe: str
    anchor_key: str
    collected_at: datetime

    def as_row(self) -> tuple[Any, ...]:
        return (
            self.brand_key,
            self.week_start,
            self.interest_index,
            self.query_term,
            self.geo,
            self.timeframe,
            self.anchor_key,
            self.collected_at,
        )


class Store(Protocol):
    def upsert(self, rows: list[SearchInterestRow]) -> None: ...
    def count(self) -> int: ...
    def close(self) -> None: ...


def trends_cache_settings() -> CacheSettings:
    """Kho riêng cho Trends, tách khỏi kho GA4 và kho tin bài."""
    goc = CacheSettings.from_env()
    return replace(
        goc,
        duckdb_path=WORKER_ROOT / os.getenv("TRENDS_DUCKDB_PATH", ".data/ptit_trends.duckdb"),
        schema_name=os.getenv("TRENDS_SCHEMA", "trends_raw"),
    )


class DuckDbStore:
    def __init__(self, settings: CacheSettings) -> None:
        import duckdb

        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(settings.duckdb_path))
        self._con.execute(DDL.format(table=TABLE))

    def upsert(self, rows: list[SearchInterestRow]) -> None:
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

    def upsert(self, rows: list[SearchInterestRow]) -> None:
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
    settings = settings or trends_cache_settings()
    return DuckDbStore(settings) if settings.kind == "duckdb" else PostgresStore(settings)


def now() -> datetime:
    return datetime.now(UTC)
