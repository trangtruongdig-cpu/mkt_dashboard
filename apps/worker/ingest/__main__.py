"""
Điểm chạy các job hút dữ liệu.

    uv run python -m ingest spec            # cài connector GA4, in lược đồ cấu hình
    uv run python -m ingest check           # kiểm tra thông tin đăng nhập GA4
    uv run python -m ingest sync            # hút dữ liệu GA4 về kho

    uv run python -m ingest trends-report   # in bảng thị phần tìm kiếm, không ghi kho
    uv run python -m ingest trends-sync     # hút chỉ số quan tâm tìm kiếm về kho

    uv run python -m ingest wiki-report     # in bảng thị phần chú ý, không ghi kho
    uv run python -m ingest wiki-sync       # hút lượt xem trang Wikipedia về kho

Bốn lệnh `trends-*` và `wiki-*` không cần đăng nhập gì cả — nguồn hoàn toàn công khai.
Lưu ý: Google Trends không có API chính thức và hiện đang chặn (HTTP 429), còn
Wikimedia Pageviews là API chính thức nên `wiki-*` là đường chạy được ngay.
"""

from __future__ import annotations

import argparse
import sys

from .settings import ConfigError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingest", description="Hút dữ liệu marketing số về kho")
    sub = parser.add_subparsers(dest="lenh", required=True)

    sub.add_parser("spec", help="Cài connector GA4 và in lược đồ cấu hình")
    sub.add_parser("check", help="Kiểm tra kết nối GA4")

    p_sync = sub.add_parser("sync", help="Đồng bộ dữ liệu GA4 về kho")
    p_sync.add_argument(
        "--stream",
        action="append",
        dest="streams",
        help="Chỉ đồng bộ báo cáo này (lặp lại được). Bỏ trống = tất cả.",
    )

    sub.add_parser("trends-report", help="In bảng thị phần tìm kiếm của nhóm đối sánh")
    sub.add_parser("trends-sync", help="Hút chỉ số quan tâm tìm kiếm về kho")

    sub.add_parser("wiki-report", help="In bảng thị phần chú ý (lượt xem Wikipedia)")
    sub.add_parser("wiki-sync", help="Hút lượt xem trang Wikipedia về kho")

    args = parser.parse_args(argv)

    try:
        if args.lenh in ("spec", "check", "sync"):
            from . import ga4

            if args.lenh == "spec":
                ga4.print_spec()
            elif args.lenh == "check":
                ga4.check_connection()
            else:
                ga4.run_sync(streams=args.streams)
        elif args.lenh.startswith("wiki-"):
            from . import wiki_job
            from .wiki import WikiError

            try:
                if args.lenh == "wiki-report":
                    wiki_job.print_report()
                else:
                    wiki_job.run_sync()
            except WikiError as loi:
                print(f"Lỗi dữ liệu Wikipedia: {loi}", file=sys.stderr)
                return 1
        else:
            from . import trends_job
            from .trends import TrendsError

            try:
                if args.lenh == "trends-report":
                    trends_job.print_report()
                else:
                    trends_job.run_sync()
            except TrendsError as loi:
                print(f"Lỗi dữ liệu Trends: {loi}", file=sys.stderr)
                return 1
    except ConfigError as loi:
        print(f"Lỗi cấu hình: {loi}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
