"""Ghi kết quả xuống kho. Idempotent: chạy lại job không sinh bản ghi trùng.

Đây là bảng THÔ — không biến đổi gì thêm ở đây. Mọi phép làm sạch, gộp và tính toán
để dbt lo (`stg__news__mention` → `int__` → `mart__`).

Chạy được trên hai kho: DuckDB (file cục bộ, chưa cần Docker) và PostgreSQL (kho thật).
Câu lệnh SQL giống nhau vì cả hai đều hiểu `INSERT ... ON CONFLICT`.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from datetime import UTC, datetime
from typing import Any, Protocol

from .settings import CrawlerError, StoreSettings

TABLE = "raw_news_mention"

# Khoá chính là mention_key. Toàn bộ tính idempotent của job nằm ở ràng buộc này.
#
# Mọi cột thời gian đều là TIMESTAMPTZ, không phải TIMESTAMP. Kiểu không múi giờ khiến
# trình điều khiển quy đổi thời điểm sang giờ cục bộ của máy rồi vứt múi giờ đi — cùng
# một bài chạy trên máy dev (UTC+7) và máy chủ (UTC) sẽ ra hai giờ đăng khác nhau.
DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    mention_key       TEXT PRIMARY KEY,
    url               TEXT,
    canonical_url     TEXT,
    title             TEXT NOT NULL,
    publisher         TEXT NOT NULL,
    published_at      TIMESTAMPTZ,
    discovered_via    TEXT NOT NULL,
    search_term       TEXT,
    matched_keywords  TEXT NOT NULL,
    body_text         TEXT,
    body_chars        INTEGER NOT NULL DEFAULT 0,
    language          TEXT,
    extraction_status TEXT NOT NULL,
    is_owned          BOOLEAN DEFAULT false,
    first_seen_at     TIMESTAMPTZ NOT NULL,
    last_seen_at      TIMESTAMPTZ NOT NULL
)
"""

# Bảng thô còn tiến hoá theo số nguồn thu được. Thêm cột bằng ALTER thay vì bắt người dùng
# xoá kho làm lại — chạy lại toàn bộ mẻ bóc toàn văn mất hàng chục phút.
# Cả DuckDB lẫn PostgreSQL đều hiểu `ADD COLUMN IF NOT EXISTS`.
#
# Cột thêm bằng ALTER không đặt được NOT NULL (DuckDB chưa hỗ trợ), nên trong DDL ở trên
# cũng để nullable. Nếu một bên NOT NULL còn bên kia không, kho dựng mới và kho nâng cấp
# sẽ có lược đồ khác nhau — đúng thứ sẽ vỡ khi hội đồng dựng lại hệ thống từ repo.
# Ràng buộc thật nằm ở kiểu `is_owned: bool` của NewsMention.
MIGRATIONS = ("ALTER TABLE {table} ADD COLUMN IF NOT EXISTS is_owned BOOLEAN DEFAULT false",)

# Gặp lại một bài đã có: luôn cập nhật last_seen_at, còn phần nội dung chỉ ghi đè khi
# lần này bóc được nhiều chữ hơn lần trước. Nhờ vậy chạy lại job để vá các bài
# hỏng trước đó mà không xoá mất dữ liệu đã lấy được.
UPSERT = """
INSERT INTO {table} (
    mention_key, url, canonical_url, title, publisher, published_at, discovered_via,
    search_term, matched_keywords, body_text, body_chars, language, extraction_status,
    is_owned, first_seen_at, last_seen_at
) VALUES ({ph})
ON CONFLICT (mention_key) DO UPDATE SET
    last_seen_at      = EXCLUDED.last_seen_at,
    is_owned          = EXCLUDED.is_owned,
    published_at      = COALESCE({table}.published_at, EXCLUDED.published_at),
    body_text         = CASE WHEN EXCLUDED.body_chars > {table}.body_chars
                             THEN EXCLUDED.body_text ELSE {table}.body_text END,
    body_chars        = CASE WHEN EXCLUDED.body_chars > {table}.body_chars
                             THEN EXCLUDED.body_chars ELSE {table}.body_chars END,
    language          = COALESCE({table}.language, EXCLUDED.language),
    extraction_status = CASE WHEN EXCLUDED.body_chars > {table}.body_chars
                             THEN EXCLUDED.extraction_status ELSE {table}.extraction_status END,
    matched_keywords  = EXCLUDED.matched_keywords
"""


@dataclass
class NewsMention:
    """Một dòng của bảng thô. Thứ tự trường khớp đúng thứ tự cột trong câu INSERT."""

    mention_key: str
    url: str | None
    canonical_url: str | None
    title: str
    publisher: str
    published_at: datetime | None
    discovered_via: str
    search_term: str | None
    matched_keywords: list[str]
    body_text: str
    body_chars: int
    language: str | None
    extraction_status: str
    is_owned: bool
    first_seen_at: datetime
    last_seen_at: datetime

    def as_row(self) -> tuple[Any, ...]:
        gia_tri = asdict(self)
        gia_tri["matched_keywords"] = json.dumps(self.matched_keywords, ensure_ascii=False)
        return tuple(gia_tri.values())


def _placeholders(ky_hieu: str) -> str:
    """Suy số ô giữ chỗ từ chính dataclass — thêm cột mới không cần sửa hai chỗ."""
    return ", ".join([ky_hieu] * len(fields(NewsMention)))


def _cau_lenh_gom_nhom(bang: str, bieu_thuc: str, theo_khoa: bool, limit: int | None) -> str:
    """Dựng câu đếm theo nhóm.

    `bieu_thuc` chỉ nhận hằng do mã nguồn quy định, không bao giờ nhận đầu vào người dùng.
    """
    return (
        f"SELECT {bieu_thuc}, count(*) FROM {bang} WHERE {bieu_thuc} IS NOT NULL "
        f"GROUP BY 1 ORDER BY {'1' if theo_khoa else '2 DESC'}"
        + (f" LIMIT {int(limit)}" if limit else "")
    )


class Store(Protocol):
    def upsert(self, mentions: list[NewsMention]) -> None: ...
    def count(self) -> int: ...
    def group_count(
        self, bieu_thuc: str, theo_khoa: bool = False, limit: int | None = None
    ) -> list[tuple[str, int]]: ...
    def close(self) -> None: ...


class DuckDbStore:
    def __init__(self, settings: StoreSettings) -> None:
        import duckdb

        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(settings.duckdb_path))
        self._con.execute(DDL.format(table=TABLE))
        for buoc in MIGRATIONS:
            self._con.execute(buoc.format(table=TABLE))

    def upsert(self, mentions: list[NewsMention]) -> None:
        if not mentions:
            return
        cau_lenh = UPSERT.format(table=TABLE, ph=_placeholders("?"))
        self._con.executemany(cau_lenh, [m.as_row() for m in mentions])
        self._con.commit()

    def count(self) -> int:
        ket_qua = self._con.execute(f"SELECT count(*) FROM {TABLE}").fetchone()
        return int(ket_qua[0]) if ket_qua else 0

    def group_count(
        self, bieu_thuc: str, theo_khoa: bool = False, limit: int | None = None
    ) -> list[tuple[str, int]]:
        dong = self._con.execute(_cau_lenh_gom_nhom(TABLE, bieu_thuc, theo_khoa, limit)).fetchall()
        return [(str(k), int(v)) for k, v in dong]

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
            for buoc in MIGRATIONS:
                cur.execute(buoc.format(table=self._bang()))
        self._con.commit()

    def _bang(self) -> str:
        return f"{self._schema}.{TABLE}"

    def upsert(self, mentions: list[NewsMention]) -> None:
        if not mentions:
            return
        cau_lenh = UPSERT.format(table=self._bang(), ph=_placeholders("%s"))
        with self._con.cursor() as cur:
            cur.executemany(cau_lenh, [m.as_row() for m in mentions])
        self._con.commit()

    def count(self) -> int:
        with self._con.cursor() as cur:
            cur.execute(f"SELECT count(*) FROM {self._bang()}")
            ket_qua = cur.fetchone()
        return int(ket_qua[0]) if ket_qua else 0

    def group_count(
        self, bieu_thuc: str, theo_khoa: bool = False, limit: int | None = None
    ) -> list[tuple[str, int]]:
        with self._con.cursor() as cur:
            cur.execute(_cau_lenh_gom_nhom(self._bang(), bieu_thuc, theo_khoa, limit))
            dong = cur.fetchall()
        return [(str(k), int(v)) for k, v in dong]

    def close(self) -> None:
        self._con.close()


def open_store(settings: StoreSettings | None = None) -> Store:
    settings = settings or StoreSettings.from_env()
    return DuckDbStore(settings) if settings.kind == "duckdb" else PostgresStore(settings)


def now() -> datetime:
    return datetime.now(UTC)
