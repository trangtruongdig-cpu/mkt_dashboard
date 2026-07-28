"""Kiểm tra bộ bóc điểm chuẩn — chạy ngoại tuyến.

HTML mẫu trích từ trang công bố điểm chuẩn 2025 thật của Học viện, giữ nguyên cả bảng
thang quy đổi ở cuối — đó chính là thứ dễ bị lấy nhầm nhất.
"""

from __future__ import annotations

from crawler.scores import extract_tables, parse_page, parse_score, parse_score_table

TRANG_THAT = """
<h2>Điểm chuẩn 2025</h2>
<table>
  <tr><th>TT</th><th>Tên ngành, chương trình</th><th>Mã ngành, chương trình</th>
      <th>Điểm chuẩn trúng tuyển</th><th>Thứ tự nguyện vọng (TTNV) trúng tuyển</th></tr>
  <tr><td>I</td><td>NGÀNH, CHƯƠNG TRÌNH ĐÀO TẠO ĐẠI TRÀ</td><td></td><td></td><td></td></tr>
  <tr><td>1</td><td>Kỹ thuật Điện tử viễn thông</td><td>7520207</td>
      <td>25.10</td><td>TTNV&lt;=2</td></tr>
  <tr><td>2</td><td>Trí tuệ nhân tạo vạn vật (AIoT)</td><td>7520207_ AIoT</td>
      <td>24.87</td><td>TTNV&lt;=2</td></tr>
  <tr><td>3</td><td>Kỹ thuật Điều khiển và tự động hóa</td><td>7520216</td>
      <td>26.19</td><td>TTNV&lt;=6</td></tr>
  <tr><td>6</td><td>Công nghệ thông tin</td><td>7480201</td><td>25.80</td><td>TTNV&lt;=3</td></tr>
</table>

<table>
  <tr><th>TT</th><th>Mức điểm thi tốt nghiệp THPT (thang 30)</th>
      <th>Mức điểm xét tuyển Tài năng (thang 100)</th><th>Mức điểm SAT (thang 1600)</th></tr>
  <tr><td>Khoảng 1</td><td>27.25-30</td><td>85-100</td><td>1450-1600</td></tr>
  <tr><td>Khoảng 2</td><td>25.25-27.25</td><td>80-85</td><td>1350-1450</td></tr>
</table>
"""


def test_boc_duoc_hai_bang_trong_trang() -> None:
    bang = extract_tables(TRANG_THAT)
    assert len(bang) == 2
    assert bang[0][0][0] == "TT"


def test_doc_diem_hop_le() -> None:
    assert parse_score("25.10") == 25.10
    assert parse_score("26,19") == 26.19, "Dấu phẩy thập phân phải chấp nhận"


def test_bo_khoang_diem_cua_bang_quy_doi() -> None:
    """'27.25-30' là một KHOẢNG trong bảng quy đổi, không phải điểm chuẩn của ngành."""
    assert parse_score("27.25-30") is None
    assert parse_score("1450-1600") is None


def test_bo_diem_ngoai_thang_ba_muoi() -> None:
    """Điểm SAT và điểm đánh giá năng lực nằm ngoài thang 30 — lấy vào là sai hoàn toàn."""
    assert parse_score("1450") is None
    assert parse_score("85") is None
    assert parse_score("9.5") is None, "Dưới 10 điểm không phải điểm chuẩn đại học"


def test_bo_o_trong_va_o_khong_phai_so() -> None:
    assert parse_score("") is None
    assert parse_score("TTNV<=2") is None


def test_bang_quy_doi_khong_bi_nhan_la_bang_diem_chuan() -> None:
    """Bảng thứ hai không có cột nào tên 'điểm chuẩn' nên phải bị bỏ hẳn."""
    bang = extract_tables(TRANG_THAT)
    assert parse_score_table(bang[1]) == []


def test_bo_dong_tieu_de_nhom() -> None:
    """Dòng 'I | NGÀNH, CHƯƠNG TRÌNH ĐÀO TẠO ĐẠI TRÀ' không có điểm — không phải lỗi."""
    dong = parse_score_table(extract_tables(TRANG_THAT)[0])
    assert all(d.ten_nganh != "NGÀNH, CHƯƠNG TRÌNH ĐÀO TẠO ĐẠI TRÀ" for d in dong)


def test_boc_dung_toan_trang() -> None:
    dong = parse_page(TRANG_THAT)

    assert len(dong) == 4, "Bốn ngành có điểm; bảng quy đổi phải bị loại hoàn toàn"
    assert {d.diem for d in dong} == {25.10, 24.87, 26.19, 25.80}

    cntt = next(d for d in dong if d.ma_nganh == "7480201")
    assert cntt.ten_nganh == "Công nghệ thông tin"
    assert cntt.diem == 25.80


def test_giu_ma_nganh_de_phan_biet_chuong_trinh() -> None:
    """Cùng ngành Điện tử viễn thông có hai chương trình; gộp theo tên là mất một cái."""
    dong = parse_page(TRANG_THAT)
    ma = [d.ma_nganh for d in dong]

    assert "7520207" in ma
    assert "7520207_ AIoT" in ma
    assert len(set(ma)) == len(ma), "Mã ngành phải là khoá phân biệt"


def test_trang_khong_co_bang_diem_thi_tra_ve_rong() -> None:
    assert parse_page("<p>Chưa công bố điểm chuẩn.</p>") == []
