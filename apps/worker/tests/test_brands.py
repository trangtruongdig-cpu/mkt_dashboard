"""Kiểm tra việc gán nhãn thương hiệu cho tin bài — chạy ngoại tuyến."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from crawler.brands import US_BRAND_KEY, BrandMatchers, tag_brands
from crawler.settings import CrawlerError


def test_nap_du_sau_thuong_hieu() -> None:
    matchers = BrandMatchers.load()

    assert len(matchers.brands) == 6, "Thiếu một trường là mẫu số thị phần bị lệch"
    assert matchers.brands[0].key == US_BRAND_KEY, "Học viện phải đứng đầu danh sách"
    assert all(b.match_keywords for b in matchers.brands)


def test_khong_gan_nham_uit_cho_bai_noi_ve_nganh_cong_nghe_thong_tin() -> None:
    """Cạm bẫy đã gặp thật: 33/479 bài chứa cụm 'Công nghệ Thông tin' nhưng nói về
    ngành học của Học viện, không nói về trường UIT."""
    bai = (
        "Học viện Công nghệ Bưu chính Viễn thông tuyển sinh ngành Công nghệ Thông tin "
        "với 500 chỉ tiêu trong năm 2026."
    )
    nhan = tag_brands(bai, BrandMatchers.load())

    assert nhan == [US_BRAND_KEY]
    assert "uit" not in nhan


def test_gan_dung_uit_khi_nhac_ten_truong_day_du() -> None:
    bai = "Trường Đại học Công nghệ Thông tin, Đại học Quốc gia TP.HCM công bố điểm chuẩn."
    assert "uit" in tag_brands(bai, BrandMatchers.load())


def test_ten_viet_tat_phai_dung_rieng_thanh_mot_tu() -> None:
    """'KMA' để chế độ substring sẽ khớp vào giữa từ khác, ví dụ trong một mã sản phẩm."""
    matchers = BrandMatchers.load()

    assert "actvn" in tag_brands("Điểm chuẩn KMA năm nay tăng nhẹ.", matchers)
    assert "actvn" not in tag_brands("Mã đơn hàng XKMAZ đã được xử lý.", matchers)


def test_mot_bai_nhac_nhieu_truong_thi_gan_nhieu_nhan() -> None:
    """Bài so sánh điểm chuẩn nhắc cả nhóm — ép về một nhãn là tự bịa ra bài thuộc về ai."""
    bai = (
        "So sánh điểm chuẩn: Đại học Bách khoa Hà Nội 26,5; "
        "Học viện Công nghệ Bưu chính Viễn thông 26,2; Trường Đại học FPT xét học bạ."
    )
    nhan = tag_brands(bai, BrandMatchers.load())

    assert set(nhan) == {US_BRAND_KEY, "hust", "fpt"}


def test_bai_khong_nhac_truong_nao_thi_khong_gan_nhan() -> None:
    assert tag_brands("Thời tiết Hà Nội hôm nay có mưa rào.", BrandMatchers.load()) == []


def test_tu_khoa_tim_kiem_phu_ca_nhom() -> None:
    """Không có từ khoá của trường đối sánh thì kho chỉ có bài về Học viện."""
    matchers = BrandMatchers.load()
    terms = " ".join(matchers.search_terms())

    for ten in ("Bách khoa", "FPT", "Mật mã"):
        assert ten in terms, f"Thiếu từ khoá tìm kiếm cho {ten}"


def test_bao_loi_khi_mot_thuong_hieu_khong_co_tu_khoa(tmp_path: Path) -> None:
    duong_dan = tmp_path / "kw.json"
    duong_dan.write_text(
        json.dumps(
            {
                "search_terms": ["a"],
                "match_keywords": [{"text": "Học viện", "mode": "substring"}],
                "competitors": [{"key": "hust", "label": "HUST", "match_keywords": []}],
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(CrawlerError, match="match_keywords"):
        BrandMatchers.load(duong_dan)
