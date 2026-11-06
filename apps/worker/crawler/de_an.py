"""
Bóc số liệu tài chính từ ĐỀ ÁN TUYỂN SINH.

Vì sao tài liệu này quan trọng hơn Biểu 18 cho tầng kinh doanh: Thông tư
08/2022/TT-BGDĐT Điều 11 buộc MỌI trường công bố đề án tuyển sinh theo một bộ mục
đánh số cố định, và ba mục trong đó là thứ không có ở bất kỳ nguồn công khai nào khác:

    1.10    Học phí dự kiến với sinh viên chính quy
    1.14.1  Tổng nguồn thu hợp pháp/năm của trường
    1.14.2  Tổng chi phí đào tạo trung bình 1 sinh viên/năm

Mục 1.10 là chiều GIÁ TRỊ của khung IBMC — nửa còn lại của cặp volume/value mà Biểu 18
không có. Mục 1.14.2 là mẫu số của chi phí trên mỗi người học. Trước module này, trong
toàn bộ kho không có một con số học phí nào của bất kỳ trường nào, kể cả Học viện.

Bốn chỗ dễ sai, đều lấy từ bản đề án 2025 của Học viện Kỹ thuật Mật mã:

  1. pdfminer ngắt dòng GIỮA CÂU. Nhan đề mục và con số của nó thường nằm cách nhau
     hai, ba dòng trống. Phải gộp khoảng trắng trước khi dò, không dò theo từng dòng.
  2. Trong cùng tài liệu còn nhiều số tiền KHÁC không phải học phí — mức học bổng
     "bằng 100% mức học phí", lệ phí xét tuyển. Neo theo nhan đề mục, không quét số
     tiền lớn nhất trang.
  3. Số hiệu văn bản trông y hệt số tiền: "Nghị định số 81/2021/NĐ-CP", "Thông tư
     09/2024". Bắt buộc phải có đơn vị tiền tệ ngay sau số thì mới nhận.
  4. Đơn vị học phí KHÔNG thống nhất giữa các trường: đồng/tín chỉ, đồng/năm,
     đồng/tháng, đồng/học kỳ. Quy đổi sai đơn vị tạo ra sai số gấp hàng chục lần, nên
     module này giữ nguyên cả trị số LẪN đơn vị và để tầng dbt quy đổi — ở đó có số
     tín chỉ toàn khoá để quy đổi cho đúng.
  5. Đơn vị phải nằm NGAY SAU con số, không phải đâu đó trong cùng mục. Bản đề án hệ
     vừa làm vừa học của Học viện có câu "...29 triệu đồng đến 32 triệu đồng/năm..."
     rồi vài dòng sau là "Đợt 1 vào tháng 07/2024" — dò đơn vị trong cả mục thì bắt
     phải chữ "tháng" của cái ngày đó và biến học phí năm thành học phí tháng.
  6. Nhiều trường công bố học phí dạng KHOẢNG: "từ khoảng 29 triệu đồng đến 32 triệu
     đồng/năm tùy theo từng ngành". Lấy mỗi cận dưới rồi đặt cạnh con số đơn của
     trường khác là so lệch — phải giữ cả hai đầu.
  7. Một trường có NHIỀU đề án cùng năm, mỗi hệ đào tạo một bản: chính quy, vừa làm
     vừa học, từ xa. Học phí ba hệ chênh nhau nhiều lần. Không ghi hệ thì hai dòng
     cùng (trường, năm) trở thành trùng khoá, và tệ hơn là đem học phí hệ từ xa so
     với học phí chính quy của trường khác.

Module là hàm thuần trên chuỗi — không tải tệp, không mở PDF — nên test chạy ngoại
tuyến với đúng đoạn văn bản đã trích ở trên.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# Đơn vị học phí, theo thứ tự ưu tiên khi nhiều cụm cùng xuất hiện trong cửa sổ dò.
DON_VI_HOC_PHI = ("tin_chi", "thang", "hoc_ky", "nam")

# Hệ đào tạo, dò theo thứ tự này: cụm hẹp trước cụm rộng, vì "đại học chính quy" và
# "vừa làm vừa học" cùng chứa chữ "học".
_CUM_HE: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("vua_lam_vua_hoc", ("vua lam vua hoc", "vlvh")),
    ("tu_xa", ("tu xa", "dao tao tu xa")),
    ("lien_thong", ("lien thong",)),
    ("chinh_quy", ("chinh quy",)),
)

_CUM_DON_VI: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("tin_chi", ("tin chi",)),
    ("thang", ("thang",)),
    ("hoc_ky", ("hoc ky", "ky hoc", "/ky", "mot ky")),
    (
        "nam",
        (
            "nam hoc",
            "/nam",
            "mot nam",
            "nam",
        ),
    ),
)

# Ngưỡng tỉnh táo. Ngoài khoảng là đọc nhầm sang con số khác, trả None còn hơn trả sai.
NGUONG: dict[str, tuple[int, int]] = {
    "tin_chi": (50_000, 5_000_000),
    "thang": (200_000, 50_000_000),
    "hoc_ky": (1_000_000, 300_000_000),
    "nam": (3_000_000, 500_000_000),
    "chi_phi_binh_quan": (3_000_000, 300_000_000),
    "tong_nguon_thu": (1_000_000_000, 20_000_000_000_000),
}

# Cửa sổ ký tự dò sau nhan đề mục. Đủ để qua phần dẫn giải, chưa chạm mục kế tiếp.
CUA_SO = 600

# Cửa sổ dò ĐƠN VỊ, tính từ ngay sau con số cuối của khoảng. Hẹp có chủ ý — xem bẫy 5.
CUA_SO_DON_VI = 40

# Từ nối giữa hai đầu của một khoảng giá.
_NOI_KHOANG = re.compile(r"^\s*(?:đến|den|-|–|—|tới|toi)\s*$", re.IGNORECASE)

_SO_TIEN = re.compile(
    r"(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)"  # 525.000  |  56.000.000.000  |  10,5
    r"\s*(nghìn|nghin|triệu|trieu|tỷ|ty|tỉ)?"  # bội số bằng chữ, nếu có
    r"\s*(?:VN[DĐ]|VND|đồng|dong|đ\b)",  # BẮT BUỘC có đơn vị tiền tệ
    re.IGNORECASE,
)

_BOI_SO = {
    "nghìn": 1_000,
    "nghin": 1_000,
    "triệu": 1_000_000,
    "trieu": 1_000_000,
    "tỷ": 1_000_000_000,
    "ty": 1_000_000_000,
    "tỉ": 1_000_000_000,
}


@dataclass(frozen=True)
class DeAnFigures:
    """Số bóc được từ một đề án. `None` nghĩa là không tìm thấy, KHÔNG phải bằng 0."""

    hoc_phi: int | None = None
    """Trị số học phí, giữ nguyên theo đơn vị trường công bố."""

    hoc_phi_den: int | None = None
    """Cận trên khi trường công bố học phí theo khoảng ("từ 29 đến 32 triệu/năm")."""

    hoc_phi_don_vi: str | None = None
    """Một trong `DON_VI_HOC_PHI`. Không có đơn vị thì `hoc_phi` cũng vô nghĩa."""

    he_dao_tao: str | None = None
    """`chinh_quy` | `vua_lam_vua_hoc` | `tu_xa` | `lien_thong`. Xem bẫy 7."""

    tong_nguon_thu: int | None = None
    chi_phi_binh_quan: int | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def co_du_lieu(self) -> bool:
        return any(
            x is not None for x in (self.hoc_phi, self.tong_nguon_thu, self.chi_phi_binh_quan)
        )


def _khong_dau(s: str) -> str:
    """Bỏ dấu để dò nhan đề mục — các trường viết hoa/thường và dấu rất tuỳ tiện."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"
    )


def _gop_dong(text: str) -> str:
    """Gộp mọi khoảng trắng thành một dấu cách. Xem ghi chú 1 ở đầu tệp."""
    return re.sub(r"\s+", " ", text)


def _tri_so(m: re.Match[str]) -> int:
    raw, boi = m.group(1), (m.group(2) or "").lower()

    if "." in raw and re.fullmatch(r"\d{1,3}(?:\.\d{3})+", raw):
        gia_tri = float(raw.replace(".", ""))  # 56.000.000.000 → nhóm nghìn
    else:
        gia_tri = float(raw.replace(".", "").replace(",", "."))  # 10,5 → thập phân

    return int(round(gia_tri * _BOI_SO.get(boi, 1)))


def _doc_khoang_tien(doan: str) -> tuple[int, int | None, int] | None:
    """Trả về (cận dưới, cận trên hoặc None, vị trí kết thúc số cuối)."""
    dau = _SO_TIEN.search(doan)
    if not dau:
        return None

    tiep = _SO_TIEN.search(doan, dau.end())
    if tiep and _NOI_KHOANG.fullmatch(doan[dau.end() : tiep.start()]):
        return _tri_so(dau), _tri_so(tiep), tiep.end()

    return _tri_so(dau), None, dau.end()


def _doc_so_tien(doan: str) -> int | None:
    khoang = _doc_khoang_tien(doan)
    return None if khoang is None else khoang[0]


def _tim_muc(text_gop: str, *nhan_de: str) -> str | None:
    """Trả về cửa sổ văn bản ngay sau nhan đề mục khớp đầu tiên."""
    phang = _khong_dau(text_gop)
    for nd in nhan_de:
        vi_tri = phang.find(_khong_dau(nd))
        if vi_tri >= 0:
            return text_gop[vi_tri : vi_tri + CUA_SO]
    return None


def _he_dao_tao(doan: str) -> str | None:
    """Hệ đào tạo mà mức học phí này áp cho. Dò trong chính câu công bố học phí."""
    phang = _khong_dau(doan)
    for ten, cum in _CUM_HE:
        if any(c in phang for c in cum):
            return ten
    return None


def _don_vi_hoc_phi(doan: str) -> str | None:
    phang = _khong_dau(doan)
    for ten, cum in _CUM_DON_VI:
        if any(c in phang for c in cum):
            return ten
    return None


def _trong_nguong(gia_tri: int | None, khoa: str) -> bool:
    if gia_tri is None:
        return False
    thap, cao = NGUONG[khoa]
    return thap <= gia_tri <= cao


def boc_de_an(text: str) -> DeAnFigures:
    """Bóc ba số tài chính từ toàn văn một đề án tuyển sinh."""
    gop = _gop_dong(text)
    canh_bao: list[str] = []

    hoc_phi, hoc_phi_den, don_vi = _boc_hoc_phi(gop, canh_bao)
    # Dò hệ trên cả mục học phí, không chỉ quanh con số: tên hệ đứng ở đầu câu.
    muc_hoc_phi = _tim_muc(gop, "Học phí dự kiến", "Học phí")
    he = _he_dao_tao(muc_hoc_phi) if muc_hoc_phi else None
    tong_thu = _boc_mot_so(
        gop,
        "tong_nguon_thu",
        canh_bao,
        "Tổng nguồn thu hợp pháp",
        "Tổng nguồn thu",
    )
    chi_phi = _boc_mot_so(
        gop,
        "chi_phi_binh_quan",
        canh_bao,
        "Tổng chi phí đào tạo trung bình",
        "chi phí đào tạo trung bình",
    )

    return DeAnFigures(
        hoc_phi=hoc_phi,
        hoc_phi_den=hoc_phi_den,
        hoc_phi_don_vi=don_vi,
        he_dao_tao=he,
        tong_nguon_thu=tong_thu,
        chi_phi_binh_quan=chi_phi,
        warnings=canh_bao,
    )


def _boc_hoc_phi(gop: str, canh_bao: list[str]) -> tuple[int | None, int | None, str | None]:
    doan = _tim_muc(gop, "Học phí dự kiến với sinh viên chính quy", "Học phí dự kiến", "Học phí")
    if doan is None:
        canh_bao.append("Không tìm thấy mục học phí (1.10).")
        return None, None, None

    khoang = _doc_khoang_tien(doan)
    if khoang is None:
        canh_bao.append("Mục học phí không có số tiền kèm đơn vị tiền tệ — có thể là bảng.")
        return None, None, None

    gia_tri, can_tren, ket_thuc = khoang
    # Đơn vị bám vào con số CUỐI của khoảng, và chỉ tìm trong vài chục ký tự kế tiếp.
    don_vi = _don_vi_hoc_phi(doan[ket_thuc : ket_thuc + CUA_SO_DON_VI])
    if don_vi is None:
        # Không biết là mỗi tín chỉ hay mỗi năm thì con số không so sánh được với
        # trường khác. Bỏ cả hai thay vì để tầng sau đoán.
        canh_bao.append(f"Học phí {gia_tri:,} nhưng không xác định được đơn vị — bỏ qua.")
        return None, None, None

    if not _trong_nguong(gia_tri, don_vi):
        thap, cao = NGUONG[don_vi]
        canh_bao.append(
            f"Học phí {gia_tri:,} ngoài khoảng hợp lý {thap:,}–{cao:,} cho đơn vị {don_vi}."
        )
        return None, None, None

    if can_tren is not None:
        if not _trong_nguong(can_tren, don_vi):
            canh_bao.append(f"Cận trên {can_tren:,} ngoài khoảng hợp lý — chỉ giữ cận dưới.")
            can_tren = None
        else:
            canh_bao.append(
                f"Trường công bố học phí theo KHOẢNG {gia_tri:,}–{can_tren:,} tuỳ ngành, "
                "không phải một mức duy nhất."
            )

    return gia_tri, can_tren, don_vi


def _boc_mot_so(gop: str, khoa: str, canh_bao: list[str], *nhan_de: str) -> int | None:
    doan = _tim_muc(gop, *nhan_de)
    if doan is None:
        canh_bao.append(f"Không tìm thấy mục {nhan_de[0]!r}.")
        return None

    gia_tri = _doc_so_tien(doan)
    if not _trong_nguong(gia_tri, khoa):
        if gia_tri is not None:
            thap, cao = NGUONG[khoa]
            canh_bao.append(f"{nhan_de[0]}: {gia_tri:,} ngoài khoảng hợp lý {thap:,}–{cao:,}.")
        else:
            canh_bao.append(f"{nhan_de[0]}: không có số tiền kèm đơn vị tiền tệ.")
        return None

    return gia_tri
