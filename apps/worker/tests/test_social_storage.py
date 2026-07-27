"""Kiểm tra tính idempotent của kho mạng xã hội — chạy trên file DuckDB tạm, không cần mạng.

Trọng tâm: chạy lại job không sinh bản ghi trùng, và các chỉ số tương tác phải được cập
nhật theo thời gian trong khi mốc "nhìn thấy lần đầu" thì không bao giờ đổi.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from crawler.settings import StoreSettings
from social.storage import TABLE, DuckDbStore, SocialMention

THOI_DIEM = datetime(2026, 7, 27, 10, 0, tzinfo=UTC)
SAU_MOT_NGAY = THOI_DIEM + timedelta(days=1)


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
        schema_name="social_raw",
    )
    kho = DuckDbStore(settings)
    yield kho
    kho.close()


def mention(**ghi_de: object) -> SocialMention:
    mac_dinh: dict[str, object] = {
        "mention_key": "khoa-1",
        "platform": "youtube",
        "source_name": "youtube",
        "content_type": "comment",
        "native_id": "UgxABC123",
        "parent_key": "khoa-video",
        "url": "https://www.youtube.com/watch?v=abc&lc=UgxABC123",
        "title": None,
        "body_text": "Trường này học nặng lắm",
        "body_chars": 23,
        "author_ref": "anon:0123456789abcdef",
        "author_is_hashed": True,
        "published_at": THOI_DIEM,
        "like_count": 5,
        "reply_count": 0,
        "view_count": None,
        "matched_keywords": [],
        "discovered_via": "youtube:comment",
        "search_term": None,
        "is_owned": False,
        "first_seen_at": THOI_DIEM,
        "last_seen_at": THOI_DIEM,
    }
    return SocialMention(**{**mac_dinh, **ghi_de})  # type: ignore[arg-type]


def _doc(store: DuckDbStore, cot: str) -> object:
    ket_qua = store._con.execute(
        f"SELECT {cot} FROM {TABLE} WHERE mention_key = 'khoa-1'"
    ).fetchone()
    assert ket_qua is not None
    return ket_qua[0]


def test_ghi_lai_cung_khoa_khong_sinh_ban_ghi_trung(store: DuckDbStore) -> None:
    store.upsert([mention()])
    store.upsert([mention()])
    assert store.count() == 1


def test_luot_thich_tang_thi_cap_nhat(store: DuckDbStore) -> None:
    """Lượt thích của một bình luận tăng theo thời gian. Giữ giá trị cũ là báo cáo sai
    mức độ lan toả của ý kiến đó."""
    store.upsert([mention(like_count=5)])
    store.upsert([mention(like_count=142, last_seen_at=SAU_MOT_NGAY)])
    assert _doc(store, "like_count") == 142


def test_moc_nhin_thay_lan_dau_khong_bao_gio_doi(store: DuckDbStore) -> None:
    """first_seen_at là mốc dựng biểu đồ lượng thảo luận theo thời gian — ghi đè nó thì
    mọi bản ghi cũ dồn hết về ngày chạy job gần nhất."""
    store.upsert([mention()])
    store.upsert([mention(first_seen_at=SAU_MOT_NGAY, last_seen_at=SAU_MOT_NGAY)])
    assert _doc(store, "first_seen_at") == THOI_DIEM
    assert _doc(store, "last_seen_at") == SAU_MOT_NGAY


def test_noi_dung_dai_hon_thi_ghi_de(store: DuckDbStore) -> None:
    """Chủ đề diễn đàn lần đầu chỉ có đoạn trích, lần sau tải được toàn văn."""
    store.upsert([mention(body_text="trích ngắn", body_chars=10)])
    store.upsert([mention(body_text="toàn văn dài hơn nhiều", body_chars=22)])
    assert _doc(store, "body_chars") == 22


def test_noi_dung_ngan_hon_khong_xoa_mat_phan_da_co(store: DuckDbStore) -> None:
    """Lần chạy sau bị Cloudflare chặn, chỉ còn đoạn trích — không được ghi đè toàn văn."""
    store.upsert([mention(body_text="toàn văn dài hơn nhiều", body_chars=22)])
    store.upsert([mention(body_text="trích ngắn", body_chars=10)])
    assert _doc(store, "body_chars") == 22


def test_chi_so_vang_mat_khong_xoa_gia_tri_da_co(store: DuckDbStore) -> None:
    """Tác giả tắt hiển thị lượt thích thì API trả về thiếu trường, không phải trả về 0."""
    store.upsert([mention(like_count=142)])
    store.upsert([mention(like_count=None)])
    assert _doc(store, "like_count") == 142


def test_sua_logic_boc_tach_thi_ban_ghi_cu_duoc_cap_nhat(store: DuckDbStore) -> None:
    """Cột mô tả nguồn là kết quả của logic bóc tách, không phải sự kiện lịch sử.

    Không ghi đè thì kho vĩnh viễn giữ cách hiểu cũ, và phải xoá kho làm lại mới thấy được
    cải tiến — đúng lỗi đã gặp khi chuyển source_name từ "youtube" sang tên kênh thật.
    """
    store.upsert([mention(source_name="youtube", author_ref="anon:cu", author_is_hashed=True)])
    store.upsert(
        [mention(source_name="PTIT Official", author_ref="PTIT Official", author_is_hashed=False)]
    )

    assert _doc(store, "source_name") == "PTIT Official"
    assert _doc(store, "author_ref") == "PTIT Official"
    assert _doc(store, "author_is_hashed") is False


def test_tu_khoa_phat_hien_dau_tien_duoc_giu(store: DuckDbStore) -> None:
    """Truy được vì sao bản ghi này lọt vào kho."""
    store.upsert([mention(search_term="PTIT tuyển sinh")])
    store.upsert([mention(search_term="điểm chuẩn PTIT")])
    assert _doc(store, "search_term") == "PTIT tuyển sinh"


def test_hai_nen_tang_cung_native_id_van_la_hai_ban_ghi(store: DuckDbStore) -> None:
    store.upsert(
        [
            mention(mention_key="khoa-yt", platform="youtube", native_id="abc"),
            mention(mention_key="khoa-rd", platform="reddit", native_id="abc"),
        ]
    )
    assert store.count() == 2


def test_dem_theo_nhom(store: DuckDbStore) -> None:
    store.upsert(
        [
            mention(mention_key="k1", platform="youtube"),
            mention(mention_key="k2", platform="youtube"),
            mention(mention_key="k3", platform="reddit"),
        ]
    )
    assert store.group_count("platform") == [("youtube", 2), ("reddit", 1)]
