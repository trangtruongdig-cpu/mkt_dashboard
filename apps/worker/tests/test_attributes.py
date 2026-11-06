"""Kiểm bước gán thuộc tính thương hiệu cho tin bài.

Dùng chính `config/brand-attributes.json` của dự án chứ không dựng bộ từ khoá riêng:
file đó là thứ sẽ chạy thật, và test phải đổ nếu ai sửa nó hỏng.
"""

from __future__ import annotations

import json

import pytest

from crawler.settings import CrawlerError
from nlp.attributes import AttributeMatchers, gan_thuoc_tinh


@pytest.fixture(scope="module")
def matchers() -> AttributeMatchers:
    return AttributeMatchers.load()


def test_ba_thuoc_tinh_dung_nhu_muc_tieu_com_attributes(matchers: AttributeMatchers) -> None:
    """Ba thuộc tính này là cam kết đã tuyên bố, không phải lựa chọn kỹ thuật."""
    assert matchers.keys == ["national_key", "industry_link", "employability"]


@pytest.mark.parametrize(
    ("van_ban", "mong_doi"),
    [
        ("Học viện là trường trọng điểm quốc gia về công nghệ thông tin.", "national_key"),
        ("Lễ ký kết hợp tác với doanh nghiệp và tài trợ học bổng.", "industry_link"),
        ("Tỷ lệ có việc làm sau tốt nghiệp đạt 95%.", "employability"),
    ],
)
def test_nhan_dien_tung_thuoc_tinh(
    matchers: AttributeMatchers, van_ban: str, mong_doi: str
) -> None:
    assert [h.key for h in gan_thuoc_tinh(van_ban, matchers)] == [mong_doi]


def test_bai_khong_noi_ve_thuoc_tinh_nao_thi_khong_gan_bua(
    matchers: AttributeMatchers,
) -> None:
    assert gan_thuoc_tinh("Thông báo lịch nghỉ Tết Nguyên đán của Học viện.", matchers) == []


def test_mot_bai_gan_duoc_nhieu_thuoc_tinh(matchers: AttributeMatchers) -> None:
    """Thuộc tính không loại trừ nhau — một bài ký kết hợp tác có thể nói cả việc làm."""
    hits = gan_thuoc_tinh(
        "Trường trọng điểm quốc gia ký kết hợp tác với doanh nghiệp, cam kết "
        "cơ hội việc làm cho sinh viên.",
        matchers,
    )

    assert {h.key for h in hits} == {"national_key", "industry_link", "employability"}


def test_tra_ve_dung_cum_da_khop_de_tra_lai_duoc(matchers: AttributeMatchers) -> None:
    """Con số lên bảng là tỷ lệ phần trăm; phải chỉ ra được cụm chữ khi có người hỏi."""
    hits = gan_thuoc_tinh("Mức lương khởi điểm của sinh viên ra trường khá cao.", matchers)

    assert len(hits) == 1
    assert "lương khởi điểm" in hits[0].matched


def test_khong_phan_biet_dau_va_chu_hoa(matchers: AttributeMatchers) -> None:
    assert [h.key for h in gan_thuoc_tinh("TRƯỜNG TRỌNG ĐIỂM QUỐC GIA", matchers)] == [
        "national_key"
    ]


def test_thuoc_tinh_khong_co_tu_khoa_nao_thi_bao_loi(tmp_path) -> None:  # type: ignore[no-untyped-def]
    """Thuộc tính rỗng sẽ không bao giờ khớp — im lặng cho ra tỷ lệ 0% là tệ nhất."""
    p = tmp_path / "attrs.json"
    p.write_text(
        json.dumps({"attributes": [{"key": "a", "label": "A", "keywords": []}]}),
        encoding="utf-8",
    )

    with pytest.raises(CrawlerError, match="không có từ khoá"):
        AttributeMatchers.load(p)


def test_mode_la_gi_do_khac_thi_bao_loi(tmp_path) -> None:  # type: ignore[no-untyped-def]
    p = tmp_path / "attrs.json"
    p.write_text(
        json.dumps(
            {
                "attributes": [
                    {"key": "a", "label": "A", "keywords": [{"text": "x", "mode": "regex"}]}
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(CrawlerError, match="substring"):
        AttributeMatchers.load(p)
