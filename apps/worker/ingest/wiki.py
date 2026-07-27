"""
Thị phần chú ý đo bằng lượt xem trang Wikipedia.

Vì sao có module này bên cạnh `trends.py`: Google không có API chính thức cho Trends
và đang chặn truy cập (HTTP 429), nên tầng "Nhận biết" của cây mục tiêu có nguy cơ
không có chỉ số nào chạy được. Wikimedia thì ngược lại — API công khai, có tài liệu,
không cần đăng nhập, không giới hạn thực tế với quy mô 6 bài mỗi ngày.

Đánh đổi phải ghi rõ trong hồ sơ nghiệm thu: lượt xem Wikipedia KHÔNG tương đương
lượt tìm kiếm. Nó đo nhóm công chúng chịu khó tra cứu, hẹp hơn và thiên về người đã
biết tên trường. Bù lại nó là số đếm TUYỆT ĐỐI, so sánh trực tiếp giữa các thương
hiệu và giữa các năm được — điều mà chỉ số 0–100 của Google Trends không làm được,
và cũng vì thế không cần bước quy thang phức tạp như bên Trends.

Phần tính toán ở đây là hàm thuần, không chạm mạng.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

DAYS_IN_WEEK = 7


class WikiError(RuntimeError):
    """Dữ liệu lượt xem không dùng được — dừng thay vì ghi số sai vào kho."""


@dataclass(frozen=True)
class DailyViews:
    """Lượt xem một bài trong một ngày, đúng như Wikimedia trả về."""

    day: date
    views: int


def week_start_of(day: date) -> date:
    """Ngày thứ Hai của tuần chứa `day`. Quy ước tuần bắt đầu thứ Hai, dùng thống nhất."""
    return day - timedelta(days=day.weekday())


def to_weekly(
    daily: list[DailyViews],
    drop_incomplete: bool = True,
) -> dict[date, int]:
    """Cộng lượt xem theo ngày thành lượt xem theo tuần.

    Mặc định BỎ tuần không đủ 7 ngày. Tuần đang diễn ra luôn thiếu ngày nên tổng của
    nó thấp giả tạo; giữ lại sẽ tạo ra một cú rơi ở cuối mọi biểu đồ, tuần sau lại tự
    khỏi — đúng loại hiện tượng khiến người xem mất niềm tin vào số liệu.
    """
    theo_tuan: dict[date, int] = defaultdict(int)
    so_ngay: dict[date, int] = defaultdict(int)

    for muc in daily:
        tuan = week_start_of(muc.day)
        theo_tuan[tuan] += muc.views
        so_ngay[tuan] += 1

    if drop_incomplete:
        return {
            tuan: tong for tuan, tong in theo_tuan.items() if so_ngay[tuan] == DAYS_IN_WEEK
        }
    return dict(theo_tuan)


def align_weeks(by_brand: dict[str, dict[date, int]]) -> tuple[list[date], dict[str, list[int]]]:
    """Cắt về đúng những tuần MỌI thương hiệu đều có dữ liệu.

    Tỷ trọng chỉ có nghĩa khi tử số và mẫu số cùng một khoảng thời gian. Một thương
    hiệu thiếu tuần nào thì cả nhóm bỏ tuần đó, thay vì coi thiếu là bằng 0 — coi là 0
    sẽ thổi phồng thị phần của những thương hiệu còn lại.
    """
    if not by_brand:
        raise WikiError("Không có thương hiệu nào để căn tuần.")

    chung: set[date] | None = None
    for tuan_cua_brand in by_brand.values():
        khoa = set(tuan_cua_brand)
        chung = khoa if chung is None else (chung & khoa)

    if not chung:
        raise WikiError(
            "Không có tuần nào mà cả nhóm đối sánh cùng có dữ liệu. "
            "Kiểm tra lại tên bài Wikipedia trong benchmark-brands.json."
        )

    weeks = sorted(chung)
    return weeks, {khoa: [tuan[w] for w in weeks] for khoa, tuan in by_brand.items()}


def compute_shares(views: dict[str, list[int]]) -> dict[str, list[float]]:
    """Đổi lượt xem thành tỷ trọng %, mỗi tuần cộng lại bằng 100."""
    if not views:
        raise WikiError("Không có chuỗi nào để tính thị phần.")

    do_dai = {len(v) for v in views.values()}
    if len(do_dai) != 1:
        raise WikiError(f"Các chuỗi có độ dài khác nhau: {sorted(do_dai)}.")

    so_tuan = do_dai.pop()
    shares: dict[str, list[float]] = {khoa: [] for khoa in views}

    for tuan in range(so_tuan):
        tong = sum(chuoi[tuan] for chuoi in views.values())
        for khoa, chuoi in views.items():
            shares[khoa].append(0.0 if tong <= 0 else round(chuoi[tuan] / tong * 100, 2))

    return shares
