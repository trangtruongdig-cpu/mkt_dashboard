"""
Tầng mạng gọi Google Trends, tách riêng khỏi phần tính toán trong `trends.py`.

CẢNH BÁO cần ghi vào hồ sơ nghiệm thu: Google KHÔNG có API chính thức cho Trends.
`pytrends` (Apache-2.0) gọi vào các endpoint nội bộ của trang web, nên có thể hỏng
bất cứ lúc nào Google đổi giao diện, và bị chặn tạm thời khi gọi quá dày.

Vì vậy toàn bộ phụ thuộc vào pytrends bị nhốt trong đúng file này. Khi nó hỏng, chỉ
cần viết một hàm `fetch` khác cùng chữ ký — phần tính thị phần, phần ghi kho và toàn
bộ dashboard không phải sửa một dòng nào.
"""

from __future__ import annotations

import time
from datetime import date
from typing import Any

from .settings import ConfigError
from .trends import TrendsBatch, TrendsError

# Giãn cách giữa hai lượt gọi. Gọi dày sẽ bị Google trả 429 và khoá tạm địa chỉ IP.
DELAY_BETWEEN_REQUESTS_SECONDS = 5.0

MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 20.0

# Múi giờ truyền cho Trends tính bằng phút lệch so với UTC. Việt Nam là UTC+7.
TIMEZONE_OFFSET_MINUTES = 420


def _build_client() -> Any:
    try:
        from pytrends.request import TrendReq
    except ImportError as loi:
        raise ConfigError(
            "Thiếu thư viện pytrends. Cài bằng: uv sync (đã khai trong pyproject.toml)."
        ) from loi

    return TrendReq(hl="vi-VN", tz=TIMEZONE_OFFSET_MINUTES)


def fetch(queries: list[str], geo: str, timeframe: str) -> TrendsBatch:
    """Lấy chỉ số quan tâm theo tuần cho tối đa 5 từ khoá."""
    if not queries:
        raise TrendsError("Danh sách từ khoá rỗng.")

    client = _build_client()
    lan_loi: Exception | None = None

    for lan in range(MAX_RETRIES):
        if lan > 0:
            time.sleep(RETRY_BACKOFF_SECONDS * lan)
        try:
            client.build_payload(kw_list=queries, timeframe=timeframe, geo=geo)
            khung = client.interest_over_time()
            break
        except Exception as loi:  # pytrends ném nhiều loại lỗi mạng khác nhau
            lan_loi = loi
    else:
        raise TrendsError(
            f"Gọi Google Trends thất bại sau {MAX_RETRIES} lần: {lan_loi}. "
            "Thường là bị chặn tạm thời — chờ vài phút rồi chạy lại."
        ) from lan_loi

    if khung is None or khung.empty:
        raise TrendsError(
            f"Google Trends không có dữ liệu cho {queries} tại {geo}. "
            "Từ khoá có thể quá hiếm để Trends thống kê."
        )

    # Tuần đang diễn ra được đánh dấu isPartial: số liệu chưa đủ ngày nên luôn thấp hơn
    # thực tế. Giữ lại sẽ tạo ra một cú rơi giả ở cuối mọi biểu đồ, tuần sau lại tự khỏi.
    if "isPartial" in khung.columns:
        khung = khung[~khung["isPartial"].astype(bool)]
        khung = khung.drop(columns=["isPartial"])

    if khung.empty:
        raise TrendsError("Sau khi loại tuần chưa trọn vẹn thì không còn dữ liệu nào.")

    weeks: list[date] = [d.date() for d in khung.index.to_pydatetime()]
    values = {str(cot): [float(v) for v in khung[cot].tolist()] for cot in khung.columns}

    time.sleep(DELAY_BETWEEN_REQUESTS_SECONDS)
    return TrendsBatch(weeks=weeks, values=values)
