"""
Bóc điểm chuẩn trúng tuyển từ trang công bố của các trường.

Điểm chuẩn là thước đo LỰA CHỌN mạnh nhất đo được từ bên ngoài: nó cho biết thí sinh
sẵn sàng đánh đổi bao nhiêu điểm để vào một trường thay vì trường khác. Khác với thị
phần thảo luận (đo mức được nhắc tới), đây là hành vi thật và có hậu quả thật.

Các trường công bố dạng bảng HTML, cấu trúc cột không giống nhau nên module này dò cột
theo TIÊU ĐỀ chứ không theo vị trí.

Ba cạm bẫy trong dữ liệu thật, đều đã xử lý và có test:

  1. Trang điểm chuẩn của Học viện có HAI bảng. Bảng thứ hai là thang quy đổi giữa các
     phương thức xét tuyển, ô của nó là KHOẢNG ("27.25-30") chứ không phải một mức điểm.
     Lấy nhầm bảng đó là sinh ra hàng chục "ngành" không tồn tại.
  2. Có dòng tiêu đề nhóm — "I | NGÀNH, CHƯƠNG TRÌNH ĐÀO TẠO ĐẠI TRÀ" — không có điểm.
  3. Cùng một ngành có nhiều chương trình (đại trà, chất lượng cao, liên kết); mã ngành
     phân biệt chúng nên phải giữ mã, không gộp theo tên.
"""

from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass

# Thang điểm xét tuyển bằng kết quả thi tốt nghiệp là thang 30. Điểm ngoài khoảng này
# gần như chắc chắn là đọc nhầm cột (điểm SAT, điểm đánh giá năng lực thang 100/150).
MIN_SCORE = 10.0
MAX_SCORE = 30.0

# Tiêu đề cột chứa điểm chuẩn. Không dựa vào vị trí cột: mỗi trường xếp một kiểu.
_COT_DIEM = ("diem chuan", "diem trung tuyen", "diem xet tuyen")
_COT_MA_NGANH = ("ma nganh", "ma xet tuyen", "ma chuong trinh")
_COT_TEN_NGANH = ("ten nganh", "nganh, chuong trinh", "ten chuong trinh", "nganh dao tao")


@dataclass(frozen=True)
class ScoreRow:
    ma_nganh: str
    ten_nganh: str
    diem: float


def _bo_dau(chuoi: str) -> str:
    tach = unicodedata.normalize("NFD", chuoi.lower().replace("đ", "d"))
    return "".join(k for k in tach if not unicodedata.combining(k))


def extract_tables(page_html: str) -> list[list[list[str]]]:
    """Bóc mọi bảng HTML thành danh sách dòng, mỗi dòng là danh sách ô đã làm sạch."""
    bang: list[list[list[str]]] = []
    for the_bang in re.findall(r"<table[\s\S]*?</table>", page_html, re.IGNORECASE):
        dong: list[list[str]] = []
        for the_dong in re.findall(r"<tr[\s\S]*?</tr>", the_bang, re.IGNORECASE):
            o = [
                re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m))).strip()
                for m in re.findall(
                    r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", the_dong, re.IGNORECASE
                )
            ]
            if o:
                dong.append(o)
        if dong:
            bang.append(dong)
    return bang


def parse_score(o: str) -> float | None:
    """Một ô điểm. Trả `None` với khoảng điểm, ô trống, hay điểm ngoài thang 30.

    Khoảng như "27.25-30" bị loại có chủ ý: đó là ô của bảng quy đổi phương thức xét
    tuyển, không phải điểm chuẩn của một ngành.
    """
    sach = o.strip().replace(",", ".")
    if not sach or not re.fullmatch(r"\d+(?:\.\d+)?", sach):
        return None
    diem = float(sach)
    return diem if MIN_SCORE <= diem <= MAX_SCORE else None


def _tim_cot(tieu_de: list[str], mau: tuple[str, ...]) -> int | None:
    for i, o in enumerate(tieu_de):
        sach = _bo_dau(o)
        if any(m in sach for m in mau):
            return i
    return None


def parse_score_table(bang: list[list[str]]) -> list[ScoreRow]:
    """Bóc một bảng. Trả danh sách rỗng nếu bảng này không phải bảng điểm chuẩn."""
    if len(bang) < 2:
        return []

    tieu_de = bang[0]
    cot_diem = _tim_cot(tieu_de, _COT_DIEM)
    if cot_diem is None:
        return []

    cot_ma = _tim_cot(tieu_de, _COT_MA_NGANH)
    cot_ten = _tim_cot(tieu_de, _COT_TEN_NGANH)

    ket_qua: list[ScoreRow] = []
    for dong in bang[1:]:
        if cot_diem >= len(dong):
            continue
        diem = parse_score(dong[cot_diem])
        if diem is None:
            # Dòng tiêu đề nhóm hoặc ô khoảng điểm — bỏ qua, không phải lỗi.
            continue

        ma = dong[cot_ma].strip() if cot_ma is not None and cot_ma < len(dong) else ""
        ten = dong[cot_ten].strip() if cot_ten is not None and cot_ten < len(dong) else ""
        if not ma and not ten:
            continue

        ket_qua.append(ScoreRow(ma_nganh=ma, ten_nganh=ten, diem=diem))

    return ket_qua


def parse_page(page_html: str) -> list[ScoreRow]:
    """Bóc mọi bảng điểm chuẩn trong một trang, gộp lại và bỏ trùng theo mã + tên."""
    da_thay: set[tuple[str, str]] = set()
    ket_qua: list[ScoreRow] = []

    for bang in extract_tables(page_html):
        for dong in parse_score_table(bang):
            khoa = (dong.ma_nganh, dong.ten_nganh)
            if khoa in da_thay:
                continue
            da_thay.add(khoa)
            ket_qua.append(dong)

    return ket_qua
