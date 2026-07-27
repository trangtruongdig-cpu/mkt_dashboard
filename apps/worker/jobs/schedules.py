"""Quy đổi mã lịch sang biểu thức cron.

Bảng này là BẢN SAO của `CRAWLER_SCHEDULE_CRON` trong
`packages/shared/src/schemas/crawler-admin.ts`. Không tránh được: TypeScript và Python
không dùng chung được một hằng số, mà cả hai bên đều cần biết ánh xạ này.

Chỗ nào có bản sao thì chỗ đó sẽ lệch. Vì vậy `tests/test_schedules.py` đọc thẳng file
TypeScript và bắt buộc hai bảng phải khớp nhau — sửa một bên mà quên bên kia là hỏng test.
"""

from __future__ import annotations

# `None` = không tự chạy.
SCHEDULE_CRON: dict[str, str | None] = {
    "tat": None,
    "moi_gio": "0 * * * *",
    "moi_6_gio": "0 */6 * * *",
    "hang_ngay": "0 2 * * *",
    "hang_tuan": "0 2 * * 1",
}


def cron_for(schedule: str) -> str | None:
    """Trả về biểu thức cron, hoặc `None` nếu lịch tắt hay mã lịch lạ.

    Mã lạ được coi như tắt thay vì ném lỗi: cơ sở dữ liệu có thể chứa giá trị do phiên bản
    sau ghi vào, và một worker cũ không được vì thế mà chết cả tiến trình.
    """
    return SCHEDULE_CRON.get(schedule)
