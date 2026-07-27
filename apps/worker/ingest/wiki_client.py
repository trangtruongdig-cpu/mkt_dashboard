"""
Tầng mạng gọi Wikimedia Pageviews API, tách khỏi phần tính toán trong `wiki.py`.

Khác hẳn với Google Trends: đây là API CHÍNH THỨC, có tài liệu, không cần đăng nhập,
và Wikimedia công khai cam kết duy trì. Rủi ro thư viện gãy như pytrends không tồn tại
ở đây vì không dùng thư viện nào — chỉ gọi HTTP thẳng bằng thư viện chuẩn.

Hai điều bắt buộc theo chính sách của Wikimedia:
  1. Gửi User-Agent tự giới thiệu kèm địa chỉ liên hệ. Thiếu là bị chặn.
  2. Gọi có chừng mực. Ở đây mỗi lần chạy chỉ 6 yêu cầu nên không thành vấn đề, nhưng
     vẫn giãn cách giữa các lần gọi cho đúng phép.

Hai điều bất thường gặp thật khi thử, đã xử lý trong file này:

  1. Cùng một tên bài lúc trả 404 lúc trả dữ liệu bình thường. Nên 404 KHÔNG được coi
     ngay là "bài không tồn tại" — phải thử lại đủ số lần rồi mới kết luận.
  2. Hỏi khoảng dài (26 tuần) trả 404 kèm thân "không có dữ liệu cho những ngày này",
     trong khi CHÍNH bài đó chia thành các khoảng ngắn lại trả đủ ngày. Vì vậy mọi
     yêu cầu đều được cắt thành từng đoạn ngắn rồi ghép lại.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

from .wiki import DailyViews, WikiError

API_ROOT = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"

# Wikimedia yêu cầu User-Agent nói rõ mình là ai và liên hệ ở đâu. Thuần ASCII vì tiêu
# đề HTTP mã hoá bằng latin-1.
USER_AGENT = os.getenv(
    "CRAWLER_USER_AGENT",
    "PTIT-BrandMonitor/0.1 (academic research; +https://ptit.edu.vn)",
)

# Độ dài mỗi đoạn hỏi, tính bằng ngày. Khoảng 8 tuần đã chạy ổn với cả 6 bài trong
# khi khoảng 26 tuần thì hỏng — giữ ngưỡng này, đừng nới rộng để tiết kiệm số lần gọi.
CHUNK_DAYS = 56

# Đoạn hỏng được chia đôi tới ngưỡng này rồi mới ghi nhận là thật sự không có dữ liệu.
# 7 ngày = đúng một tuần, đơn vị nhỏ nhất mà phép tính thị phần quan tâm.
MIN_SPLIT_DAYS = 7

DELAY_BETWEEN_REQUESTS_SECONDS = 0.5
REQUEST_TIMEOUT_SECONDS = 30.0
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2.0

# `user` loại bỏ lượt truy cập của bot và trình thu thập. Không lọc thì con số phồng
# lên theo hoạt động của máy móc chứ không theo mối quan tâm của con người.
AGENT = "user"
ACCESS = "all-access"


def _build_url(project: str, article: str, start: date, end: date) -> str:
    # Wikimedia nhận tên bài dùng gạch dưới thay dấu cách, và mã hoá phần còn lại.
    ten_bai = urllib.parse.quote(article.replace(" ", "_"), safe="")
    return (
        f"{API_ROOT}/{project}/{ACCESS}/{AGENT}/{ten_bai}/daily/"
        f"{start:%Y%m%d}/{end:%Y%m%d}"
    )


def _fetch_chunk(project: str, article: str, start: date, end: date) -> list[DailyViews]:
    """Một đoạn ngắn. Trả danh sách rỗng nếu đoạn này không có dữ liệu."""
    url = _build_url(project, article, start, end)
    yeu_cau = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    lan_loi: Exception | None = None

    for lan in range(MAX_RETRIES):
        if lan > 0:
            time.sleep(RETRY_BACKOFF_SECONDS * lan)
        try:
            with urllib.request.urlopen(yeu_cau, timeout=REQUEST_TIMEOUT_SECONDS) as phan_hoi:
                du_lieu = json.loads(phan_hoi.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as loi:
            lan_loi = loi
            if loi.code != 404:
                continue
            # 404 gặp cả khi thật sự không có dữ liệu lẫn khi API dở chứng với đoạn
            # này. Thử lại hết lượt rồi mới chịu coi là đoạn rỗng.
            if lan == MAX_RETRIES - 1:
                return []
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as loi:
            lan_loi = loi
    else:
        raise WikiError(
            f"Không lấy được lượt xem bài {article!r} khoảng {start}–{end} "
            f"sau {MAX_RETRIES} lần: {lan_loi}."
        ) from lan_loi

    time.sleep(DELAY_BETWEEN_REQUESTS_SECONDS)
    return [
        DailyViews(
            # Dấu thời gian có dạng YYYYMMDDHH, phần giờ luôn là 00 với mức ngày.
            day=date(
                int(m["timestamp"][0:4]),
                int(m["timestamp"][4:6]),
                int(m["timestamp"][6:8]),
            ),
            views=int(m["views"]),
        )
        for m in du_lieu.get("items", [])
    ]


def _fetch_range(
    project: str,
    article: str,
    start: date,
    end: date,
    ngay_hong: list[tuple[date, date]],
) -> list[DailyViews]:
    """Lấy một khoảng, chia đôi khi hỏng thay vì bỏ cả khoảng.

    Quan sát thực tế: khoảng [26/01 → 22/03] trả 404 nhưng [01/02 → 26/07] lại trả đủ.
    Nghĩa là API dở chứng với một số mốc bắt đầu cụ thể chứ không phải thiếu dữ liệu.
    Bỏ cả đoạn 8 tuần vì một mốc xấu sẽ làm cửa sổ so sánh co lại tuỳ lần chạy — chính
    là hiện tượng cửa sổ tụt từ 26 tuần xuống 18 tuần giữa hai lần chạy liên tiếp.

    Chia đôi tới `MIN_SPLIT_DAYS` rồi mới chịu ghi nhận là khoảng không có dữ liệu.
    """
    ket_qua = _fetch_chunk(project, article, start, end)
    if ket_qua:
        return ket_qua

    so_ngay = (end - start).days + 1
    if so_ngay <= MIN_SPLIT_DAYS:
        ngay_hong.append((start, end))
        return []

    giua = start + timedelta(days=so_ngay // 2 - 1)
    return _fetch_range(project, article, start, giua, ngay_hong) + _fetch_range(
        project, article, giua + timedelta(days=1), end, ngay_hong
    )


def fetch_daily_views(
    project: str,
    article: str,
    start: date,
    end: date,
) -> list[DailyViews]:
    """Lấy lượt xem theo ngày của một bài trong khoảng `[start, end]`.

    Cắt thành từng đoạn `CHUNK_DAYS` ngày rồi ghép: API trả 404 với khoảng dài trong
    khi vẫn trả đủ dữ liệu cho chính khoảng đó khi hỏi từng đoạn ngắn.
    """
    tat_ca: list[DailyViews] = []
    ngay_hong: list[tuple[date, date]] = []

    moc = start
    while moc <= end:
        het_doan = min(moc + timedelta(days=CHUNK_DAYS - 1), end)
        tat_ca.extend(_fetch_range(project, article, moc, het_doan, ngay_hong))
        moc = het_doan + timedelta(days=1)

    if not tat_ca:
        raise WikiError(
            f"Bài {article!r} không có dữ liệu lượt xem nào trong khoảng {start}–{end}. "
            "Kiểm tra tên bài — phải là tên chuẩn, không phải tên chuyển hướng."
        )

    # Không im lặng bỏ qua phần khuyết: thiếu ngày nào thì tuần chứa nó sẽ bị loại khỏi
    # phép so sánh, người chạy job cần biết điều đó.
    if ngay_hong:
        khoang = ", ".join(f"{a}–{b}" for a, b in ngay_hong)
        print(f"  ! {article}: không lấy được dữ liệu cho {khoang}.")

    return tat_ca
