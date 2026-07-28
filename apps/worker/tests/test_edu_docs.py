"""Kiểm tra phần bóc tách tài liệu công khai — chạy ngoại tuyến, không gọi mạng."""

from __future__ import annotations

import pytest

from crawler.edu_docs import (
    DOCUMENT_KIND_LABELS,
    HIGH_VALUE_KINDS,
    Link,
    classify_kind,
    collect_documents,
    detect_year,
    extract_links,
    is_document,
    is_followable,
)

SEED = "https://hust.edu.vn/ba-cong-khai"


def test_boc_lien_ket_va_doi_ve_duong_dan_tuyet_doi() -> None:
    trang = """
    <a href="/uploads/bm18_nam-hoc-2023-2024.pdf">Chất lượng đào tạo thực tế (BM18)</a>
    <a href='https://hust.edu.vn/vi/tin.html'>Tin tức</a>
    <a href="#top">Lên đầu trang</a>
    <a href="javascript:void(0)">Không đi đâu</a>
    """
    links = extract_links(trang, SEED)

    assert [link.url for link in links] == [
        "https://hust.edu.vn/uploads/bm18_nam-hoc-2023-2024.pdf",
        "https://hust.edu.vn/vi/tin.html",
    ], "Phải bỏ neo trong trang và liên kết javascript"
    assert links[0].text == "Chất lượng đào tạo thực tế (BM18)"


def test_boc_lien_ket_lam_sach_the_html_long_trong_nhan_de() -> None:
    """Nhan đề thật hay bọc thêm <strong>, <span> — không lọc thì lọt thẻ vào tiêu đề."""
    links = extract_links(
        '<a href="/a.pdf"><strong>Biểu&nbsp;18</strong> <span>năm 2024</span></a>', SEED
    )
    assert links[0].text == "Biểu 18 năm 2024"


def test_nhan_dien_tai_lieu_theo_duoi_tep() -> None:
    assert is_document("https://x.vn/a/bm18.pdf")
    assert is_document("https://x.vn/a/bieu-mau.XLSX")
    assert is_document("https://x.vn/a/b.pdf?v=2"), "Tham số truy vấn không được làm hỏng nhận diện"
    assert not is_document("https://x.vn/ba-cong-khai")


@pytest.mark.parametrize(
    ("url", "title", "mong_doi"),
    [
        ("/uploads/bm18_thong-tin-chat-luong.pdf", "", "bm18_chat_luong_thuc_te"),
        ("/f.pdf", "Chất lượng đào tạo thực tế (BM18)", "bm18_chat_luong_thuc_te"),
        # Nhan đề của biểu 17 chứa cả cụm "chất lượng đào tạo" — thứ tự luật phải
        # bảo đảm nó không bị nuốt vào biểu 18.
        ("/f.pdf", "Cam kết chất lượng đào tạo (BM17)", "bm17_cam_ket_chat_luong"),
        ("/uploads/bm19_thong-tin-csvc.pdf", "", "bm19_co_so_vat_chat"),
        ("/de-an-tuyen-sinh-2026.pdf", "", "de_an_tuyen_sinh"),
        ("/f.pdf", "Báo cáo thường niên năm 2024", "bao_cao_thuong_nien"),
        ("/f.pdf", "Công khai quyết toán ngân sách nhà nước năm 2024", "quyet_toan_ngan_sach"),
        ("/f.pdf", "Công bố công khai dự toán thu-chi năm 2026", "du_toan_ngan_sach"),
        ("/f.pdf", "Quy chế dân chủ cơ sở", "khac"),
    ],
)
def test_phan_loai_tai_lieu(url: str, title: str, mong_doi: str) -> None:
    assert classify_kind(url, title) == mong_doi


def test_phan_loai_hoat_dong_ca_khi_viet_khong_dau() -> None:
    """Tên tệp trên máy chủ hầu như luôn viết không dấu."""
    assert classify_kind("/uploads/de-an-tuyen-sinh-2025.pdf", "") == "de_an_tuyen_sinh"
    assert classify_kind("/f.pdf", "Cong khai quyet toan ngan sach") == "quyet_toan_ngan_sach"


def test_moi_loai_deu_co_nhan_tieng_viet() -> None:
    for _, mau in [(k, k) for k in DOCUMENT_KIND_LABELS]:
        assert DOCUMENT_KIND_LABELS[mau].strip()
    assert set(DOCUMENT_KIND_LABELS) >= HIGH_VALUE_KINDS


def test_doan_nam_uu_tien_duong_dan_hon_nhan_de() -> None:
    """Thư mục theo năm đáng tin hơn nhan đề, vì nhan đề hay lẫn số hiệu văn bản."""
    nam = detect_year("/uploads/ba-cong-khai/2023/bm18.pdf", "Quyết định 2168 ngày 07/10/2025")
    assert nam == 2023


def test_doan_nam_hoc_lay_nam_dau() -> None:
    assert detect_year("/f.pdf", "Cam kết chất lượng đào tạo năm học 2023-2024") == 2023


def test_doan_nam_bo_qua_so_khong_hop_le() -> None:
    assert detect_year("/f.pdf", "Quyết định số 2168") is None
    assert detect_year("/f.pdf", "Thông tư 09/2024/TT-BGDĐT") == 2024


def test_chi_di_sau_lien_ket_cung_ten_mien_va_dung_chu_de() -> None:
    assert is_followable(Link("https://hust.edu.vn/bm18-2024", "Công khai biểu mẫu"), SEED)
    assert not is_followable(Link("https://facebook.com/x", "Công khai biểu mẫu"), SEED), (
        "Không lan ra ngoài tên miền của trường"
    )
    assert not is_followable(Link("https://hust.edu.vn/tuyen-dung", "Tuyển dụng"), SEED), (
        "Chủ đề không liên quan"
    )
    assert not is_followable(Link("https://hust.edu.vn/a.pdf", "Công khai"), SEED), (
        "Tệp thì tải thẳng, không mở như trang"
    )
    assert not is_followable(Link(SEED, "Ba công khai"), SEED), "Không tự quay lại chính nó"


def test_collect_documents_tra_ve_ca_tai_lieu_va_lien_ket_dang_theo() -> None:
    trang = """
    <a href="/uploads/ba-cong-khai/2023/bm18_chat-luong.pdf">Chất lượng đào tạo thực tế (BM18)</a>
    <a href="/ba-cong-khai/nam-2024">Công khai năm 2024</a>
    <a href="/tuyen-dung">Tuyển dụng</a>
    """
    tai_lieu, dang_theo = collect_documents("hust", SEED, SEED, trang)

    assert len(tai_lieu) == 1
    doc = tai_lieu[0]
    assert doc.school_key == "hust"
    assert doc.kind == "bm18_chat_luong_thuc_te"
    assert doc.year == 2023
    assert doc.seed_url == SEED

    assert [link.text for link in dang_theo] == ["Công khai năm 2024"]


def test_tai_lieu_khong_co_nhan_de_thi_lay_ten_tep() -> None:
    tai_lieu, _ = collect_documents("hust", SEED, SEED, '<a href="/uploads/bm18.pdf"></a>')
    assert tai_lieu[0].title == "bm18.pdf"


def test_nhan_dien_pdf_co_lop_chu() -> None:
    """Kiểm tra thực tế: cùng biểu mẫu của một trường, năm 2022 đánh máy, năm 2023 scan."""
    from crawler.edu_docs_probe import detect_text_layer

    assert detect_text_layer(b"%PDF-1.7\n<< /Type /Page /Resources << /Font << >> >> >>")
    assert not detect_text_layer(b"%PDF-1.7\n<< /Type /XObject /Subtype /Image >>")
    assert not detect_text_layer(b""), "Tệp rỗng không được coi là có chữ"


def test_nhan_dien_de_an_viet_tat() -> None:
    """Tên tệp thật rút gọn đủ kiểu; chỉ khớp cụm đầy đủ là bỏ sót cả PTIT lẫn ACTVN."""
    assert classify_kind("/f/qd_545_noi_dung_de_an_ts__h_2024.pdf", "") == "de_an_tuyen_sinh"
    assert classify_kind("/KMA_De-an-TS-2025-24.02.25.pdf", "") == "de_an_tuyen_sinh"
    assert classify_kind("/de-an-tuyen-sinh-2026.pdf", "") == "de_an_tuyen_sinh"
    assert classify_kind("/f.pdf", "Đề án tuyển sinh năm 2024") == "de_an_tuyen_sinh"


def test_khong_nhan_nham_quyet_dinh_thuong_thanh_de_an() -> None:
    assert classify_kind("/QD-1240.pdf", "File đính kèm: QD 1240") == "khac"
