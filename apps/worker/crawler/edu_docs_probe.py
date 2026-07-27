"""
Dò xem tài liệu công khai có lớp chữ đọc được bằng máy hay là bản scan.

Đây là bước quyết định cách lấy số ra khỏi tài liệu, và phải chạy trước khi viết bất kỳ
bộ bóc bảng nào. Kiểm tra thực tế trên biểu mẫu của Bách khoa Hà Nội:

    bm18 năm học 2022-2023   → 83 đối tượng /Font   → máy đọc được
    bm18 năm học 2023-2024   → 0  đối tượng /Font   → ảnh scan, 24 MB, 62 ảnh

Cùng một biểu mẫu, cùng một trường, hai năm liền nhau mà một bản đánh máy một bản scan.
Nghĩa là không thể chọn "tự động hoàn toàn" hay "nhập tay hoàn toàn" cho cả bộ — phải
biết từng tài liệu thuộc loại nào rồi mới chia việc.

Cách dò: PDF có chữ luôn khai đối tượng `/Font` trong danh mục tài nguyên. Bản scan chỉ
có `/Image`. Chỉ cần đọc phần đầu tệp là đủ kết luận, không phải tải hết — biểu mẫu scan
nặng hàng chục MB.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import requests

from .net import cho_den_luot
from .settings import REQUEST_TIMEOUT_SECONDS, USER_AGENT

# Đọc tối đa ngần này byte đầu tệp. Danh mục tài nguyên của PDF nằm rải rác nhưng phần
# đầu đủ để phân biệt bản đánh máy với bản scan trong mọi mẫu đã thử.
MAX_PROBE_BYTES = 3_000_000


@dataclass(frozen=True)
class ProbeResult:
    url: str
    has_text_layer: bool | None
    """`None` khi không tải được — khác hẳn với `False` nghĩa là đã tải và đúng là scan."""
    note: str


def detect_text_layer(data: bytes) -> bool:
    """Có đối tượng phông chữ nghĩa là có chữ trích xuất được."""
    return bool(re.search(rb"/Font\b", data))


def probe(url: str) -> ProbeResult:
    """Tải phần đầu tài liệu và kết luận. Không ném lỗi — một tệp hỏng không dừng cả mẻ."""
    if not url.lower().split("?")[0].endswith(".pdf"):
        return ProbeResult(url, None, "không phải PDF")

    try:
        cho_den_luot(url)
        with requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SECONDS,
            stream=True,
        ) as phan_hoi:
            if phan_hoi.status_code != 200:
                return ProbeResult(url, None, f"HTTP {phan_hoi.status_code}")
            data = phan_hoi.raw.read(MAX_PROBE_BYTES)
    except requests.RequestException as loi:
        return ProbeResult(url, None, type(loi).__name__)

    if not data.startswith(b"%PDF"):
        return ProbeResult(url, None, "không phải tệp PDF hợp lệ")

    co_chu = detect_text_layer(data)
    return ProbeResult(url, co_chu, "có lớp chữ" if co_chu else "bản scan, cần nhập tay")


def run(gioi_han: int | None = None) -> None:
    """Dò những tài liệu chưa được dò lần nào."""
    from .edu_docs_store import now, open_store

    store = open_store()
    try:
        chua_do = store.unprobed_pdfs()
        if gioi_han is not None:
            chua_do = chua_do[:gioi_han]

        if not chua_do:
            print("Không còn tài liệu nào chưa dò.")
            return

        print(f"Dò {len(chua_do)} tài liệu PDF chưa kiểm...\n")
        co_chu = scan = loi = 0

        for url in chua_do:
            ket_qua = probe(url)
            store.mark_probe(url, ket_qua.has_text_layer, now())

            if ket_qua.has_text_layer is True:
                co_chu += 1
            elif ket_qua.has_text_layer is False:
                scan += 1
            else:
                loi += 1
            print(f"  {ket_qua.note:<28} {url.rsplit('/', 1)[-1][:60]}", flush=True)

        print(f"\nCó lớp chữ: {co_chu} · Bản scan: {scan} · Không tải được: {loi}")
    finally:
        store.close()


def in_ke_hoach() -> None:
    """In danh sách việc: tài liệu nào bóc bằng máy được, tài liệu nào phải nhập tay."""
    from .edu_docs import DOCUMENT_KIND_LABELS, HIGH_VALUE_KINDS
    from .edu_docs_store import open_store

    store = open_store()
    try:
        dong = store.high_value_documents()
    finally:
        store.close()

    if not dong:
        print("Chưa thu được tài liệu giá trị cao nào.")
        return

    print("Tài liệu chứa số liệu cho KPI tầng kinh doanh")
    print(f"(các loại: {', '.join(DOCUMENT_KIND_LABELS[k] for k in sorted(HIGH_VALUE_KINDS))})\n")

    may_doc: list[str] = []
    nhap_tay: list[str] = []
    chua_do: list[str] = []

    for kind, truong, nam, co_chu, url in dong:
        nhan_loai = DOCUMENT_KIND_LABELS.get(kind, kind)[:34]
        ten_tep = url.rsplit("/", 1)[-1][:44]
        muc = f"  {truong:<6} {str(nam or '?'):<6} {nhan_loai:<34} {ten_tep}"
        (may_doc if co_chu else nhap_tay if co_chu is False else chua_do).append(muc)

    for tieu_de, danh_sach in (
        ("BÓC BẰNG MÁY ĐƯỢC", may_doc),
        ("PHẢI NHẬP TAY (bản scan)", nhap_tay),
        ("CHƯA DÒ", chua_do),
    ):
        print(f"{tieu_de} — {len(danh_sach)} tài liệu")
        for muc in danh_sach:
            print(muc)
        print()
