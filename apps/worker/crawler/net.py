"""Lớp gọi HTTP dùng chung: tự giới thiệu trung thực và giãn cách theo tên miền.

Cả bước tìm bài lẫn bước bóc toàn văn đều đi qua đây, nên một tên miền chỉ bị gọi
theo đúng một nhịp dù hai bước chạy nối tiếp nhau.
"""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlparse

import feedparser
import requests

from .settings import DOMAIN_DELAY_SECONDS, REQUEST_TIMEOUT_SECONDS, USER_AGENT

_lan_goi_cuoi: dict[str, float] = {}


def cho_den_luot(url: str) -> None:
    """Chặn cho đến khi đủ giãn cách với lần gọi trước tới cùng tên miền."""
    host = urlparse(url).netloc.lower()
    con_lai = DOMAIN_DELAY_SECONDS - (time.monotonic() - _lan_goi_cuoi.get(host, 0.0))
    if con_lai > 0:
        time.sleep(con_lai)
    _lan_goi_cuoi[host] = time.monotonic()


def get(url: str, accept: str = "*/*") -> requests.Response:
    cho_den_luot(url)
    return requests.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": accept},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def get_feed(url: str) -> Any:
    """Tải và phân tích một feed RSS/Atom. Ném lỗi nếu máy chủ trả mã lỗi."""
    phan_hoi = get(url, accept="application/rss+xml, application/xml, text/xml")
    phan_hoi.raise_for_status()
    return feedparser.parse(phan_hoi.content)
