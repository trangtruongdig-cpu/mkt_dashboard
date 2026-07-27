"""Ghi thảo luận mạng xã hội xuống kho. Idempotent: chạy lại job không sinh bản ghi trùng.

Đây là bảng THÔ — không biến đổi gì thêm ở đây. Mọi phép làm sạch, gom nhóm và chấm sắc
thái để tầng sau lo (`nlp/` chấm sắc thái, dbt gộp thành `mart__`).

Một bảng duy nhất cho mọi nền tảng, phân biệt bằng cột `platform`. Lý do: câu hỏi nghiệp vụ
luôn là "toàn bộ thảo luận về Học viện tuần này" chứ không phải "thảo luận trên YouTube" —
tách bảng theo nền tảng thì mọi truy vấn đều phải UNION lại.

Chạy được trên cả DuckDB (file cục bộ) lẫn PostgreSQL (kho thật), như bảng tin bài.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from datetime import UTC, datetime
from typing import Any, Protocol

from crawler.settings import StoreSettings

from .settings import SocialError

TABLE = "raw_social_mention"

# Khoá chính là mention_key = băm của (platform, native_id). Toàn bộ tính idempotent của
# job nằm ở ràng buộc này: cùng một bình luận, chạy bao nhiêu lần cũng chỉ một dòng.
#
# Mọi cột thời gian là TIMESTAMPTZ. Kiểu không múi giờ khiến trình điều khiển quy đổi sang
# giờ cục bộ rồi vứt múi giờ đi — cùng một bình luận chạy trên máy dev (UTC+7) và máy chủ
# (UTC) sẽ ra hai giờ đăng khác nhau.
DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    mention_key       TEXT PRIMARY KEY,
    platform          TEXT NOT NULL,
    source_name       TEXT NOT NULL,
    content_type      TEXT NOT NULL,
    native_id         TEXT NOT NULL,
    parent_key        TEXT,
    url               TEXT,
    title             TEXT,
    body_text         TEXT NOT NULL,
    body_chars        INTEGER NOT NULL DEFAULT 0,
    author_ref        TEXT,
    author_is_hashed  BOOLEAN NOT NULL DEFAULT true,
    published_at      TIMESTAMPTZ,
    like_count        INTEGER,
    reply_count       INTEGER,
    view_count        BIGINT,
    matched_keywords  TEXT NOT NULL,
    discovered_via    TEXT NOT NULL,
    search_term       TEXT,
    is_owned          BOOLEAN NOT NULL DEFAULT false,
    first_seen_at     TIMESTAMPTZ NOT NULL,
    last_seen_at      TIMESTAMPTZ NOT NULL
)
"""

# Gặp lại một bản ghi đã có:
#   · luôn cập nhật last_seen_at và các chỉ số tương tác — số lượt thích của một bình luận
#     tăng theo thời gian, giữ giá trị cũ là báo cáo sai mức độ lan toả;
#   · nội dung chỉ ghi đè khi lần này lấy được nhiều chữ hơn, để chạy lại job vá được các
#     bản ghi hỏng trước đó mà không xoá mất phần đã có;
#   · các cột mô tả nguồn (source_name, author_ref, content_type) LUÔN ghi đè theo lần chạy
#     mới nhất. Chúng là kết quả của logic bóc tách, không phải sự kiện lịch sử — sửa logic
#     mà bảng không đổi theo thì kho vĩnh viễn giữ cách hiểu cũ, và phải xoá kho làm lại
#     mới thấy được cải tiến;
#   · first_seen_at KHÔNG bao giờ đổi — đó là mốc "thương hiệu bị nhắc đến lần đầu",
#     dùng để dựng biểu đồ lượng thảo luận theo thời gian;
#   · search_term giữ nguyên từ khoá đầu tiên tìm ra bản ghi này, để truy được vì sao nó
#     lọt vào kho.
UPSERT = """
INSERT INTO {table} (
    mention_key, platform, source_name, content_type, native_id, parent_key, url, title,
    body_text, body_chars, author_ref, author_is_hashed, published_at, like_count,
    reply_count, view_count, matched_keywords, discovered_via, search_term, is_owned,
    first_seen_at, last_seen_at
) VALUES ({ph})
ON CONFLICT (mention_key) DO UPDATE SET
    last_seen_at     = EXCLUDED.last_seen_at,
    source_name      = EXCLUDED.source_name,
    content_type     = EXCLUDED.content_type,
    author_ref       = EXCLUDED.author_ref,
    author_is_hashed = EXCLUDED.author_is_hashed,
    discovered_via   = EXCLUDED.discovered_via,
    search_term      = COALESCE({table}.search_term, EXCLUDED.search_term),
    like_count       = COALESCE(EXCLUDED.like_count, {table}.like_count),
    reply_count      = COALESCE(EXCLUDED.reply_count, {table}.reply_count),
    view_count       = COALESCE(EXCLUDED.view_count, {table}.view_count),
    published_at     = COALESCE({table}.published_at, EXCLUDED.published_at),
    parent_key       = COALESCE(EXCLUDED.parent_key, {table}.parent_key),
    title            = COALESCE(EXCLUDED.title, {table}.title),
    url              = COALESCE(EXCLUDED.url, {table}.url),
    body_text        = CASE WHEN EXCLUDED.body_chars > {table}.body_chars
                            THEN EXCLUDED.body_text ELSE {table}.body_text END,
    body_chars       = CASE WHEN EXCLUDED.body_chars > {table}.body_chars
                            THEN EXCLUDED.body_chars ELSE {table}.body_chars END,
    matched_keywords = EXCLUDED.matched_keywords,
    is_owned         = EXCLUDED.is_owned
"""


@dataclass
class SocialMention:
    """Một dòng của bảng thô. Thứ tự trường khớp đúng thứ tự cột trong câu INSERT."""

    mention_key: str
    # youtube | reddit | forum — cột phân biệt nền tảng, dbt test accepted_values trên cột này.
    platform: str
    # Nguồn cụ thể trong nền tảng: "youtube", "r/TroChuyenLinhTinh", "tinhte.vn".
    source_name: str
    # video | comment | post | thread — hạt dữ liệu. Sắc thái chỉ chấm trên comment/post/thread;
    # video là bối cảnh, không phải ý kiến của người ngoài.
    content_type: str
    native_id: str
    # mention_key của bản ghi cha. Bình luận trỏ về video chứa nó; bài gốc để NULL.
    parent_key: str | None
    url: str | None
    title: str | None
    body_text: str
    body_chars: int
    # Đã ẩn danh thì là "anon:<16 ký tự băm>", chưa ẩn danh thì là tên hiển thị.
    author_ref: str | None
    author_is_hashed: bool
    published_at: datetime | None
    like_count: int | None
    reply_count: int | None
    view_count: int | None
    matched_keywords: list[str]
    discovered_via: str
    search_term: str | None
    is_owned: bool
    first_seen_at: datetime
    last_seen_at: datetime

    def as_row(self) -> tuple[Any, ...]:
        gia_tri = asdict(self)
        gia_tri["matched_keywords"] = json.dumps(self.matched_keywords, ensure_ascii=False)
        return tuple(gia_tri.values())


def _placeholders(ky_hieu: str) -> str:
    """Suy số ô giữ chỗ từ chính dataclass — thêm cột mới không cần sửa hai chỗ."""
    return ", ".join([ky_hieu] * len(fields(SocialMention)))


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
    def upsert(self, mentions: list[SocialMention]) -> None: ...
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

    def upsert(self, mentions: list[SocialMention]) -> None:
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
            raise SocialError(
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

    def upsert(self, mentions: list[SocialMention]) -> None:
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
