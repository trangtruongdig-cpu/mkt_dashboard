"""Kiểm tra tính idempotent của kho — chạy trên file DuckDB tạm, không cần mạng."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest

from crawler.settings import StoreSettings
from crawler.storage import TABLE, DuckDbStore, NewsMention

THOI_DIEM = datetime(2026, 7, 27, 10, 0, tzinfo=UTC)


@pytest.fixture
def store(tmp_path: Path) -> Iterator[DuckDbStore]:
    settings = StoreSettings(
        kind="duckdb",
        duckdb_path=tmp_path / "test.duckdb",
        postgres_host="",
        postgres_port=5432,
        postgres_db="",
        postgres_user="",
        postgres_password="",
        schema_name="news_raw",
    )
    kho = DuckDbStore(settings)
    yield kho
    kho.close()


def mention(**ghi_de: object) -> NewsMention:
    mac_dinh: dict[str, object] = {
        "mention_key": "khoa-1",
        "url": "https://vnexpress.net/bai.html",
        "canonical_url": "https://vnexpress.net/bai.html",
        "title": "Điểm chuẩn PTIT 2026",
        "publisher": "vnexpress.net",
        "published_at": THOI_DIEM,
        "discovered_via": "bing_news",
        "search_term": "PTIT tuyển sinh",
        "matched_keywords": ["PTIT"],
        "body_text": "",
        "body_chars": 0,
        "language": "vi",
        "extraction_status": "skipped",
        "is_owned": False,
        "first_seen_at": THOI_DIEM,
        "last_seen_at": THOI_DIEM,
    }
    return NewsMention(**{**mac_dinh, **ghi_de})  # type: ignore[arg-type]


def test_ghi_lai_khong_nhan_doi(store: DuckDbStore) -> None:
    """Yêu cầu bắt buộc với mọi job: chạy hai lần không được sinh bản ghi trùng."""
    store.upsert([mention()])
    store.upsert([mention()])
    assert store.count() == 1


def test_hai_bai_khac_nhau_thi_thanh_hai_dong(store: DuckDbStore) -> None:
    store.upsert([mention(), mention(mention_key="khoa-2", url="https://tuoitre.vn/b.html")])
    assert store.count() == 2


def test_chay_lai_va_duoc_bai_hong_lan_truoc(store: DuckDbStore) -> None:
    """Lần đầu bóc lỗi, lần sau bóc được — kho phải nhận nội dung mới."""
    store.upsert([mention(body_text="", body_chars=0, extraction_status="failed:Timeout")])
    store.upsert([mention(body_text="Nội dung đầy đủ", body_chars=15, extraction_status="ok")])

    dong = store._con.execute(
        f"SELECT body_text, body_chars, extraction_status FROM {TABLE}"
    ).fetchone()
    assert dong == ("Nội dung đầy đủ", 15, "ok")


def test_khong_ghi_de_noi_dung_tot_bang_noi_dung_te(store: DuckDbStore) -> None:
    """Chạy chế độ --nhanh sau khi đã có toàn văn không được xoá mất toàn văn."""
    store.upsert([mention(body_text="Nội dung đầy đủ", body_chars=15, extraction_status="ok")])
    store.upsert([mention(body_text="", body_chars=0, extraction_status="skipped")])

    dong = store._con.execute(f"SELECT body_text, extraction_status FROM {TABLE}").fetchone()
    assert dong == ("Nội dung đầy đủ", "ok")


def test_cap_nhat_last_seen(store: DuckDbStore) -> None:
    """Gặp lại bài cũ phải dời last_seen_at nhưng giữ nguyên first_seen_at."""
    sau = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    store.upsert([mention()])
    store.upsert([mention(first_seen_at=sau, last_seen_at=sau)])

    dong = store._con.execute(f"SELECT first_seen_at, last_seen_at FROM {TABLE}").fetchone()
    assert dong is not None
    assert dong[0] == THOI_DIEM
    assert dong[1] == sau


def test_bo_sung_ngay_dang_con_thieu(store: DuckDbStore) -> None:
    """Bài từ Google News thường không có ngày; lần sau bóc được thì phải điền vào."""
    store.upsert([mention(published_at=None)])
    store.upsert([mention(published_at=THOI_DIEM)])

    dong = store._con.execute(f"SELECT published_at FROM {TABLE}").fetchone()
    assert dong is not None and dong[0] == THOI_DIEM


def test_tu_khoa_luu_duoc_dau_tieng_viet(store: DuckDbStore) -> None:
    store.upsert([mention(matched_keywords=["Học viện Công nghệ Bưu chính Viễn thông"])])
    dong = store._con.execute(f"SELECT matched_keywords FROM {TABLE}").fetchone()
    assert dong is not None and "Bưu chính" in dong[0]


def test_khong_lech_mui_gio(store: DuckDbStore) -> None:
    """Thời điểm đọc ra phải đúng bằng thời điểm ghi vào, bất kể múi giờ của máy chạy.

    Cột kiểu TIMESTAMP (không múi giờ) từng làm lệch 7 tiếng trên máy dev UTC+7.
    """
    store.upsert([mention(published_at=THOI_DIEM)])
    dong = store._con.execute(f"SELECT published_at FROM {TABLE}").fetchone()

    assert dong is not None
    assert dong[0].tzinfo is not None, "phải đọc ra kèm múi giờ"
    assert dong[0] == THOI_DIEM
    assert dong[0].astimezone(UTC).hour == 10


def test_ghi_danh_sach_rong_khong_loi(store: DuckDbStore) -> None:
    store.upsert([])
    assert store.count() == 0


def test_phan_biet_owned_va_earned(store: DuckDbStore) -> None:
    store.upsert(
        [
            mention(mention_key="earned", is_owned=False),
            mention(mention_key="owned", is_owned=True, publisher="ptit.edu.vn"),
        ]
    )
    assert dict(store.group_count("is_owned")) == {"False": 1, "True": 1}


def test_mo_lai_kho_cu_khong_mat_du_lieu(tmp_path: Path) -> None:
    """Thêm cột mới phải chạy được trên kho đã có dữ liệu, không bắt xoá làm lại."""
    settings = StoreSettings(
        kind="duckdb",
        duckdb_path=tmp_path / "cu.duckdb",
        postgres_host="",
        postgres_port=5432,
        postgres_db="",
        postgres_user="",
        postgres_password="",
        schema_name="news_raw",
    )
    dau = DuckDbStore(settings)
    dau.upsert([mention()])
    dau.close()

    sau = DuckDbStore(settings)  # chạy lại DDL + MIGRATIONS trên kho đã có sẵn
    try:
        assert sau.count() == 1
    finally:
        sau.close()
