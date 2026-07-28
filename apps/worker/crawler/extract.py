"""Bóc toàn văn bài báo bằng news-please, có kiểm tra robots.txt trước khi tải.

news-please (Apache-2.0) tự nhận diện phần thân bài, tác giả và ngày đăng cho hàng nghìn
trang tin mà không cần viết quy tắc riêng cho từng báo.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse, urlunparse
from urllib.robotparser import RobotFileParser

import requests

from .net import cho_den_luot, get
from .settings import REQUEST_TIMEOUT_SECONDS, USER_AGENT

# news-please và scrapy in rất nhiều dòng cảnh báo cho mỗi bài. Tắt bớt để nhật ký còn đọc được.
for _ten in ("newsplease", "newspaper", "scrapy", "urllib3", "readability", "trafilatura"):
    logging.getLogger(_ten).setLevel(logging.ERROR)

# Bài quá ngắn thì phần bóc tách gần như chắc chắn đã lấy nhầm menu hoặc chân trang
# thay vì nội dung bài viết.
MIN_BODY_CHARS = 200

_robots_cache: dict[str, RobotFileParser | None] = {}


@dataclass(frozen=True)
class Article:
    body_text: str
    language: str | None
    published_at: datetime | None
    status: str


def _robots(url: str) -> RobotFileParser | None:
    """Nạp và nhớ robots.txt theo tên miền. Trả về None nếu không lấy được."""
    phan = urlparse(url)
    goc = f"{phan.scheme}://{phan.netloc}"
    if goc in _robots_cache:
        return _robots_cache[goc]

    parser: RobotFileParser | None = RobotFileParser()
    try:
        phan_hoi = get(urlunparse((phan.scheme, phan.netloc, "/robots.txt", "", "", "")))
        if phan_hoi.status_code == 200:
            assert parser is not None
            parser.parse(phan_hoi.text.splitlines())
        else:
            # Không có robots.txt nghĩa là không cấm gì.
            parser = None
    except requests.RequestException:
        parser = None

    _robots_cache[goc] = parser
    return parser


# Tên tác nhân mà news-please tự xưng. Phải kiểm robots.txt theo CẢ tên này, không chỉ
# theo user-agent của dự án.
#
# VnExpress cấm đích danh trong https://vnexpress.net/robots.txt (dòng 36–37):
#
#     User-agent: news-please
#     Disallow: /
#
# trong khi `User-agent: *` của cùng file lại `Allow: /`. Chỉ kiểm bằng user-agent của
# dự án thì phép kiểm luôn nói "được phép", rồi news-please vẫn đi lấy bài — đúng thứ
# toà soạn đã nói rõ là không muốn. Ai là người đi lấy mới là điều quan trọng, không
# phải chuỗi ký tự mình khai.
NEWSPLEASE_AGENT = "news-please"


def duoc_phep_tai(url: str, agent: str = USER_AGENT) -> bool:
    """Robots.txt có cho phép `agent` lấy đường dẫn này không."""
    parser = _robots(url)
    return True if parser is None else parser.can_fetch(agent, url)


def duoc_phep_boc_toan_van(url: str) -> bool:
    """Có được dùng news-please bóc toàn văn bài này không.

    Phải thoả CẢ HAI: user-agent của dự án được phép, và news-please cũng được phép.
    Đổi chuỗi user-agent để lách một lệnh cấm nêu đích danh công cụ là lách luật chứ
    không phải tuân thủ — và đây là hồ sơ nghiệm thu nhà nước.
    """
    return duoc_phep_tai(url) and duoc_phep_tai(url, NEWSPLEASE_AGENT)


def _ngay_dang(gia_tri: Any) -> datetime | None:
    if not isinstance(gia_tri, datetime):
        return None
    return gia_tri if gia_tri.tzinfo else gia_tri.replace(tzinfo=UTC)


def fetch_article(url: str) -> Article:
    """Tải và bóc một bài báo. Không ném lỗi — thất bại thì ghi lại trạng thái.

    Một bài hỏng không được làm dừng cả mẻ đang chạy.
    """
    if not duoc_phep_boc_toan_van(url):
        return Article("", None, None, "robots_disallowed")

    try:
        cho_den_luot(url)
        from newsplease import NewsPlease

        bai = NewsPlease.from_url(url, request_args={"timeout": REQUEST_TIMEOUT_SECONDS})
    except Exception as loi:  # noqa: BLE001 — news-please ném đủ loại lỗi mạng và phân tích
        return Article("", None, None, f"failed:{type(loi).__name__}")

    if bai is None:
        return Article("", None, None, "failed:empty")

    body = (getattr(bai, "maintext", None) or "").strip()
    trang_thai = "ok" if len(body) >= MIN_BODY_CHARS else "too_short"

    return Article(
        body_text=body,
        language=getattr(bai, "language", None),
        published_at=_ngay_dang(getattr(bai, "date_publish", None)),
        status=trang_thai,
    )
