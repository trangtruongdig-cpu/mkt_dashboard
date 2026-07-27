"""
Phát hiện tài liệu công khai bắt buộc của nhóm trường đối sánh.

Đây là nguồn dữ liệu quan trọng nhất của cả hệ thống, và cũng là nguồn dễ bị bỏ qua
nhất. Lý do: những con số tưởng như phải xin từ nội bộ Học viện — số nhập học mới, tỷ
lệ nhập học so với chỉ tiêu, tỷ lệ thôi học, tỷ lệ có việc làm — đều đang nằm công khai
trên website của từng trường, vì pháp luật buộc thế:

  · Thông tư 09/2024/TT-BGDĐT (hiệu lực 19/7/2024) — công khai quy mô đào tạo, số nhập
    học mới, số tốt nghiệp, tỷ lệ nhập học so với kế hoạch, tỷ lệ thôi học, tỷ lệ có
    việc làm 12 tháng sau tốt nghiệp. Biểu mẫu 17, 18, 19.
  · Thông tư 08/2022/TT-BGDĐT Điều 11 — đề án tuyển sinh phải công khai kết quả tuyển
    sinh 2 năm gần nhất.

Và vì mọi trường đều phải công khai, ta lấy được số của cả nhóm đối sánh chứ không chỉ
của Học viện — điều mà dữ liệu nội bộ dù có xin được cũng không cho.

Module này chỉ chứa hàm thuần: bóc liên kết, phân loại tài liệu, đoán năm. Phần gọi
mạng nằm ở `edu_docs_job.py` để test chạy được mà không cần Internet.
"""

from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urljoin, urlparse

# Định dạng được coi là tài liệu cần tải về, không phải trang web thường.
DOCUMENT_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx")

# Năm nằm ngoài khoảng này gần như chắc chắn là số hiệu văn bản chứ không phải năm.
MIN_YEAR = 2015
MAX_YEAR = 2035

DocumentKind = Literal[
    "bm17_cam_ket_chat_luong",
    "bm18_chat_luong_thuc_te",
    "bm19_co_so_vat_chat",
    "de_an_tuyen_sinh",
    "bao_cao_thuong_nien",
    "quyet_toan_ngan_sach",
    "du_toan_ngan_sach",
    "khac",
]

DOCUMENT_KIND_LABELS: dict[str, str] = {
    "bm17_cam_ket_chat_luong": "Biểu 17 — cam kết chất lượng đào tạo",
    "bm18_chat_luong_thuc_te": "Biểu 18 — chất lượng đào tạo thực tế",
    "bm19_co_so_vat_chat": "Biểu 19 — điều kiện cơ sở vật chất",
    "de_an_tuyen_sinh": "Đề án tuyển sinh",
    "bao_cao_thuong_nien": "Báo cáo thường niên",
    "quyet_toan_ngan_sach": "Quyết toán ngân sách",
    "du_toan_ngan_sach": "Dự toán ngân sách",
    "khac": "Tài liệu công khai khác",
}

# Biểu 18 là biểu mẫu duy nhất chứa số nhập học mới, tỷ lệ thôi học và tỷ lệ có việc
# làm — tức là nguồn trực tiếp của bốn KPI tầng kinh doanh. Đánh dấu riêng để bước sau
# ưu tiên bóc nó trước.
HIGH_VALUE_KINDS = frozenset({"bm18_chat_luong_thuc_te", "de_an_tuyen_sinh"})

# Nhan đề liên kết đáng đi sâu thêm một tầng. Trang danh mục của PTIT và UIT không đặt
# PDF ngay trên trang, phải mở từng bài mới thấy tệp đính kèm.
_FOLLOW_PATTERNS = (
    "công khai",
    "cong khai",
    "đề án tuyển sinh",
    "de an tuyen sinh",
    "biểu mẫu",
    "thường niên",
    "quyết toán",
    "dự toán",
    "cam kết chất lượng",
    "chất lượng đào tạo",
    "cơ sở vật chất",
)

_KIND_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "bm18_chat_luong_thuc_te",
        ("bm18", "bm_18", "biểu 18", "biểu mẫu 18", "chất lượng đào tạo thực tế"),
    ),
    ("bm17_cam_ket_chat_luong", ("bm17", "bm_17", "biểu 17", "biểu mẫu 17", "cam kết chất lượng")),
    ("bm19_co_so_vat_chat", ("bm19", "bm_19", "biểu 19", "biểu mẫu 19", "cơ sở vật chất", "csvc")),
    ("de_an_tuyen_sinh", ("đề án tuyển sinh", "de an tuyen sinh", "de-an-tuyen-sinh", "dats")),
    ("bao_cao_thuong_nien", ("thường niên", "thuong nien", "thuong-nien")),
    ("quyet_toan_ngan_sach", ("quyết toán", "quyet toan", "quyet-toan")),
    ("du_toan_ngan_sach", ("dự toán", "du toan", "du-toan")),
)


@dataclass(frozen=True)
class Link:
    url: str
    text: str


@dataclass(frozen=True)
class DiscoveredDocument:
    school_key: str
    url: str
    title: str
    kind: str
    year: int | None
    seed_url: str


def _bo_dau(chuoi: str) -> str:
    """Bỏ dấu tiếng Việt để so khớp được cả nhan đề viết không dấu trong tên tệp.

    Dùng chuẩn hoá Unicode thay vì bảng chuyển tự viết tay: bảng viết tay phải liệt kê
    đủ 67 nguyên âm có dấu của tiếng Việt và chỉ cần lệch một ký tự là hỏng toàn bộ.
    `đ` phải xử lý riêng vì nó không phải tổ hợp dấu nên NFD không tách ra được.
    """
    tach = unicodedata.normalize("NFD", chuoi.lower().replace("đ", "d"))
    return "".join(k for k in tach if not unicodedata.combining(k))


def extract_links(page_html: str, base_url: str) -> list[Link]:
    """Bóc mọi liên kết trong trang, đổi về đường dẫn tuyệt đối.

    Dùng biểu thức chính quy thay vì thêm một thư viện phân tích HTML: ở đây chỉ cần
    thẻ `a` với thuộc tính `href`, không cần hiểu cấu trúc cây của trang.
    """
    ket_qua: list[Link] = []
    for the in re.finditer(
        r"<a\b[^>]*?href\s*=\s*[\"']([^\"']+)[\"'][^>]*>(.*?)</a>",
        page_html,
        re.IGNORECASE | re.DOTALL,
    ):
        href = html.unescape(the.group(1)).strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue

        chu = html.unescape(re.sub(r"<[^>]+>", " ", the.group(2)))
        ket_qua.append(Link(url=urljoin(base_url, href), text=re.sub(r"\s+", " ", chu).strip()))
    return ket_qua


def is_document(url: str) -> bool:
    duong_dan = urlparse(url).path.lower()
    return duong_dan.endswith(DOCUMENT_EXTENSIONS)


def is_followable(link: Link, seed_url: str) -> bool:
    """Có đáng mở liên kết này để tìm tệp đính kèm bên trong không.

    Chỉ đi sâu trong cùng tên miền với trang gốc: trang công khai của một trường không
    bao giờ đặt biểu mẫu của mình trên máy chủ của trường khác, và giới hạn này giữ cho
    crawler không lan ra cả Internet.
    """
    if is_document(link.url):
        return False
    if urlparse(link.url).netloc.lower() != urlparse(seed_url).netloc.lower():
        return False
    if link.url.rstrip("/") == seed_url.rstrip("/"):
        return False

    chu = _bo_dau(link.text)
    return any(_bo_dau(mau) in chu for mau in _FOLLOW_PATTERNS)


def classify_kind(url: str, title: str) -> str:
    """Đoán loại tài liệu từ tên tệp và nhan đề liên kết.

    Xét theo thứ tự trong `_KIND_RULES`: biểu 18 đứng trước biểu 17 vì nhan đề dạng
    "cam kết chất lượng đào tạo (BM17)" chứa cả cụm "chất lượng đào tạo".
    """
    van_ban = _bo_dau(f"{urlparse(url).path} {title}")
    for kind, mau in _KIND_RULES:
        if any(_bo_dau(m) in van_ban for m in mau):
            return kind
    return "khac"


def detect_year(url: str, title: str) -> int | None:
    """Đoán năm của tài liệu.

    Với nhan đề dạng "năm học 2023-2024" lấy năm ĐẦU, vì đó là năm học được báo cáo.
    Đường dẫn được xét trước nhan đề: các trường thường xếp tệp vào thư mục theo năm,
    còn nhan đề hay lẫn số hiệu văn bản và ngày ban hành.
    """
    for nguon in (urlparse(url).path, title):
        nam = [int(n) for n in re.findall(r"(?<!\d)(20\d{2})(?!\d)", nguon)]
        hop_le = [n for n in nam if MIN_YEAR <= n <= MAX_YEAR]
        if hop_le:
            return min(hop_le)
    return None


def collect_documents(
    school_key: str,
    seed_url: str,
    page_url: str,
    page_html: str,
) -> tuple[list[DiscoveredDocument], list[Link]]:
    """Từ một trang, trả về (tài liệu tìm được, liên kết đáng đi sâu thêm)."""
    links = extract_links(page_html, page_url)

    tai_lieu = [
        DiscoveredDocument(
            school_key=school_key,
            url=link.url,
            # Nhan đề rỗng thì lấy tên tệp — vẫn hơn là để trống hoàn toàn.
            title=link.text or urlparse(link.url).path.rsplit("/", 1)[-1],
            kind=classify_kind(link.url, link.text),
            year=detect_year(link.url, link.text),
            seed_url=seed_url,
        )
        for link in links
        if is_document(link.url)
    ]

    return tai_lieu, [link for link in links if is_followable(link, seed_url)]
