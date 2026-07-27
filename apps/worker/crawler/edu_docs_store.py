"""Ghi danh mục tài liệu công khai xuống kho. Idempotent theo đường dẫn tài liệu.

Bảng THÔ: chỉ ghi nhận "có tài liệu này, thuộc trường này, loại này, năm này". Việc mở
tệp ra lấy số nằm ở bước sau và ghi vào bảng khác — tách hai bước để chạy lại bước bóc
số không phải quét lại toàn bộ website.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any, Protocol

from .settings import WORKER_ROOT, CrawlerError, StoreSettings

TABLE = "raw_disclosure_document"

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    doc_url       TEXT PRIMARY KEY,
    school_key    TEXT NOT NULL,
    title         TEXT NOT NULL,
    kind          TEXT NOT NULL,
    year          INTEGER,
    seed_url      TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at  TIMESTAMPTZ NOT NULL
)
"""

# Thêm sau khi bảng đã tồn tại ở các máy chạy bản trước. Cả DuckDB lẫn PostgreSQL đều
# hiểu ADD COLUMN IF NOT EXISTS, nên không cần công cụ di trú riêng cho bảng thô.
MIGRATIONS = (
    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS has_text_layer BOOLEAN",
    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS probed_at TIMESTAMPTZ",
)

# Gặp lại tài liệu cũ: cập nhật last_seen_at và các trường có thể được phân loại lại
# tốt hơn ở lần chạy sau, nhưng giữ nguyên first_seen_at để biết tài liệu xuất hiện
# từ bao giờ.
UPSERT = """
INSERT INTO {table} (
    doc_url, school_key, title, kind, year, seed_url, first_seen_at, last_seen_at
) VALUES ({ph})
ON CONFLICT (doc_url) DO UPDATE SET
    title        = EXCLUDED.title,
    kind         = EXCLUDED.kind,
    year         = COALESCE(EXCLUDED.year, {table}.year),
    seed_url     = EXCLUDED.seed_url,
    last_seen_at = EXCLUDED.last_seen_at
"""

COLUMN_COUNT = 8


@dataclass(frozen=True)
class DocumentRow:
    """Một dòng của bảng thô. Thứ tự trường khớp đúng thứ tự cột trong câu INSERT."""

    doc_url: str
    school_key: str
    title: str
    kind: str
    year: int | None
    seed_url: str
    first_seen_at: datetime
    last_seen_at: datetime

    def as_row(self) -> tuple[Any, ...]:
        return (
            self.doc_url,
            self.school_key,
            self.title,
            self.kind,
            self.year,
            self.seed_url,
            self.first_seen_at,
            self.last_seen_at,
        )


HIGH_VALUE_SQL = """
SELECT kind, school_key, year, has_text_layer, doc_url
FROM {table}
WHERE kind IN ('bm18_chat_luong_thuc_te', 'de_an_tuyen_sinh')
ORDER BY kind, school_key, year
"""

UNPROBED_SQL = """
SELECT doc_url FROM {table}
WHERE probed_at IS NULL AND lower(doc_url) LIKE '%.pdf'
ORDER BY kind, school_key
"""

MARK_PROBE_SQL = """
UPDATE {table} SET has_text_layer = {ph}, probed_at = {ph} WHERE doc_url = {ph}
"""

# (kind, school_key, year, has_text_layer, doc_url)
HighValueRow = tuple[str, str, int | None, bool | None, str]


class Store(Protocol):
    def upsert(self, rows: list[DocumentRow]) -> None: ...
    def count(self) -> int: ...
    def group_count(self, cot: str) -> list[tuple[str, int]]: ...
    def unprobed_pdfs(self) -> list[str]: ...
    def mark_probe(self, url: str, has_text_layer: bool | None, at: datetime) -> None: ...
    def high_value_documents(self) -> list[HighValueRow]: ...
    def close(self) -> None: ...


def disclosure_store_settings() -> StoreSettings:
    """Kho riêng cho danh mục tài liệu, tách khỏi kho tin bài."""
    goc = StoreSettings.from_env()
    return replace(
        goc,
        duckdb_path=WORKER_ROOT
        / os.getenv("DISCLOSURE_DUCKDB_PATH", ".data/ptit_disclosure.duckdb"),
        schema_name=os.getenv("DISCLOSURE_SCHEMA", "disclosure_raw"),
    )


class DuckDbStore:
    def __init__(self, settings: StoreSettings) -> None:
        import duckdb

        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(settings.duckdb_path))
        self._con.execute(DDL.format(table=TABLE))
        for cau in MIGRATIONS:
            self._con.execute(cau.format(table=TABLE))

    def upsert(self, rows: list[DocumentRow]) -> None:
        if not rows:
            return
        cau_lenh = UPSERT.format(table=TABLE, ph=", ".join(["?"] * COLUMN_COUNT))
        self._con.executemany(cau_lenh, [r.as_row() for r in rows])
        self._con.commit()

    def count(self) -> int:
        ket_qua = self._con.execute(f"SELECT count(*) FROM {TABLE}").fetchone()
        return int(ket_qua[0]) if ket_qua else 0

    def group_count(self, cot: str) -> list[tuple[str, int]]:
        dong = self._con.execute(
            f"SELECT {cot}, count(*) FROM {TABLE} GROUP BY 1 ORDER BY 2 DESC"  # noqa: S608
        ).fetchall()
        return [(str(k), int(v)) for k, v in dong]

    def unprobed_pdfs(self) -> list[str]:
        dong = self._con.execute(UNPROBED_SQL.format(table=TABLE)).fetchall()
        return [str(r[0]) for r in dong]

    def mark_probe(self, url: str, has_text_layer: bool | None, at: datetime) -> None:
        self._con.execute(
            MARK_PROBE_SQL.format(table=TABLE, ph="?"), [has_text_layer, at, url]
        )
        self._con.commit()

    def high_value_documents(self) -> list[HighValueRow]:
        dong = self._con.execute(HIGH_VALUE_SQL.format(table=TABLE)).fetchall()
        return [(str(a), str(b), c, d, str(e)) for a, b, c, d, e in dong]

    def close(self) -> None:
        self._con.close()


class PostgresStore:
    def __init__(self, settings: StoreSettings) -> None:
        try:
            import psycopg
        except ImportError as loi:  # pragma: no cover — chỉ xảy ra khi chưa dựng Docker
            raise CrawlerError(
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
            for cau in MIGRATIONS:
                cur.execute(cau.format(table=self._bang()))
        self._con.commit()

    def _bang(self) -> str:
        return f"{self._schema}.{TABLE}"

    def upsert(self, rows: list[DocumentRow]) -> None:
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

    def group_count(self, cot: str) -> list[tuple[str, int]]:
        with self._con.cursor() as cur:
            cur.execute(
                f"SELECT {cot}, count(*) FROM {self._bang()} GROUP BY 1 ORDER BY 2 DESC"  # noqa: S608
            )
            dong = cur.fetchall()
        return [(str(k), int(v)) for k, v in dong]

    def unprobed_pdfs(self) -> list[str]:
        with self._con.cursor() as cur:
            cur.execute(UNPROBED_SQL.format(table=self._bang()))
            dong = cur.fetchall()
        return [str(r[0]) for r in dong]

    def mark_probe(self, url: str, has_text_layer: bool | None, at: datetime) -> None:
        with self._con.cursor() as cur:
            cur.execute(
                MARK_PROBE_SQL.format(table=self._bang(), ph="%s"), [has_text_layer, at, url]
            )
        self._con.commit()

    def high_value_documents(self) -> list[HighValueRow]:
        with self._con.cursor() as cur:
            cur.execute(HIGH_VALUE_SQL.format(table=self._bang()))
            dong = cur.fetchall()
        return [(str(a), str(b), c, d, str(e)) for a, b, c, d, e in dong]

    def close(self) -> None:
        self._con.close()


def open_store(settings: StoreSettings | None = None) -> Store:
    settings = settings or disclosure_store_settings()
    return DuckDbStore(settings) if settings.kind == "duckdb" else PostgresStore(settings)


def now() -> datetime:
    return datetime.now(UTC)
