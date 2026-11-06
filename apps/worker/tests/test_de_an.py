"""Kiểm bộ bóc số tài chính từ đề án tuyển sinh.

Đoạn `THAT_ACTVN` là văn bản THẬT do pdfminer trích từ đề án tuyển sinh 2025 của Học
viện Kỹ thuật Mật mã, giữ nguyên cả cách ngắt dòng giữa câu. Các ca còn lại dựng theo
những cách viết khác đã gặp trong tài liệu cùng loại của trường khác.
"""

from __future__ import annotations

from crawler.de_an import boc_de_an

# Trích nguyên văn, kể cả dòng trống và dấu xuống dòng giữa câu.
THAT_ACTVN = """
1.9. Lệ phí xét tuyển/thi tuyển: Lệ phí xét tuyển /01 nguyện vọng theo mức lệ phí chung

của các trường đại học tham gia xét tuyển trên hệ thống của Bộ Giáo dục và Đào tạo.

1.10. Học phí dự kiến với sinh viên chính quy: lộ trình tăng học phí tối đa cho từng

năm (nếu có).

- Học phí với sinh viên chính quy: 525.000VNĐ/tín chỉ
- Lộ trình tăng học phí tối đa cho từng năm: Theo quy định của Chính phủ cho các trường
công lập tại Nghị định số 81/2021/NĐ-CP ngày 27 tháng 8 năm 2021 của Thủ tướng Chính phủ
ban hành và Nghị định số 97/2023/NĐ-CP ngày 31 tháng 12 năm 2023.

1.12. Các nội dung khác (không trái quy định hiện hành)
Hàng năm Học viện cấp học bổng cho khoảng 10% số sinh viên có thành tích học tập cao

nhất mỗi Khóa, với mức học bổng bằng 100% mức học phí;

1.14. Tài chính
1.14.1 Tổng nguồn thu hợp pháp/năm của trường: Tổng nguồn thu học phí Hệ đào tạo

phục vụ lĩnh vực kinh tế - xã hội của Học viện năm gần nhất là 56.000.000.000VNĐ.

1.14.2 Tổng chi phí đào tạo trung bình 1 sinh viên/năm của năm liền trước năm tuyển sinh:

10.000.000 VNĐ/sinh viên.
"""


def test_boc_dung_ca_ba_so_tu_de_an_that() -> None:
    r = boc_de_an(THAT_ACTVN)

    assert r.hoc_phi == 525_000
    assert r.hoc_phi_don_vi == "tin_chi"
    assert r.tong_nguon_thu == 56_000_000_000
    assert r.chi_phi_binh_quan == 10_000_000
    assert r.warnings == []


def test_khong_doc_nham_so_hieu_nghi_dinh_thanh_tien() -> None:
    """'Nghị định số 81/2021/NĐ-CP' có dạng số nhưng không kèm đơn vị tiền tệ."""
    r = boc_de_an(
        "1.10. Học phí dự kiến với sinh viên chính quy: theo Nghị định số 81/2021/NĐ-CP "
        "ngày 27 tháng 8 năm 2021, chưa công bố mức cụ thể."
    )

    assert r.hoc_phi is None
    assert any("không có số tiền" in c for c in r.warnings)


def test_khong_doc_nham_muc_hoc_bong_thanh_hoc_phi() -> None:
    """Học bổng '100% mức học phí' đứng sau mục học phí — không được lọt vào cửa sổ dò."""
    r = boc_de_an(THAT_ACTVN)

    # 100 không phải một mức học phí; nếu lọt thì nó sẽ bị ngưỡng chặn, nhưng đúng ra
    # phải lấy được 525.000 nằm ngay dưới nhan đề mục.
    assert r.hoc_phi == 525_000


def test_don_vi_moi_nam_doc_duoc() -> None:
    r = boc_de_an(
        "1.10. Học phí dự kiến với sinh viên chính quy: 29.500.000 đồng/năm học, "
        "lộ trình tăng không quá 10% mỗi năm."
    )

    assert r.hoc_phi == 29_500_000
    assert r.hoc_phi_don_vi == "nam"


def test_boi_so_bang_chu_doc_duoc() -> None:
    r = boc_de_an(
        "1.14.1 Tổng nguồn thu hợp pháp/năm của trường: 1.250 tỷ đồng trong năm gần nhất."
    )

    assert r.tong_nguon_thu == 1_250_000_000_000


def test_hoc_phi_ngoai_khoang_hop_ly_thi_bo_chu_khong_tra_bua() -> None:
    """5.000đ/tín chỉ là đọc nhầm sang con số khác, không phải học phí rẻ."""
    r = boc_de_an("1.10. Học phí dự kiến với sinh viên chính quy: 5.000 đồng/tín chỉ.")

    assert r.hoc_phi is None
    assert any("ngoài khoảng hợp lý" in c for c in r.warnings)


def test_khong_ro_don_vi_thi_bo_ca_tri_so() -> None:
    """Không biết mỗi tín chỉ hay mỗi năm thì con số không so sánh được giữa các trường."""
    r = boc_de_an("1.10. Học phí dự kiến với sinh viên chính quy: 525.000 VNĐ.")

    assert r.hoc_phi is None
    assert r.hoc_phi_don_vi is None
    assert any("không xác định được đơn vị" in c for c in r.warnings)


def test_tai_lieu_khong_phai_de_an_thi_bao_thieu_het_ba_muc() -> None:
    r = boc_de_an("Quyết định về việc ban hành quy chế chi tiêu nội bộ năm 2025.")

    assert not r.co_du_lieu
    assert len(r.warnings) == 3


# Nguyên văn từ phụ lục đề án hệ vừa làm vừa học 2024 của Học viện. Hai bẫy trong một
# câu: học phí công bố theo KHOẢNG, và chữ "tháng" của ngày tuyển sinh nằm ngay sau.
THAT_PTIT_VLVH = (
    "Học phí dự kiến với sinh viên; lộ trình tăng học phí tối đa cho từng năm (nếu có) "
    "a) Học phí trình độ đại học hệ vừa làm vừa học năm học 2023-2024: trung bình từ "
    "khoảng 29 triệu đồng đến 32 triệu đồng/năm tùy theo từng ngành học; "
    "b) Lộ trình tăng học phí tối đa cho từng năm: Mức học phí được điều chỉnh theo lộ "
    "trình phù hợp với chất lượng đào tạo và đảm bảo tỷ lệ tăng không quá 15%/năm. "
    "11. Thời gian dự kiến tuyển sinh các đợt trong năm: Đợt 1 vào tháng 07/2024 và "
    "Đợt 2 vào tháng 10/2024"
)


def test_don_vi_lay_theo_so_tien_chu_khong_theo_ca_muc() -> None:
    """Chữ 'tháng' của 'tháng 07/2024' không được biến học phí năm thành học phí tháng."""
    r = boc_de_an(THAT_PTIT_VLVH)

    assert r.hoc_phi_don_vi == "nam"


def test_hoc_phi_cong_bo_theo_khoang_thi_giu_ca_hai_dau() -> None:
    r = boc_de_an(THAT_PTIT_VLVH)

    assert r.hoc_phi == 29_000_000
    assert r.hoc_phi_den == 32_000_000
    assert any("theo KHOẢNG" in c for c in r.warnings)


def test_mot_muc_duy_nhat_thi_khong_co_can_tren() -> None:
    r = boc_de_an(THAT_ACTVN)

    assert r.hoc_phi == 525_000
    assert r.hoc_phi_den is None


def test_nhan_dien_he_dao_tao() -> None:
    """Ba hệ của cùng một trường có học phí chênh nhau nhiều lần — không được gộp."""
    assert boc_de_an(THAT_ACTVN).he_dao_tao == "chinh_quy"
    assert boc_de_an(THAT_PTIT_VLVH).he_dao_tao == "vua_lam_vua_hoc"
    assert (
        boc_de_an(
            "Học phí dự kiến với sinh viên: Học phí trình độ đại học hệ từ xa năm học "
            "2023-2024: trung bình từ khoảng 18 triệu đồng đến 22 triệu đồng/năm."
        ).he_dao_tao
        == "tu_xa"
    )
