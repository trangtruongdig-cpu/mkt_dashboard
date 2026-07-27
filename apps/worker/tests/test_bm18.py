"""Kiểm tra bộ bóc số Biểu 18.

Văn bản mẫu là bản THẬT, trích nguyên từ biểu mẫu năm học 2022-2023 của Đại học Bách
khoa Hà Nội (`bm18_thong-tin-chat-luong-dao-tao-thuc-te-nam-hoc-2022-2023.pdf`), kể cả
chỗ ngắt dòng lộn xộn do PDF và chỗ trộn dấu phẩy với dấu chấm thập phân. Test viết
trên văn bản bịa sẽ bỏ lọt đúng những chỗ hay hỏng nhất.
"""

from __future__ import annotations

from crawler.bm18 import parse_bm18, parse_int, parse_percent

BM18_THAT = """\
1
Biểu mẫu 18
THÔNG BÁO
Công khai thông tin chất lượng đào tạo thực tế năm học 2022-2023
A. Công khai thông tin về quy mô đào tạo hiện tại
Quy mô sinh viên hiện tại
STT Khối ngành Đại học
Tiến sĩ Thạc sĩ
Chính quy Văn bằng 2 VLVH
Tổng số 162 934 33.561 377 1.428
1 Khối ngành I 10 4 211 0 0
2 Khối ngành II 0 0 0 0 0
3 Khối ngành III 0 38 1.675 0 327
4 Khối ngành IV 24 39 1.300 0 0
5 Khối ngành V 126 814 29.566 305 1.041
6 Khối ngành VI 0 0 0 0 0
7 Khối ngành VII 2 39 809 72 60
B. Công khai thông tin về sinh viên tốt nghiệp và tỷ lệ sinh viên có việc làm sau
01 năm ra trường
Phân loại tốt nghiệp (%) Tỷ lệ SV tốt
Số sinh
nghiệp năm học
viên tốt
2021-2022 có
STT Khối ngành nghiệp
Loại Loại Loại việc làm sau 1
năm học
xuất sắc giỏi khá năm ra trường
2022-2023
(*) (%)
Tổng số 5.146 5,38% 24,25% 62,55% 94.61%
1 Khối ngành I 31 6,45% 32,26% 58,06% 89.47%
2 Khối ngành II - - - - -
3 Khối ngành III 198 4,55% 26,26% 59,09% 94.1%
"""


def test_doc_so_nguyen_kieu_viet_nam() -> None:
    assert parse_int("33.561") == 33561, "Dấu chấm là phân cách hàng nghìn, không phải thập phân"
    assert parse_int("162") == 162
    assert parse_int("0") == 0
    assert parse_int("-") is None
    assert parse_int("Khối") is None


def test_doc_phan_tram_chiu_ca_dau_phay_va_dau_cham() -> None:
    """Biểu mẫu thật trộn hai kiểu ngay trong cùng một dòng."""
    assert parse_percent("5,38%") == 5.38
    assert parse_percent("94.61%") == 94.61
    assert parse_percent("-") is None


def test_boc_du_so_lieu_tu_bieu_mau_that() -> None:
    ket_qua = parse_bm18(BM18_THAT)

    assert ket_qua.doctoral == 162
    assert ket_qua.masters == 934
    assert ket_qua.undergrad_regular == 33_561
    assert ket_qua.undergrad_second == 377
    assert ket_qua.undergrad_part_time == 1_428
    assert ket_qua.total_students == 36_462

    assert ket_qua.graduates == 5_146
    assert ket_qua.employment_rate_pct == 94.61
    assert ket_qua.warnings == []


def test_khong_lay_nham_dong_tong_so_cua_phan_a_cho_phan_b() -> None:
    """Hai phần đều có dòng 'Tổng số'; lấy nhầm thì số tốt nghiệp thành số tiến sĩ."""
    ket_qua = parse_bm18(BM18_THAT)
    assert ket_qua.graduates != ket_qua.doctoral


def test_ty_le_viec_lam_lay_cot_phan_tram_cuoi_cung() -> None:
    """Ba cột trước là xếp loại tốt nghiệp — lấy nhầm thì ra 62,55% thay vì 94,61%."""
    assert parse_bm18(BM18_THAT).employment_rate_pct == 94.61


def test_canh_bao_khi_bo_cuc_cot_doi() -> None:
    """Dưới ba cột thì không còn đủ căn cứ nhận ra thứ tự — không gán cột nào cả."""
    lech = BM18_THAT.replace("Tổng số 162 934 33.561 377 1.428", "Tổng số 162 934")
    ket_qua = parse_bm18(lech)

    assert ket_qua.undergrad_regular is None
    assert any("cột số" in c for c in ket_qua.warnings)


def test_canh_bao_khi_cot_dai_hoc_khong_phai_lon_nhat() -> None:
    """Ràng buộc kiểm chéo: đại học chính quy luôn đông hơn tiến sĩ và thạc sĩ."""
    lech = BM18_THAT.replace(
        "Tổng số 162 934 33.561 377 1.428", "Tổng số 99.999 934 33.561 377 1.428"
    )
    ket_qua = parse_bm18(lech)

    assert any("lớn nhất" in c for c in ket_qua.warnings)


def test_bo_ty_le_viec_lam_vo_ly() -> None:
    """Đọc nhầm sang cột xếp loại sẽ cho ra con số nhỏ bất thường — thà bỏ còn hơn hiện sai."""
    lech = BM18_THAT.replace("62,55% 94.61%", "62,55% 5.38%")
    ket_qua = parse_bm18(lech)

    assert ket_qua.employment_rate_pct is None
    assert any("ngoài khoảng hợp lý" in c for c in ket_qua.warnings)


def test_van_ban_rong_thi_bao_thieu_chu_khong_ngam_tra_khong() -> None:
    ket_qua = parse_bm18("")

    assert ket_qua.total_students is None
    assert ket_qua.graduates is None
    assert len(ket_qua.warnings) == 2


# Bố cục thứ hai, trích nguyên từ biểu mẫu 2023 của Trường ĐH Công nghệ (ĐHQGHN):
# dòng "Tổng số" bỏ trống, số liệu tách theo trình độ, và ba cột xếp loại KHÔNG có dấu %.
BM18_UET = """\
B. Công khai thông tin về sinh viên tốt nghiệp và tỷ lệ sinh viên có việc làm sau 01 năm ra trường
Phân loại tốt nghiệp (%) Tỷ lệ sinh viên tốt
Số
nghiệp có việc
STT Khối ngành sinh viên
Loại Loại Loại làm sau 1 năm ra
tốt nghiệp xuất sắc giỏi khá trường (%)*
Tổng số
1 Khối ngành I
5 Khối ngành V
Đại học 1352 9,17 30,6 54,88 91,56%
Thạc sĩ 68
Tiến sĩ 11
"""


def test_boc_duoc_bo_cuc_tach_theo_trinh_do() -> None:
    """Dòng 'Tổng số' rỗng thì lấy dòng 'Đại học' — nếu không, cả trường mất số liệu."""
    ket_qua = parse_bm18(BM18_UET)

    assert ket_qua.graduates == 1352
    assert ket_qua.employment_rate_pct == 91.56


def test_canh_bao_khi_chi_lay_duoc_bac_dai_hoc() -> None:
    """Gộp con số chỉ có bậc đại học với con số toàn trường của trường khác là so sai mẫu số."""
    ket_qua = parse_bm18(BM18_UET)
    assert any("chỉ tính" in c and "bậc đại học" in c for c in ket_qua.warnings)


def test_bo_cuc_gop_khong_bi_anh_huong_boi_duong_lui() -> None:
    """Bản có dòng 'Tổng số' đầy đủ vẫn phải dùng dòng đó, không rơi sang nhánh dự phòng."""
    ket_qua = parse_bm18(BM18_THAT)
    assert ket_qua.graduates == 5_146
    assert not any("bậc đại học" in c for c in ket_qua.warnings)


# Bố cục thứ ba, trích nguyên từ Biểu 18 năm 2024 của Học viện: phần A chỉ khai ba cột
# (không đào tạo hệ sư phạm), và phần B BỎ TRỐNG ô tỷ lệ việc làm ở dòng tổng.
BM18_PTIT = """\
A. Công khai thông tin về quy mô đào tạo hiện tại
Quy mô sinh viên hiện tại
Tổng số 76 405 12885
1 Khối ngành III 10 151 3273 x x x x x
2 Khối ngành V 66 254 7921 x x x x x
3 Khối ngành VII x x 1691 x x x x x
B. Công khai thông tin về sinh viên tốt nghiệp và tỷ lệ sinh viên có việc làm sau 01 năm
Tổng số 2710 5 203 1538
1 Khối ngành III 744 0 39 489 95.31%
2 Khối ngành V 1664 5 111 824 95.36%
3 Khối ngành VII 302 0 53 225 94.09%
C. Công khai các môn học của từng khóa học, chuyên ngành
"""


def test_chap_nhan_bieu_mau_chi_khai_ba_cot_quy_mo() -> None:
    """Trường không đào tạo hệ sư phạm bỏ trống các cột cuối — vẫn phải lấy được số."""
    ket_qua = parse_bm18(BM18_PTIT)

    assert ket_qua.doctoral == 76
    assert ket_qua.masters == 405
    assert ket_qua.undergrad_regular == 12_885
    assert ket_qua.undergrad_second is None
    assert ket_qua.total_students == 13_366
    assert any("chỉ khai 3 cột" in c for c in ket_qua.warnings)


def test_tinh_ty_le_viec_lam_khi_dong_tong_bo_trong() -> None:
    """Bình quân GIA QUYỀN theo số tốt nghiệp: khối ngành V đông gấp đôi khối III."""
    ket_qua = parse_bm18(BM18_PTIT)

    assert ket_qua.graduates == 2710
    # (744*95.31 + 1664*95.36 + 302*94.09) / 2710
    assert ket_qua.employment_rate_pct == 95.2


def test_noi_ro_ty_le_viec_lam_la_so_tinh_ra() -> None:
    ket_qua = parse_bm18(BM18_PTIT)
    assert any("bình quân gia quyền" in c for c in ket_qua.warnings)


def test_khong_tinh_lai_khi_bieu_mau_da_co_dong_tong() -> None:
    """Bản của Bách khoa có sẵn 94.61% ở dòng tổng — không được thay bằng số tự tính."""
    ket_qua = parse_bm18(BM18_THAT)
    assert ket_qua.employment_rate_pct == 94.61
    assert not any("bình quân gia quyền" in c for c in ket_qua.warnings)


def test_lay_nam_hoc_tu_noi_dung_bieu_mau() -> None:
    """Trường hay tải lại tài liệu cũ vào thư mục năm mới — năm trong bài mới đáng tin."""
    from crawler.bm18 import detect_year_from_text

    assert detect_year_from_text("Công khai ... thực tế năm học 2022-2023") == 2022
    assert detect_year_from_text("nam hoc 2019 – 2020") == 2019
    assert detect_year_from_text("Quyết định số 2168 ngày 07/10/2025") is None
