"""
Tiến trình chạy nền của worker.

    uv run python -m jobs.main

Ba việc, lặp mãi:
  1. Đồng bộ lịch  — đọc `crawler_source`, dựng lại lịch APScheduler cho khớp.
                     Quản trị viên đổi lịch trên web là có hiệu lực trong vòng một phút,
                     không phải khởi động lại worker.
  2. Nhặt lượt chờ — quản trị viên bấm "Chạy ngay" thì API ghi một dòng `cho_chay`;
                     vòng quét này nhặt lên và chạy.
  3. Chạy theo lịch — mỗi nguồn có lịch riêng.

Không có HTTP API ở đây. Worker chỉ nói chuyện với PostgreSQL.
"""

from __future__ import annotations

import logging
import signal
import sys
from types import FrameType

from apscheduler.schedulers.background import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from crawler.control import ControlPlane
from crawler.settings import (
    CONTROL_DATABASE_URL,
    PENDING_POLL_SECONDS,
    SCHEDULER_TIMEZONE,
    MediaSources,
    has_control_plane,
)

from . import crawler_job, nlp_job, social_job
from .schedules import cron_for

log = logging.getLogger("jobs")

# Tiền tố id của các job thu thập, để phân biệt với job nội bộ khi dọn lịch cũ.
JOB_PREFIX = "crawler:"
SYNC_JOB_ID = "noi_bo:dong_bo_lich"
POLL_JOB_ID = "noi_bo:nhat_luot_cho"
SOCIAL_JOB_ID = "noi_bo:lang_nghe_mxh"
NLP_JOB_ID = "noi_bo:cham_sac_thai"

# Bao lâu một lần đọc lại lịch từ cơ sở dữ liệu, tính bằng giây.
SYNC_INTERVAL_SECONDS = 60

# Ba mẻ nối đuôi nhau, KHÔNG chạy song song và thứ tự không đổi được:
#   2h  tin bài      (lịch do quản trị viên đặt, xem dong_bo_lich)
#   3h  mạng xã hội  — gọi ra Internet, chạy chồng mẻ tin bài chỉ làm cả hai chậm và dễ
#                      bị nguồn ngoài chặn
#   4h  chấm sắc thái — chỉ chấm những gì mẻ 3h đã ghi xuống kho. Chạy trước mẻ 3h là
#                      chấm vào tập dữ liệu của hôm qua rồi phải đợi thêm một ngày.
# Lịch cố định vì hai nguồn này chưa có màn hình quản trị. Xem jobs/social_job.py.
SOCIAL_CRON = "0 3 * * *"
NLP_CRON = "0 4 * * *"


def dong_bo_lich(scheduler: BlockingScheduler) -> None:
    """Dựng lại các job thu thập cho khớp với cấu hình đang có trong cơ sở dữ liệu."""
    with ControlPlane(CONTROL_DATABASE_URL) as control:
        if not control.tables_ready():
            log.warning("Chưa có bảng điều khiển — chờ apps/api chạy migration.")
            return
        mong_muon = control.scheduled_sources()

    can_co: dict[str, str] = {}
    for ten, ma_lich in mong_muon:
        cron = cron_for(ma_lich)
        if cron is None:
            log.warning("Nguồn %s có mã lịch lạ %r — bỏ qua.", ten, ma_lich)
            continue
        can_co[f"{JOB_PREFIX}{ten}"] = cron

    dang_co = {j.id for j in scheduler.get_jobs() if j.id.startswith(JOB_PREFIX)}

    for job_id in dang_co - can_co.keys():
        scheduler.remove_job(job_id)
        log.info("Bỏ lịch %s.", job_id)

    for job_id, cron in can_co.items():
        ten_nguon = job_id[len(JOB_PREFIX) :]
        # replace_existing: đổi lịch cho nguồn đã có thì ghi đè, không sinh job trùng.
        scheduler.add_job(
            crawler_job.chay_theo_lich,
            trigger=CronTrigger.from_crontab(cron, timezone=SCHEDULER_TIMEZONE),
            args=[ten_nguon],
            id=job_id,
            name=f"Thu thập {ten_nguon}",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
        )

    log.info("Đang có %s nguồn chạy theo lịch.", len(can_co))


def nap_du_lieu_moi() -> None:
    """Nạp nguồn từ file JSON vào cơ sở dữ liệu nếu bảng còn trống.

    Nhờ bước này, `docker compose up -d` là đủ để có ngay danh sách nguồn — không có
    bước cấu hình thủ công nào ngoài tài liệu.
    """
    with ControlPlane(CONTROL_DATABASE_URL) as control:
        if not control.tables_ready():
            log.warning("Chưa có bảng điều khiển — sẽ nạp dữ liệu mồi ở lần đồng bộ sau.")
            return
        them_moi, tong = control.seed_sources(MediaSources.load())

    if them_moi:
        log.info("Đã nạp %s nguồn mới từ dữ liệu mồi (tổng %s).", them_moi, tong)
    else:
        log.info("Dữ liệu mồi đã có đủ, %s nguồn trong cơ sở dữ liệu.", tong)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s · %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # APScheduler log mỗi lần thêm job, rất ồn khi đồng bộ mỗi phút.
    logging.getLogger("apscheduler").setLevel(logging.WARNING)

    if not has_control_plane():
        print(
            "Thiếu DATABASE_URL. Tiến trình này đọc lịch và cấu hình nguồn từ PostgreSQL.\n"
            "Chạy một mẻ độc lập không cần cơ sở dữ liệu: uv run python -m crawler thu-thap",
            file=sys.stderr,
        )
        return 1

    nap_du_lieu_moi()

    scheduler = BlockingScheduler(timezone=SCHEDULER_TIMEZONE)

    scheduler.add_job(
        dong_bo_lich,
        trigger=IntervalTrigger(seconds=SYNC_INTERVAL_SECONDS),
        args=[scheduler],
        id=SYNC_JOB_ID,
        name="Đồng bộ lịch từ cơ sở dữ liệu",
        max_instances=1,
        coalesce=True,
        next_run_time=None,
    )
    scheduler.add_job(
        crawler_job.nhat_luot_cho,
        trigger=IntervalTrigger(seconds=PENDING_POLL_SECONDS),
        id=POLL_JOB_ID,
        name="Nhặt lượt chạy thủ công",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        social_job.chay_theo_lich,
        trigger=CronTrigger.from_crontab(SOCIAL_CRON, timezone=SCHEDULER_TIMEZONE),
        id=SOCIAL_JOB_ID,
        name="Lắng nghe mạng xã hội",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        nlp_job.chay_theo_lich,
        trigger=CronTrigger.from_crontab(NLP_CRON, timezone=SCHEDULER_TIMEZONE),
        id=NLP_JOB_ID,
        name="Chấm sắc thái tiếng Việt",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )

    # Đồng bộ ngay một lần thay vì đợi hết chu kỳ đầu tiên.
    dong_bo_lich(scheduler)

    def dung_lai(_sig: int, _frame: FrameType | None) -> None:
        log.info("Nhận tín hiệu dừng, đang đóng scheduler…")
        scheduler.shutdown(wait=False)

    signal.signal(signal.SIGTERM, dung_lai)
    signal.signal(signal.SIGINT, dung_lai)

    log.info(
        "Worker sẵn sàng. Múi giờ %s, quét lượt chờ mỗi %ss.",
        SCHEDULER_TIMEZONE,
        PENDING_POLL_SECONDS,
    )
    scheduler.start()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
