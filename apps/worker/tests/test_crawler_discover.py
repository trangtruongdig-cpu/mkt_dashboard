"""Kiểm tra phần bóc tách kết quả tìm kiếm — không gọi mạng."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

from crawler.discover import _bo_duoi_ten_bao, _ngay_dang, _url_that_tu_bing

BING_WRAP = (
    "http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=abc123"
    "&url=https%3a%2f%2fvietnamnet.vn%2fbai-viet.html&c=1&mkt=vi-vn"
)


def test_boc_url_that_khoi_link_bing() -> None:
    assert _url_that_tu_bing(BING_WRAP) == "https://vietnamnet.vn/bai-viet.html"


def test_link_truc_tiep_giu_nguyen() -> None:
    assert _url_that_tu_bing("https://tuoitre.vn/bai.htm") == "https://tuoitre.vn/bai.htm"


def test_link_bing_khong_boc_duoc_thi_bo() -> None:
    """Thà không có URL còn hơn ghi vào kho một địa chỉ dẫn về trang Bing."""
    assert _url_that_tu_bing("http://www.bing.com/news/apiclick.aspx?ref=FexRss") is None


def test_link_rong_thi_bo() -> None:
    assert _url_that_tu_bing("") is None


def test_bo_ten_bao_o_cuoi_tieu_de() -> None:
    """Google News gắn " - Tên báo" vào cuối mọi tiêu đề."""
    assert _bo_duoi_ten_bao("Điểm sàn PTIT 2026 - Báo VietNamNet", "Báo VietNamNet") == (
        "Điểm sàn PTIT 2026"
    )


def test_khong_cat_nham_khi_tieu_de_khong_co_duoi() -> None:
    assert _bo_duoi_ten_bao("Điểm sàn PTIT 2026", "Báo VietNamNet") == "Điểm sàn PTIT 2026"


def test_khong_cat_khi_khong_biet_ten_bao() -> None:
    assert _bo_duoi_ten_bao("Tin - abc", "") == "Tin - abc"


def test_ngay_dang_gan_nhan_utc() -> None:
    """feedparser trả struct_time theo UTC — thiếu nhãn múi giờ là dữ liệu lệch giờ."""
    entry = SimpleNamespace(published_parsed=(2026, 7, 14, 7, 0, 0, 1, 195, 0))
    assert _ngay_dang(entry) == datetime(2026, 7, 14, 7, 0, tzinfo=UTC)


def test_dung_updated_khi_thieu_published() -> None:
    entry = SimpleNamespace(published_parsed=None, updated_parsed=(2026, 1, 2, 3, 4, 5, 0, 0, 0))
    assert _ngay_dang(entry) == datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)


def test_khong_co_ngay_thi_tra_none() -> None:
    assert _ngay_dang(SimpleNamespace()) is None
