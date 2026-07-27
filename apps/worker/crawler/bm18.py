"""
Bóc số liệu từ Biểu mẫu 18 — "Công khai thông tin chất lượng đào tạo thực tế".

Đây là biểu mẫu duy nhất trong bộ Ba công khai chứa đủ số liệu cho bốn chỉ số tầng
kinh doanh: quy mô đào tạo, số tốt nghiệp, và tỷ lệ sinh viên có việc làm sau 1 năm.
Vì mọi trường đều buộc phải công khai nó, ta lấy được cả số của nhóm đối sánh.

Cấu trúc thật của biểu mẫu, trích từ bản năm học 2022-2023 của Bách khoa Hà Nội:

    Quy mô sinh viên hiện tại
    STT Khối ngành Đại học
    Tiến sĩ Thạc sĩ
    Chính quy Văn bằng 2 VLVH
    Tổng số 162 934 33.561 377 1.428
    1 Khối ngành I 10 4 211 0 0
    ...
    B. Công khai thông tin về sinh viên tốt nghiệp và tỷ lệ sinh viên có việc làm...
    Tổng số 5.146 5,38% 24,25% 62,55% 94.61%

Hai chỗ dễ sai, đều đã gặp trong dữ liệu thật:

  1. Tiêu đề cột bị PDF cắt thành ba dòng rời rạc nên không dựa vào tiêu đề để biết
     thứ tự cột được. Phải dựa vào thứ tự chuẩn của biểu mẫu, và kiểm lại bằng ràng
     buộc: cột đại học chính quy luôn lớn nhất.
  2. Cách viết số không nhất quán NGAY TRONG MỘT DÒNG: "5,38%" dùng dấu phẩy thập
     phân còn "94.61%" dùng dấu chấm. Bộ đọc số phải chịu được cả hai.

Module này là hàm thuần trên chuỗi văn bản — không tải tệp, không mở PDF, nên test
chạy được ngoại tuyến với đúng văn bản đã trích ở trên.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# Thứ tự cột chuẩn ở phần A của biểu mẫu 18.
COT_QUY_MO = ("doctoral", "masters", "undergrad_regular", "undergrad_second", "undergrad_part_time")

# Trường không đào tạo hệ sư phạm hay văn bằng hai chỉ khai ba cột đầu. Ít hơn ba thì
# không còn đủ để nhận ra thứ tự cột, coi như bố cục lạ.
MIN_COT_QUY_MO = 3

# Tỷ lệ có việc làm nằm ngoài khoảng này gần như chắc chắn là đọc nhầm cột.
MIN_EMPLOYMENT_PCT = 30.0
MAX_EMPLOYMENT_PCT = 100.0

# Năm nằm ngoài khoảng này là số hiệu văn bản chứ không phải năm học.
MIN_YEAR = 2015
MAX_YEAR = 2035


@dataclass(frozen=True)
class Bm18Figures:
    """Số liệu bóc được từ một bản Biểu 18. `None` nghĩa là không tìm thấy, không phải 0."""

    doctoral: int | None = None
    masters: int | None = None
    undergrad_regular: int | None = None
    undergrad_second: int | None = None
    undergrad_part_time: int | None = None
    graduates: int | None = None
    employment_rate_pct: float | None = None
    # Ghi lại mọi chỗ đáng ngờ thay vì im lặng trả số. Một con số sai trên bảng điều
    # khiển nguy hiểm hơn một ô trống, vì nó tạo ra hành động.
    warnings: list[str] = field(default_factory=list)

    @property
    def total_students(self) -> int | None:
        co = [
            v
            for v in (
                self.doctoral,
                self.masters,
                self.undergrad_regular,
                self.undergrad_second,
                self.undergrad_part_time,
            )
            if v is not None
        ]
        return sum(co) if co else None


def _bo_dau(chuoi: str) -> str:
    tach = unicodedata.normalize("NFD", chuoi.lower().replace("đ", "d"))
    return "".join(k for k in tach if not unicodedata.combining(k))


def detect_year_from_text(text: str) -> int | None:
    """Năm học lấy từ CHÍNH NỘI DUNG biểu mẫu, ưu tiên hơn năm suy từ đường dẫn.

    Lý do phải có hàm này: các trường hay tải lại tài liệu cũ vào thư mục của năm mới.
    Đã gặp thật — bản Biểu 18 nằm trong thư mục `/2024/` của Học viện có nội dung trùng
    khít bản năm 2021, và nếu tin vào đường dẫn thì chuỗi số liệu nhiều năm sẽ có hai
    điểm giống hệt nhau ở hai năm khác nhau.

    Với "năm học 2022-2023" lấy năm ĐẦU, vì đó là năm học được báo cáo.
    """
    khop = re.search(r"n[ăa]m\s+h[ọo]c\s+(20\d{2})\s*[-–—]\s*20\d{2}", text, re.IGNORECASE)
    if khop:
        nam = int(khop.group(1))
        return nam if MIN_YEAR <= nam <= MAX_YEAR else None
    return None


def parse_int(chuoi: str) -> int | None:
    """`33.561` → 33561. Dấu chấm trong số nguyên tiếng Việt là phân cách hàng nghìn."""
    sach = chuoi.strip().replace(".", "").replace(",", "").replace(" ", "")
    return int(sach) if sach.isdigit() else None


def parse_percent(chuoi: str) -> float | None:
    """`94.61%` và `5,38%` đều hợp lệ — biểu mẫu thật trộn cả hai kiểu trong một dòng."""
    khop = re.search(r"(\d+(?:[.,]\d+)?)\s*%", chuoi)
    if not khop:
        return None
    try:
        return float(khop.group(1).replace(",", "."))
    except ValueError:  # pragma: no cover — regex đã bảo đảm chuỗi là số
        return None


def _dong_tong_so(text: str, tu_dong: int = 0) -> tuple[int, str] | None:
    """Tìm dòng bắt đầu bằng 'Tổng số' kể từ dòng `tu_dong`. Trả về (chỉ số dòng, nội dung)."""
    dong = text.splitlines()
    for i in range(tu_dong, len(dong)):
        if _bo_dau(dong[i]).strip().startswith("tong so"):
            return i, dong[i]
    return None


def _dong_so_lieu_phan_b(text: str, vi_tri_b: int) -> tuple[str, bool] | None:
    """Dòng chứa số liệu tốt nghiệp. Trả về (nội dung dòng, có phải chỉ bậc đại học).

    Hai bố cục gặp trong thực tế:

      · Bách khoa Hà Nội gộp tất cả vào dòng 'Tổng số':
            Tổng số 5.146 5,38% 24,25% 62,55% 94.61%
      · Trường ĐH Công nghệ để trống dòng 'Tổng số' và tách theo trình độ:
            Tổng số
            ...
            Đại học 1352 9,17 30,6 54,88 91,56%

    Bố cục thứ hai chỉ cho số của bậc đại học, nên nơi gọi phải ghi cảnh báo — gộp
    chung với con số toàn trường của trường khác là so sai mẫu số.
    """
    dong = text.splitlines()

    tong_so = _dong_tong_so(text, tu_dong=vi_tri_b)
    if tong_so is not None and any(parse_int(t) is not None for t in tong_so[1].split()[1:]):
        return tong_so[1], False

    # Dòng 'Tổng số' rỗng: tìm dòng theo trình độ trong phạm vi phần B.
    bat_dau = tong_so[0] if tong_so else vi_tri_b
    for i in range(bat_dau, min(bat_dau + 30, len(dong))):
        sach = _bo_dau(dong[i]).strip()
        if sach.startswith("dai hoc") and any(
            parse_int(t) is not None for t in dong[i].split()[1:]
        ):
            return dong[i], True

    return None


def _binh_quan_gia_quyen(text: str, vi_tri_b: int) -> float | None:
    """Tỷ lệ việc làm toàn trường, tính từ các dòng khối ngành.

    Dùng khi biểu mẫu bỏ trống ô tỷ lệ ở dòng tổng. Mỗi dòng khối ngành có dạng
    `1 Khối ngành III 744 0 39 489 95.31%` — lấy số đầu làm trọng số (số tốt nghiệp)
    và phần trăm cuối làm tỷ lệ. Bình quân KHÔNG có trọng số sẽ sai, vì khối ngành
    lớn nhất có thể đông gấp năm lần khối nhỏ nhất.
    """
    tu_so = 0.0
    mau_so = 0

    for dong in text.splitlines()[vi_tri_b:]:
        sach = _bo_dau(dong).strip()
        if sach.startswith(("c.", "d.", "e.")):  # sang mục khác thì dừng
            break
        if "khoi nganh" not in sach:
            continue

        phan = dong.split()
        ty_le = next((parse_percent(t) for t in reversed(phan) if "%" in t), None)

        # Số đầu dòng là SỐ THỨ TỰ (1, 2, 3...), không phải số tốt nghiệp. Lấy nhầm nó
        # làm trọng số thì mọi khối ngành gần như cân bằng nhau và kết quả sai lệch.
        # Số tốt nghiệp là số nguyên đầu tiên SAU chữ số La Mã của khối ngành.
        vi_tri_la_ma = next(
            (i for i, t in enumerate(phan) if re.fullmatch(r"[IVX]+", t.strip(".,"))), None
        )
        so_tn = (
            next(
                (parse_int(t) for t in phan[vi_tri_la_ma + 1 :] if parse_int(t) is not None),
                None,
            )
            if vi_tri_la_ma is not None
            else None
        )

        if ty_le is None or so_tn is None or so_tn <= 0:
            continue

        tu_so += so_tn * ty_le
        mau_so += so_tn

    return round(tu_so / mau_so, 2) if mau_so > 0 else None


def _vi_tri_phan_b(text: str) -> int | None:
    """Dòng bắt đầu phần B — phần sinh viên tốt nghiệp và tỷ lệ có việc làm.

    Trả `None` chứ không trả 0 khi không tìm thấy: có bản mà phần B nằm ngay dòng đầu
    (biểu mẫu của Trường ĐH Công nghệ bắt đầu thẳng từ mục B), và dùng 0 làm dấu hiệu
    "không tìm thấy" sẽ vứt mất toàn bộ số liệu của những bản đó.
    """
    dong = text.splitlines()
    for i, d in enumerate(dong):
        sach = _bo_dau(d)
        if "sinh vien tot nghiep" in sach and "viec lam" in sach:
            return i
    return None


def parse_bm18(text: str) -> Bm18Figures:
    """Bóc số từ toàn văn một bản Biểu 18."""
    canh_bao: list[str] = []

    # ── Phần A: quy mô đào tạo ────────────────────────────────────────────────
    quy_mo: dict[str, int | None] = dict.fromkeys(COT_QUY_MO)
    vi_tri_b = _vi_tri_phan_b(text)

    dong_a = _dong_tong_so(text)
    if dong_a is None or (vi_tri_b is not None and dong_a[0] >= vi_tri_b):
        canh_bao.append("Không tìm thấy dòng 'Tổng số' của phần quy mô đào tạo.")
    else:
        so: list[int] = [
            gia_tri
            for gia_tri in (parse_int(t) for t in dong_a[1].split()[2:])
            if gia_tri is not None
        ]
        if len(so) < MIN_COT_QUY_MO or len(so) > len(COT_QUY_MO):
            canh_bao.append(
                f"Phần quy mô có {len(so)} cột số, biểu mẫu chuẩn có {len(COT_QUY_MO)} — "
                "bố cục có thể đã đổi, không gán cột."
            )
        else:
            # Trường không đào tạo hệ sư phạm hay văn bằng hai thường bỏ trống các cột
            # cuối (Học viện chỉ khai 3 cột: tiến sĩ, thạc sĩ, đại học chính quy). Thứ
            # tự cột từ trái sang phải là cố định nên gán được N cột đầu.
            # Cập nhật chứ không gán đè: các cột không khai phải giữ nguyên `None`.
            quy_mo.update(zip(COT_QUY_MO[: len(so)], so, strict=True))
            if len(so) < len(COT_QUY_MO):
                thieu = ", ".join(COT_QUY_MO[len(so) :])
                canh_bao.append(
                    f"Biểu mẫu chỉ khai {len(so)} cột quy mô nên thiếu: {thieu}. "
                    "Quy mô tổng vì thế chỉ cộng các bậc có khai."
                )
            # Ràng buộc kiểm lại thứ tự cột: đại học chính quy luôn đông nhất.
            if quy_mo.get("undergrad_regular") != max(so):
                canh_bao.append(
                    "Cột đại học chính quy không phải cột lớn nhất — thứ tự cột có thể đã đổi."
                )

    # ── Phần B: tốt nghiệp và việc làm ────────────────────────────────────────
    tot_nghiep: int | None = None
    viec_lam: float | None = None

    dong_b = _dong_so_lieu_phan_b(text, vi_tri_b) if vi_tri_b is not None else None
    if dong_b is None:
        canh_bao.append("Không tìm thấy dòng 'Tổng số' của phần sinh viên tốt nghiệp.")
    else:
        noi_dung, chi_bac_dai_hoc = dong_b
        if chi_bac_dai_hoc:
            canh_bao.append(
                "Dòng 'Tổng số' bỏ trống nên lấy từ dòng 'Đại học' — số liệu chỉ tính "
                "bậc đại học, không gồm thạc sĩ và tiến sĩ."
            )

        phan = noi_dung.split()
        tot_nghiep = next((parse_int(t) for t in phan[1:] if parse_int(t) is not None), None)
        # Tỷ lệ có việc làm là cột phần trăm CUỐI CÙNG; các cột trước là xếp loại tốt nghiệp.
        ty_le = [parse_percent(t) for t in phan if "%" in t]
        viec_lam = next((v for v in reversed(ty_le) if v is not None), None)

        if viec_lam is None and vi_tri_b is not None:
            # Biểu mẫu của Học viện bỏ trống ô tỷ lệ ở dòng tổng và chỉ ghi theo từng
            # khối ngành. Bình quân gia quyền theo số tốt nghiệp là cách khôi phục
            # đúng con số toàn trường — nhưng phải nói rõ đây là số TÍNH RA, không
            # phải số nhà trường công bố.
            viec_lam = _binh_quan_gia_quyen(text, vi_tri_b)
            if viec_lam is not None:
                canh_bao.append(
                    "Biểu mẫu không công bố tỷ lệ việc làm ở dòng tổng; con số này do "
                    "tính bình quân gia quyền theo số tốt nghiệp của từng khối ngành."
                )

        if viec_lam is not None and not (MIN_EMPLOYMENT_PCT <= viec_lam <= MAX_EMPLOYMENT_PCT):
            canh_bao.append(
                f"Tỷ lệ có việc làm {viec_lam}% nằm ngoài khoảng hợp lý — "
                "nhiều khả năng đọc nhầm cột."
            )
            viec_lam = None

    return Bm18Figures(
        doctoral=quy_mo["doctoral"],
        masters=quy_mo["masters"],
        undergrad_regular=quy_mo["undergrad_regular"],
        undergrad_second=quy_mo["undergrad_second"],
        undergrad_part_time=quy_mo["undergrad_part_time"],
        graduates=tot_nghiep,
        employment_rate_pct=viec_lam,
        warnings=canh_bao,
    )
