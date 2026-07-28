"""Kiểm việc tuân thủ robots.txt khi bóc toàn văn.

Ra đời từ một phát hiện thật: VnExpress cấm đích danh `news-please` trong robots.txt,
trong khi `User-agent: *` của cùng file lại cho phép. Phép kiểm cũ chỉ hỏi robots.txt
theo user-agent của dự án nên luôn trả lời "được phép" — rồi news-please vẫn đi lấy bài.
"""

from __future__ import annotations

from urllib.robotparser import RobotFileParser

import pytest

from crawler import extract
from crawler.settings import USER_AGENT

# Trích đúng cấu trúc robots.txt của VnExpress: cho phép tất cả, nhưng cấm riêng
# news-please và một số bot khác.
ROBOTS_VNEXPRESS = """
User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: news-please
Disallow: /
"""

ROBOTS_MO = """
User-agent: *
Allow: /
"""


@pytest.fixture(autouse=True)
def _xoa_cache() -> None:
    extract._robots_cache.clear()  # noqa: SLF001 — bộ nhớ đệm nội bộ, phải dọn giữa các test


def _gan_robots(url_goc: str, noi_dung: str) -> None:
    parser = RobotFileParser()
    parser.parse(noi_dung.splitlines())
    extract._robots_cache[url_goc] = parser  # noqa: SLF001


def test_ua_du_an_duoc_phep_nhung_newsplease_thi_khong() -> None:
    """Đây chính là trường hợp VnExpress. Hai phép kiểm phải cho hai câu trả lời khác nhau."""
    _gan_robots("https://vnexpress.net", ROBOTS_VNEXPRESS)
    url = "https://vnexpress.net/bai-viet-123.html"

    assert extract.duoc_phep_tai(url) is True, "UA của dự án khớp User-agent: * nên được phép"
    assert extract.duoc_phep_tai(url, extract.NEWSPLEASE_AGENT) is False


def test_khong_boc_toan_van_khi_toa_soan_cam_newsplease() -> None:
    """Phép kiểm dùng thật phải chặn, dù UA của dự án được phép."""
    _gan_robots("https://vnexpress.net", ROBOTS_VNEXPRESS)

    assert extract.duoc_phep_boc_toan_van("https://vnexpress.net/bai-viet-123.html") is False


def test_van_boc_binh_thuong_khi_khong_ai_bi_cam() -> None:
    _gan_robots("https://vietnamnet.vn", ROBOTS_MO)

    assert extract.duoc_phep_boc_toan_van("https://vietnamnet.vn/bai-viet.html") is True


def test_khong_lay_duoc_robots_thi_coi_nhu_khong_cam() -> None:
    """Không có robots.txt nghĩa là toà soạn không cấm gì — không được tự suy diễn là cấm."""
    extract._robots_cache["https://bao-nao-do.vn"] = None  # noqa: SLF001

    assert extract.duoc_phep_boc_toan_van("https://bao-nao-do.vn/bai.html") is True


def test_user_agent_du_an_tu_gioi_thieu_trung_thuc() -> None:
    """Quản trị viên các báo phải biết ai đang truy cập để chặn hoặc liên hệ."""
    assert "PTIT" in USER_AGENT
    assert "ptit.edu.vn" in USER_AGENT
    assert USER_AGENT.isascii(), "Tiêu đề HTTP mã hoá latin-1, có dấu tiếng Việt là lỗi"
