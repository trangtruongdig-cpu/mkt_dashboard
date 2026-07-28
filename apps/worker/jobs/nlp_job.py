"""Một mẻ chấm sắc thái chạy theo lịch, cho MỌI kho văn bản.

Chạy SAU hai mẻ thu thập, không chạy song song: nó chỉ chấm những gì các mẻ trước đã ghi
xuống kho, nên chạy trước là chấm vào tập dữ liệu cũ rồi phải đợi thêm một ngày.

Mỗi kho nạp model riêng, nhưng chỉ nạp đúng một lần cho cả mẻ — nạp model tốn vài giây và
vài trăm MB RAM, tuyệt đối không nạp lại theo từng bản ghi.

Một kho hỏng không được kéo theo kho còn lại: tin bài và mạng xã hội độc lập với nhau,
chấm được cái nào thì báo cáo có cái đó.
"""

from __future__ import annotations

import logging

from nlp import score
from nlp.settings import CORPUS

log = logging.getLogger(__name__)


def chay_theo_lich() -> None:
    """Điểm vào cho APScheduler. Không ném lỗi ra ngoài.

    Một mẻ hỏng không được làm chết scheduler — nếu chết thì mọi lịch sau đó im lặng
    không chạy, và không ai biết cho tới khi phát hiện số liệu đứng yên.
    """
    for ma in sorted(CORPUS):
        try:
            stats = score.run(CORPUS[ma])
        except Exception:  # noqa: BLE001 — mọi lỗi phải được ghi lại rồi đi tiếp
            log.exception("Mẻ chấm sắc thái kho %s thất bại", ma)
            continue

        if stats.da_cham == 0:
            log.info("Kho %s: không có bản ghi mới cần chấm (%s).", ma, stats.model_version)
            continue

        log.info(
            "Kho %s: chấm xong %s bản ghi bằng %s — %s.",
            ma,
            stats.da_cham,
            stats.model_version,
            ", ".join(f"{nhan} {so}" for nhan, so in sorted(stats.phan_bo.items())),
        )
        if stats.bi_cat:
            log.warning(
                "Kho %s: %s bản ghi bị cắt vì vượt giới hạn token — điểm là của phần đầu "
                "văn bản, không phải toàn văn.",
                ma,
                stats.bi_cat,
            )
