"""
Chuyển dữ liệu đã hút về từ DuckDB sang PostgreSQL.

Chạy một lần, khi vừa dựng xong PostgreSQL. Không phải kéo lại từ Google — dữ liệu
đã nằm sẵn trong file DuckDB, chỉ chuyển chỗ.

Dùng phần mở rộng `postgres` của DuckDB thay vì đọc ra Python rồi ghi vào: nhanh hơn
nhiều lần và không phải tự đoán kiểu cột.

    uv run python scripts/duckdb_to_postgres.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import duckdb  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

WORKER_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(WORKER_ROOT / ".env")
# Mật khẩu PostgreSQL nằm ở .env gốc của Docker Compose, không phải .env của worker.
load_dotenv(WORKER_ROOT.parent.parent / ".env")

LUOC_DO_DICH = "raw"

# Mỗi job hút dữ liệu ghi vào một file DuckDB riêng để chạy song song không tranh khoá.
# Sang PostgreSQL thì gộp tất cả vào một lược đồ `raw` cho dbt đọc một chỗ.
KHO_NGUON: tuple[tuple[str, str, str], ...] = (
    # Job GA4 tự đặt bảng vào lược đồ riêng; các job còn lại ghi thẳng vào `main` mặc
    # định của DuckDB — tên lược đồ chỉ có tác dụng khi kho đích là PostgreSQL.
    (os.getenv("DUCKDB_PATH", ".data/ptit_ga4.duckdb"), "ga4_raw", "ingest sync"),
    (os.getenv("WIKI_DUCKDB_PATH", ".data/ptit_wiki.duckdb"), "main", "ingest wiki-sync"),
    (os.getenv("TRENDS_DUCKDB_PATH", ".data/ptit_trends.duckdb"), "main", "ingest trends-sync"),
    (
        os.getenv("DISCLOSURE_DUCKDB_PATH", ".data/ptit_disclosure.duckdb"),
        "main",
        "crawler cong-khai",
    ),
    (os.getenv("CRAWLER_DUCKDB_PATH", ".data/ptit_news.duckdb"), "main", "crawler thu-thap"),
)


def _chuyen_mot_kho(con: object, duong_dan: Path, luoc_do: str) -> tuple[int, int]:
    """Đính kèm một file DuckDB rồi chép mọi bảng của nó sang PostgreSQL."""
    import duckdb as _duckdb

    assert isinstance(con, _duckdb.DuckDBPyConnection)

    bi_danh = "src"
    con.execute(f"ATTACH '{duong_dan}' AS {bi_danh} (READ_ONLY)")
    try:
        bang = [
            r[0]
            for r in con.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_catalog = ? AND table_schema = ? ORDER BY table_name",
                [bi_danh, luoc_do],
            ).fetchall()
        ]

        tong = 0
        for ten in bang:
            # Ghi đè toàn bộ: khối lượng nhỏ, và nguồn còn hiệu chỉnh vài kỳ gần nhất —
            # nạp lại cả bảng vừa đơn giản vừa luôn khớp.
            # CASCADE vì các view của dbt (`stg__*`) phụ thuộc vào bảng thô. Chúng sẽ
            # được dựng lại ở lần `dbt build` ngay sau đó — luồng chuẩn là nạp lại kho
            # thô rồi chạy dbt, nên mất view tạm thời không sao.
            con.execute(f'DROP TABLE IF EXISTS pg.{LUOC_DO_DICH}."{ten}" CASCADE')
            con.execute(
                f'CREATE TABLE pg.{LUOC_DO_DICH}."{ten}" AS '
                f'SELECT * FROM {bi_danh}."{luoc_do}"."{ten}"'
            )
            ket_qua = con.execute(f'SELECT COUNT(*) FROM pg.{LUOC_DO_DICH}."{ten}"').fetchone()
            so_dong = int(ket_qua[0]) if ket_qua else 0
            tong += so_dong
            print(f"    {ten:<34}{so_dong:>10,} dòng")

        return len(bang), tong
    finally:
        con.execute(f"DETACH {bi_danh}")


def main() -> int:
    chuoi_ket_noi = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'ptit_dashboard')} "
        f"user={os.getenv('POSTGRES_USER', 'ptit')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )

    # Kết nối vào bộ nhớ rồi đính kèm từng file DuckDB một: nhờ vậy chỉ cần một phiên
    # cho tất cả các kho, và không mở file nào ở chế độ ghi.
    con = duckdb.connect()
    con.execute("INSTALL postgres")
    con.execute("LOAD postgres")
    con.execute(f"ATTACH '{chuoi_ket_noi}' AS pg (TYPE postgres)")
    con.execute(f"CREATE SCHEMA IF NOT EXISTS pg.{LUOC_DO_DICH}")

    tong_bang = tong_dong = 0
    bo_qua: list[str] = []

    for duong_dan_tuong_doi, luoc_do, lenh_tao in KHO_NGUON:
        duong_dan = WORKER_ROOT / duong_dan_tuong_doi
        if not duong_dan.exists():
            bo_qua.append(f"{duong_dan.name} (chạy `uv run python -m {lenh_tao}` để tạo)")
            continue

        print(f"  {duong_dan.name} · lược đồ {luoc_do}")
        so_bang, so_dong = _chuyen_mot_kho(con, duong_dan, luoc_do)
        if so_bang == 0:
            print("    (không có bảng nào)")
        tong_bang += so_bang
        tong_dong += so_dong

    con.close()

    if tong_bang == 0:
        print("\nKhông chuyển được bảng nào. Chạy các job hút dữ liệu trước.")
        return 1

    print(f"\nXong. {tong_bang} bảng, {tong_dong:,} dòng đã nằm trong PostgreSQL.")
    if bo_qua:
        print("Bỏ qua vì chưa có dữ liệu: " + "; ".join(bo_qua))
    print("Chạy tiếp `cd dbt && dbt build` để dựng lại các model phụ thuộc.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
