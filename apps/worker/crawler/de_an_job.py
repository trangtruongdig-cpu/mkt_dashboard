"""Tải các đề án tuyển sinh đọc được bằng máy, bóc số tài chính và ghi xuống kho.

Song song với `bm18_job`, khác ở ba điểm:

  - lọc theo `kind == "de_an_tuyen_sinh"` thay vì biểu mẫu 18;
  - đề án dài hơn biểu mẫu nhiều (vài chục trang) nên trần số trang cao hơn;
  - bản scan bị bỏ qua có chủ ý và ĐƯỢC ĐẾM RIÊNG, vì đó là con số phải báo ra: đề án
    tuyển sinh 2024 của chính Học viện là bản scan, pdfminer chỉ trích được 62 ký tự.
    Giấu đi thì người đọc tưởng trường không công bố học phí.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import requests

from .bm18 import detect_year_from_text
from .de_an import DeAnFigures, boc_de_an
from .edu_docs_store import disclosure_store_settings
from .net import cho_den_luot
from .settings import REQUEST_TIMEOUT_SECONDS, USER_AGENT

TABLE = "raw_de_an_figure"

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    doc_url           TEXT PRIMARY KEY,
    school_key        TEXT NOT NULL,
    year              INTEGER,
    hoc_phi           BIGINT,
    hoc_phi_den       BIGINT,
    hoc_phi_don_vi    TEXT,
    he_dao_tao        TEXT,
    tong_nguon_thu    BIGINT,
    chi_phi_binh_quan BIGINT,
    warnings          TEXT NOT NULL,
    extracted_at      TIMESTAMPTZ NOT NULL
)
"""

UPSERT = """
INSERT INTO {table} (
    doc_url, school_key, year, hoc_phi, hoc_phi_den, hoc_phi_don_vi, he_dao_tao,
    tong_nguon_thu, chi_phi_binh_quan, warnings, extracted_at
) VALUES ({ph})
ON CONFLICT (doc_url) DO UPDATE SET
    school_key        = EXCLUDED.school_key,
    year              = EXCLUDED.year,
    hoc_phi           = EXCLUDED.hoc_phi,
    hoc_phi_den       = EXCLUDED.hoc_phi_den,
    hoc_phi_don_vi    = EXCLUDED.hoc_phi_don_vi,
    he_dao_tao        = EXCLUDED.he_dao_tao,
    tong_nguon_thu    = EXCLUDED.tong_nguon_thu,
    chi_phi_binh_quan = EXCLUDED.chi_phi_binh_quan,
    warnings          = EXCLUDED.warnings,
    extracted_at      = EXCLUDED.extracted_at
"""

COLUMN_COUNT = 11

# Đề án tuyển sinh thường 20–60 trang. Quá trần này là đã mở nhầm tài liệu gộp.
MAX_PAGES = 80


@dataclass(frozen=True)
class ExtractResult:
    doc_url: str
    school_key: str
    year: int | None
    figures: DeAnFigures | None
    error: str | None = None


def _tai_van_ban(url: str) -> str:
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

    # Ngưỡng này phân biệt "bản scan" với "PDF hỏng": bản scan vẫn trả vài chục ký tự
    # từ phần chữ ký số hoặc watermark.
    if len(van_ban.strip()) < 500:
        return ExtractResult(
            doc_url,
            school_key,
            year,
            None,
            f"Chỉ trích được {len(van_ban.strip())} ký tự — gần như chắc chắn là bản scan, cần OCR",
        )

    return ExtractResult(
        doc_url, school_key, detect_year_from_text(van_ban) or year, boc_de_an(van_ban)
    )


def _mo_ket_noi() -> tuple[Any, str, str]:
    """Trả về (kết nối, tên bảng, ký tự giữ chỗ) — DuckDB dùng `?`, PostgreSQL `%s`."""
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
    """Bóc số tài chính từ mọi đề án tuyển sinh đã xác nhận có lớp chữ."""
    from .edu_docs_store import open_store

    store = open_store()
    try:
        tat_ca = [
            (url, truong, nam, co_chu)
            for kind, truong, nam, co_chu, url in store.high_value_documents()
            if kind == "de_an_tuyen_sinh"
        ]
    finally:
        store.close()

    can_boc = [(u, t, n) for u, t, n, co_chu in tat_ca if co_chu is True]
    ban_scan = [(u, t, n) for u, t, n, co_chu in tat_ca if co_chu is False]

    if not tat_ca:
        print("Chưa thu được đề án tuyển sinh nào. Chạy `cong-khai` rồi `cong-khai-do` trước.")
        return

    print(
        f"Đề án đã thu: {len(tat_ca)} — đọc được bằng máy {len(can_boc)}, "
        f"bản scan {len(ban_scan)}\n"
    )

    con, bang, ph = _mo_ket_noi()
    thoi_diem = datetime.now(UTC)
    thanh_cong = that_bai = 0

    try:
        for url, truong, nam in can_boc:
            ket_qua = extract_one(url, truong, nam)
            ten_tep = url.rsplit("/", 1)[-1][:48]

            if ket_qua.figures is None or not ket_qua.figures.co_du_lieu:
                that_bai += 1
                ly_do = ket_qua.error or "; ".join(
                    ket_qua.figures.warnings if ket_qua.figures else ["không rõ"]
                )
                print(f"  ✗ {truong:<6} {str(nam or '?'):<6} {ten_tep}\n      {ly_do}")
                continue

            f = ket_qua.figures
            con.execute(
                UPSERT.format(table=bang, ph=", ".join([ph] * COLUMN_COUNT)),
                [
                    url,
                    truong,
                    ket_qua.year,
                    f.hoc_phi,
                    f.hoc_phi_den,
                    f.hoc_phi_don_vi,
                    f.he_dao_tao,
                    f.tong_nguon_thu,
                    f.chi_phi_binh_quan,
                    " | ".join(f.warnings),
                    thoi_diem,
                ],
            )
            thanh_cong += 1
            if f.hoc_phi and f.hoc_phi_den:
                hp = f"{f.hoc_phi:,}–{f.hoc_phi_den:,}/{f.hoc_phi_don_vi}"
            elif f.hoc_phi:
                hp = f"{f.hoc_phi:,}/{f.hoc_phi_don_vi}"
            else:
                hp = "—"
            he = f.he_dao_tao or "?"
            print(f"  ✓ {truong:<6} {str(ket_qua.year or '?'):<6} {he:<16} học phí {hp}")

        if hasattr(con, "commit"):
            con.commit()
    finally:
        con.close()

    print(f"\nGhi được {thanh_cong}, hỏng {that_bai}.")
    if ban_scan:
        # Không gộp vào "hỏng": đây là việc phải làm, không phải lỗi kỹ thuật.
        print(f"\n{len(ban_scan)} đề án là BẢN SCAN, cần OCR hoặc nhập tay:")
        for url, truong, nam in ban_scan:
            print(f"  · {truong:<6} {str(nam or '?'):<6} {url}")
