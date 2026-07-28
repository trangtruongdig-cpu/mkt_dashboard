"""Tải trang điểm chuẩn, bóc số và ghi xuống kho. Idempotent theo (trường, năm, mã ngành).

Tách khỏi `scores.py` để phần bóc bảng ở đó test được ngoại tuyến.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

from .edu_docs_store import disclosure_store_settings
from .extract import duoc_phep_tai
from .net import get
from .scores import ScoreRow, parse_page
from .settings import CONFIG_DIR, CrawlerError, read_json

SCORES_PATH = CONFIG_DIR / "admission-scores.json"
TABLE = "raw_admission_score"

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    school_key   TEXT NOT NULL,
    year         INTEGER NOT NULL,
    ma_nganh     TEXT NOT NULL,
    ten_nganh    TEXT NOT NULL,
    diem         DOUBLE PRECISION NOT NULL,
    page_url     TEXT NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (school_key, year, ma_nganh)
)
"""

UPSERT = """
INSERT INTO {table} (school_key, year, ma_nganh, ten_nganh, diem, page_url, collected_at)
VALUES ({ph})
ON CONFLICT (school_key, year, ma_nganh) DO UPDATE SET
    ten_nganh    = EXCLUDED.ten_nganh,
    diem         = EXCLUDED.diem,
    page_url     = EXCLUDED.page_url,
    collected_at = EXCLUDED.collected_at
"""

COLUMN_COUNT = 7


@dataclass(frozen=True)
class ScorePage:
    year: int
    url: str
    note: str = ""


@dataclass(frozen=True)
class ScoreSchool:
    key: str
    pages: list[ScorePage]
    note: str = ""


def load_sources(path: Path | None = None) -> list[ScoreSchool]:
    du_lieu = read_json(path or SCORES_PATH)
    truong = [
        ScoreSchool(
            key=str(m["key"]).strip(),
            note=str(m.get("note", "")).strip(),
            pages=[
                ScorePage(
                    year=int(p["year"]),
                    url=str(p["url"]).strip(),
                    note=str(p.get("note", "")).strip(),
                )
                for p in m.get("pages", [])
            ],
        )
        for m in du_lieu.get("schools", [])
    ]
    if not truong:
        raise CrawlerError(f"{SCORES_PATH} không khai trường nào.")
    return truong


def _mo_ket_noi() -> tuple[Any, str, str]:
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


def _tai_trang(url: str) -> str | None:
    if not duoc_phep_tai(url):
        return None
    try:
        phan_hoi = get(url, accept="text/html,application/xhtml+xml")
        return phan_hoi.text if phan_hoi.status_code == 200 else None
    except requests.RequestException:
        return None


def run() -> None:
    truong = load_sources()
    con, bang, ph = _mo_ket_noi()
    thoi_diem = datetime.now(UTC)
    chua_khai: list[str] = []
    tong = 0

    print(f"Bóc điểm chuẩn · {len(truong)} trường\n")
    try:
        for t in truong:
            if not t.pages:
                chua_khai.append(t.key)
                continue

            for trang in t.pages:
                html_trang = _tai_trang(trang.url)
                if html_trang is None:
                    print(f"  ✗ {t.key:<6} {trang.year}  không tải được trang")
                    continue

                dong: list[ScoreRow] = parse_page(html_trang)
                if not dong:
                    print(f"  ✗ {t.key:<6} {trang.year}  không tìm thấy bảng điểm chuẩn nào")
                    continue

                for d in dong:
                    con.execute(
                        UPSERT.format(table=bang, ph=", ".join([ph] * COLUMN_COUNT)),
                        [t.key, trang.year, d.ma_nganh, d.ten_nganh, d.diem, trang.url, thoi_diem],
                    )
                tong += len(dong)

                diem = [d.diem for d in dong]
                print(
                    f"  ✓ {t.key:<6} {trang.year}  {len(dong):>3} ngành · "
                    f"thấp nhất {min(diem):.2f} · cao nhất {max(diem):.2f} · "
                    f"trung bình {sum(diem) / len(diem):.2f}"
                )

        con.commit()
    finally:
        con.close()

    print(f"\nĐã ghi {tong} dòng điểm chuẩn.")
    if chua_khai:
        print(
            "! Chưa khai trang điểm chuẩn cho: "
            + ", ".join(chua_khai)
            + " — chênh lệch điểm chuẩn đang tính trên nhóm thiếu các trường này."
        )


def in_thong_ke() -> None:
    con, bang, _ = _mo_ket_noi()
    try:
        dong = con.execute(
            f"SELECT school_key, year, count(*), round(avg(diem)::numeric, 2), "  # noqa: S608
            f"min(diem), max(diem) FROM {bang} GROUP BY 1, 2 ORDER BY 2 DESC, 4 DESC"
        ).fetchall()
    finally:
        con.close()

    if not dong:
        print("Kho rỗng — chạy `uv run python -m crawler diem-chuan` trước.")
        return

    tieu_de = (
        f"{'trường':<8}{'năm':<6}{'số ngành':>9}"
        f"{'trung bình':>12}{'thấp nhất':>11}{'cao nhất':>10}"
    )
    print(tieu_de)
    for r in dong:
        print(f"{r[0]:<8}{r[1]:<6}{r[2]:>9}{float(r[3]):>12.2f}{float(r[4]):>11.2f}{float(r[5]):>10.2f}")
