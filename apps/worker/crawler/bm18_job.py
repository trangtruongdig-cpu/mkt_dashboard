"""Tải các bản Biểu 18 đọc được bằng máy, bóc số và ghi xuống kho.

Chỉ đụng tới tài liệu đã được `edu_docs_probe` xác nhận có lớp chữ. Bản scan không đi
qua đây — chúng thuộc hàng đợi nhập tay, và cố bóc bằng máy chỉ tạo ra số sai.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import requests

from .bm18 import Bm18Figures, detect_year_from_text, parse_bm18
from .edu_docs_store import disclosure_store_settings
from .net import cho_den_luot
from .settings import REQUEST_TIMEOUT_SECONDS, USER_AGENT

TABLE = "raw_disclosure_figure"

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    doc_url             TEXT PRIMARY KEY,
    school_key          TEXT NOT NULL,
    year                INTEGER,
    doctoral            INTEGER,
    masters             INTEGER,
    undergrad_regular   INTEGER,
    undergrad_second    INTEGER,
    undergrad_part_time INTEGER,
    total_students      INTEGER,
    graduates           INTEGER,
    employment_rate_pct DOUBLE,
    warnings            TEXT NOT NULL,
    extracted_at        TIMESTAMPTZ NOT NULL
)
"""

UPSERT = """
INSERT INTO {table} (
    doc_url, school_key, year, doctoral, masters, undergrad_regular, undergrad_second,
    undergrad_part_time, total_students, graduates, employment_rate_pct, warnings, extracted_at
) VALUES ({ph})
ON CONFLICT (doc_url) DO UPDATE SET
    school_key          = EXCLUDED.school_key,
    year                = EXCLUDED.year,
    doctoral            = EXCLUDED.doctoral,
    masters             = EXCLUDED.masters,
    undergrad_regular   = EXCLUDED.undergrad_regular,
    undergrad_second    = EXCLUDED.undergrad_second,
    undergrad_part_time = EXCLUDED.undergrad_part_time,
    total_students      = EXCLUDED.total_students,
    graduates           = EXCLUDED.graduates,
    employment_rate_pct = EXCLUDED.employment_rate_pct,
    warnings            = EXCLUDED.warnings,
    extracted_at        = EXCLUDED.extracted_at
"""

COLUMN_COUNT = 13

# Biểu mẫu 18 chỉ có vài trang; đọc quá số này là đã mở nhầm tài liệu khác.
MAX_PAGES = 12


@dataclass(frozen=True)
class ExtractResult:
    doc_url: str
    school_key: str
    year: int | None
    figures: Bm18Figures | None
    error: str | None = None


def _tai_van_ban(url: str) -> str:
    """Tải PDF và trả toàn văn. Ném lỗi để nơi gọi ghi lại lý do."""
    cho_den_luot(url)
    phan_hoi = requests.get(
        url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_SECONDS
    )
    phan_hoi.raise_for_status()

    import pdfplumber

    with pdfplumber.open(io.BytesIO(phan_hoi.content)) as pdf:
        return "\n".join((trang.extract_text() or "") for trang in pdf.pages[:MAX_PAGES])


def extract_one(doc_url: str, school_key: str, year: int | None) -> ExtractResult:
    try:
        van_ban = _tai_van_ban(doc_url)
    except Exception as loi:  # noqa: BLE001 — mạng và PDF hỏng đủ kiểu, không được dừng cả mẻ
        return ExtractResult(doc_url, school_key, year, None, f"{type(loi).__name__}: {loi}")

    if not van_ban.strip():
        return ExtractResult(doc_url, school_key, year, None, "PDF không trả về chữ nào")

    # Năm ghi trong chính biểu mẫu đáng tin hơn năm suy từ đường dẫn: các trường hay
    # tải lại tài liệu cũ vào thư mục của năm mới.
    nam_trong_bai = detect_year_from_text(van_ban)
    return ExtractResult(doc_url, school_key, nam_trong_bai or year, parse_bm18(van_ban))


def _mo_ket_noi() -> tuple[Any, str, str]:
    """Trả về (kết nối, tên bảng, ký tự giữ chỗ tham số) — DuckDB dùng `?`, PostgreSQL `%s`."""
    settings = disclosure_store_settings()
    if settings.kind != "duckdb":  # pragma: no cover — chỉ dùng khi đã dựng PostgreSQL
        import psycopg

        con: Any = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )
        with con.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {settings.schema_name}")
            cur.execute(DDL.format(table=f"{settings.schema_name}.{TABLE}"))
        con.commit()
        return con, f"{settings.schema_name}.{TABLE}", "%s"

    import duckdb

    settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(settings.duckdb_path))
    con.execute(DDL.format(table=TABLE))
    return con, TABLE, "?"


def run() -> None:
    """Bóc số từ mọi bản Biểu 18 đã xác nhận có lớp chữ."""
    from .edu_docs_store import open_store

    store = open_store()
    try:
        can_boc = [
            (url, truong, nam)
            for kind, truong, nam, co_chu, url in store.high_value_documents()
            if kind == "bm18_chat_luong_thuc_te" and co_chu is True
        ]
    finally:
        store.close()

    if not can_boc:
        print("Chưa có bản Biểu 18 nào đọc được bằng máy. Chạy `cong-khai-do` trước.")
        return

    print(f"Bóc số từ {len(can_boc)} bản Biểu 18...\n")
    con, bang, ph = _mo_ket_noi()
    thoi_diem = datetime.now(UTC)
    thanh_cong = that_bai = 0

    try:
        for url, truong, nam in can_boc:
            ket_qua = extract_one(url, truong, nam)
            ten_tep = url.rsplit("/", 1)[-1][:48]

            if ket_qua.figures is None:
                that_bai += 1
                print(f"  ✗ {truong:<6} {str(nam or '?'):<6} {ten_tep}\n      {ket_qua.error}")
                continue

            f = ket_qua.figures
            # Ghi năm mà `extract_one` đã chốt (ưu tiên năm trong nội dung), không phải
            # năm suy từ đường dẫn — nếu không thì cả bước sửa ở trên thành vô nghĩa.
            nam_chot = ket_qua.year
            con.execute(
                UPSERT.format(table=bang, ph=", ".join([ph] * COLUMN_COUNT)),
                [
                    url,
                    truong,
                    nam_chot,
                    f.doctoral,
                    f.masters,
                    f.undergrad_regular,
                    f.undergrad_second,
                    f.undergrad_part_time,
                    f.total_students,
                    f.graduates,
                    f.employment_rate_pct,
                    " | ".join(f.warnings),
                    thoi_diem,
                ],
            )
            thanh_cong += 1

            quy_mo = f"{f.total_students:,}".replace(",", ".") if f.total_students else "—"
            viec_lam = f"{f.employment_rate_pct}%" if f.employment_rate_pct else "—"
            print(
                f"  ✓ {truong:<6} {str(nam_chot or '?'):<6} quy mô {quy_mo:>8} · "
                f"tốt nghiệp {f.graduates or '—':>6} · việc làm {viec_lam:>7}  {ten_tep}"
            )
            for canh_bao in f.warnings:
                print(f"      ! {canh_bao}")

        con.commit()
    finally:
        con.close()

    print(f"\nBóc được {thanh_cong} bản, thất bại {that_bai} bản.")
