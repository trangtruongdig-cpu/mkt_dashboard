"""Chuẩn hoá URL và đối chiếu từ khoá thương hiệu.

Tách riêng khỏi phần gọi mạng để kiểm thử được mà không cần Internet.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from .settings import Keyword

# Tham số theo dõi chiến dịch — cùng một bài báo gắn thêm mấy tham số này vẫn là một bài.
# Không lọc chúng đi thì mỗi lần chia sẻ lại sinh ra một bản ghi trùng trong kho.
TRACKING_PARAMS = frozenset(
    {
        "fbclid",
        "gclid",
        "gbraid",
        "wbraid",
        "msclkid",
        "zarsrc",
        "ref",
        "referrer",
        "source",
        "cmpid",
        "campaign",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
    }
)


def canonical_url(url: str) -> str:
    """Rút URL về dạng chuẩn để làm khoá tự nhiên.

    Bỏ tham số theo dõi, bỏ neo (#...), hạ tên miền về chữ thường, bỏ dấu / thừa ở cuối.
    """
    phan = urlparse(url.strip())
    if not phan.scheme or not phan.netloc:
        return url.strip()

    query = urlencode(
        [
            (k, v)
            for k, v in parse_qsl(phan.query, keep_blank_values=True)
            if k.lower() not in TRACKING_PARAMS
        ]
    )
    path = phan.path.rstrip("/") or "/"

    return urlunparse((phan.scheme.lower(), phan.netloc.lower(), path, "", query, ""))


def publisher_from_url(url: str) -> str:
    """Lấy tên miền làm tên báo khi nguồn không nói rõ báo nào."""
    host = urlparse(url).netloc.lower()
    return host.removeprefix("www.")


def mention_key(url: str | None, title: str, publisher: str) -> str:
    """Khoá tự nhiên của một lần nhắc đến.

    Có URL thì băm URL đã chuẩn hoá. Không có URL (trường hợp Google News) thì băm
    tổ hợp báo + tiêu đề — đủ để chạy lại job không sinh bản ghi trùng.
    """
    if url:
        nguyen_lieu = f"url:{canonical_url(url)}"
    else:
        nguyen_lieu = f"title:{publisher.strip().lower()}|{normalize_text(title)}"
    return hashlib.sha256(nguyen_lieu.encode("utf-8")).hexdigest()


def is_owned_source(url: str | None, publisher: str, owned_sources: list[str]) -> bool:
    """Bài này do chính Học viện đăng, hay do báo ngoài đăng?

    Phân biệt được mới tách được earned media (báo ngoài viết) khỏi owned media
    (thông cáo tự đăng trên cổng thông tin của Học viện). Gộp chung là thổi phồng số liệu.
    """
    host = publisher_from_url(url) if url else ""
    ten_bao = normalize_text(publisher)

    for nguon in owned_sources:
        can = normalize_text(nguon)
        if ten_bao == can:
            return True
        # Khớp theo biên tên miền: "ptit.edu.vn" nhận cả "portal.ptit.edu.vn"
        # nhưng không nhận "khongphaiptit.edu.vn".
        if host and (host == can or host.endswith(f".{can}")):
            return True

    return False


def normalize_text(text: str) -> str:
    """Chuẩn hoá để so khớp: hợp nhất cách gõ dấu tiếng Việt, hạ chữ thường, gộp khoảng trắng.

    Giữ nguyên dấu. Bỏ dấu sẽ khiến "Bưu chính" khớp cả "buu chinh" trong URL và gây
    khớp nhầm ở những chỗ không mong muốn.
    """
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text)).strip().lower()


def find_keywords(text: str, keywords: list[Keyword]) -> list[str]:
    """Trả về danh sách từ khoá xuất hiện trong đoạn văn bản, giữ thứ tự khai báo.

    mode="token" dùng cho từ viết tắt ngắn như PTIT — bắt buộc đứng riêng thành một từ,
    nếu không "PTIT" sẽ khớp cả trong những chuỗi ký tự ngẫu nhiên.
    """
    can = normalize_text(text)
    tim_thay: list[str] = []

    for kw in keywords:
        muc_tieu = normalize_text(kw.text)
        if kw.mode == "token":
            khop = (
                re.search(rf"(?<![0-9a-zà-ỹ]){re.escape(muc_tieu)}(?![0-9a-zà-ỹ])", can) is not None
            )
        else:
            khop = muc_tieu in can
        if khop and kw.text not in tim_thay:
            tim_thay.append(kw.text)

    return tim_thay
