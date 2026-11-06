"""Gán thuộc tính thương hiệu cho kho tin bài và ghi kết quả xuống kho.

Chỉ chạy trên bài CÓ TOÀN VĂN. Nhan đề không đủ: ba thuộc tính này hầu như không bao
giờ xuất hiện nguyên cụm trong tiêu đề, nên tính tỷ lệ trên toàn bộ kho sẽ cho ra một
con số thấp giả tạo. Mẫu số thật được ghi riêng xuống bảng để tầng sau hiện ra.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from crawler.settings import StoreSettings

from .attributes import AttributeMatchers, gan_thuoc_tinh

TABLE = "news_attribute"

# Dưới ngưỡng này thì phần toàn văn chỉ là đoạn mở đầu hoặc thông báo lỗi của trang.
MIN_BODY_CHARS = 200

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    mention_key   TEXT NOT NULL,
    attribute_key TEXT NOT NULL,
    matched       TEXT NOT NULL,
    tagged_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (mention_key, attribute_key)
)
"""

UPSERT = """
INSERT INTO {table} (mention_key, attribute_key, matched, tagged_at)
VALUES ({ph})
ON CONFLICT (mention_key, attribute_key) DO UPDATE SET
    matched   = EXCLUDED.matched,
    tagged_at = EXCLUDED.tagged_at
"""

COLUMN_COUNT = 4


@dataclass(frozen=True)
class KetQua:
    so_bai_xet: int
    so_bai_co_thuoc_tinh: int
    theo_thuoc_tinh: dict[str, int]


def _mo_ket_noi() -> tuple[Any, str, str, str]:
    """Trả về (kết nối, tên bảng đích, tên bảng tin bài, ký tự giữ chỗ)."""
    settings = StoreSettings.from_env()
    if settings.kind != "duckdb":  # pragma: no cover — chỉ dùng khi đã dựng PostgreSQL
        import psycopg

        con: Any = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )
        bang = f"{settings.schema_name}.{TABLE}"
        with con.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {settings.schema_name}")
            cur.execute(DDL.format(table=bang))
        con.commit()
        return con, bang, f"{settings.schema_name}.raw_news_mention", "%s"

    import duckdb

    settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(settings.duckdb_path))
    con.execute(DDL.format(table=TABLE))
    return con, TABLE, "raw_news_mention", "?"


def run() -> KetQua:
    """Gán thuộc tính cho mọi bài có toàn văn, ghi đè kết quả cũ của chính bài đó."""
    matchers = AttributeMatchers.load()
    con, bang, bang_tin, ph = _mo_ket_noi()
    thoi_diem = datetime.now(UTC)
    theo_thuoc_tinh: dict[str, int] = dict.fromkeys(matchers.keys, 0)
    so_bai_co = 0

    try:
        bai = con.execute(
            f"SELECT mention_key, title, body_text FROM {bang_tin} "
            f"WHERE body_text IS NOT NULL AND length(body_text) >= {MIN_BODY_CHARS}"
        ).fetchall()

        for khoa, nhan_de, than in bai:
            hits = gan_thuoc_tinh(f"{nhan_de or ''} {than}", matchers)

            # Xoá trước rồi ghi lại: từ khoá đổi thì một bài có thể MẤT thuộc tính, và
            # upsert thuần sẽ để lại dòng cũ như thể nó vẫn còn khớp.
            con.execute(f"DELETE FROM {bang} WHERE mention_key = {ph}", [khoa])

            if hits:
                so_bai_co += 1
            for h in hits:
                theo_thuoc_tinh[h.key] = theo_thuoc_tinh.get(h.key, 0) + 1
                con.execute(
                    UPSERT.format(table=bang, ph=", ".join([ph] * COLUMN_COUNT)),
                    [khoa, h.key, " | ".join(h.matched), thoi_diem],
                )

        if hasattr(con, "commit"):
            con.commit()
    finally:
        con.close()

    return KetQua(
        so_bai_xet=len(bai),
        so_bai_co_thuoc_tinh=so_bai_co,
        theo_thuoc_tinh=theo_thuoc_tinh,
    )


def in_ket_qua(kq: KetQua) -> None:
    if kq.so_bai_xet == 0:
        print(
            "Không có bài nào đủ toàn văn để gán thuộc tính. "
            "Chạy `crawler thu-thap` không kèm --nhanh để lấy toàn văn trước."
        )
        return

    ty_le = 100 * kq.so_bai_co_thuoc_tinh / kq.so_bai_xet
    print(f"Xét {kq.so_bai_xet} bài có toàn văn.")
    print(f"  Gắn ít nhất một thuộc tính: {kq.so_bai_co_thuoc_tinh} ({ty_le:.1f}%)")
    for khoa, so in kq.theo_thuoc_tinh.items():
        print(f"    {khoa:16} {so:4} bài  ({100 * so / kq.so_bai_xet:.1f}%)")
