"""
Thu thập earned media — tin bài công khai có nhắc đến Học viện.

    uv run python -m crawler nguon              # liệt kê nguồn và từ khoá đang cấu hình
    uv run python -m crawler thu-thap           # chạy đầy đủ: tìm bài + bóc toàn văn
    uv run python -m crawler thu-thap --nhanh   # chỉ lấy tiêu đề, không tải toàn văn
    uv run python -m crawler thong-ke           # xem những gì đã có trong kho

Không cần token, không cần quyền quản trị tài khoản nào — toàn bộ nguồn đều công khai.
"""

from __future__ import annotations

import argparse
import sys

from .settings import (
    BrandKeywords,
    CrawlerError,
    MediaSources,
    StoreSettings,
    has_control_plane,
)


def _nguon_dang_dung() -> tuple[MediaSources, str]:
    """Cấu hình nguồn lấy từ cơ sở dữ liệu nếu có, không thì từ file JSON.

    Có cơ sở dữ liệu nghĩa là quản trị viên đang điều khiển qua giao diện web — file JSON
    lúc đó chỉ còn là dữ liệu mồi, không phải nguồn sự thật.
    """
    if not has_control_plane():
        return MediaSources.load(), "file JSON (chưa cấu hình DATABASE_URL)"

    from .control import ControlPlane
    from .settings import CONTROL_DATABASE_URL

    with ControlPlane(CONTROL_DATABASE_URL) as control:
        return control.load_sources(), "PostgreSQL (quản trị qua giao diện web)"


def _seed() -> None:
    """Nạp nguồn từ file JSON vào PostgreSQL để quản trị viên bật/tắt được trên web."""
    if not has_control_plane():
        raise CrawlerError(
            "Thiếu DATABASE_URL — chưa có cơ sở dữ liệu để nạp vào. Xem apps/worker/.env.example."
        )

    from .control import ControlPlane
    from .settings import CONTROL_DATABASE_URL

    with ControlPlane(CONTROL_DATABASE_URL) as control:
        them_moi, tong = control.seed_sources(MediaSources.load())

    print(f"Đã thêm {them_moi} nguồn mới. Tổng cộng {tong} nguồn trong cơ sở dữ liệu.")
    if them_moi == 0:
        print("Nguồn đã có sẵn giữ nguyên trạng thái bật/tắt và lịch mà quản trị viên đã đặt.")


def _in_nguon() -> None:
    keywords = BrandKeywords.load()
    sources, nguon_cau_hinh = _nguon_dang_dung()

    print("Từ khoá gửi cho công cụ tìm kiếm:")
    for t in keywords.search_terms:
        print(f"  · {t}")

    print("\nTừ khoá dùng để lọc kết quả:")
    for kw in keywords.match_keywords:
        chu_thich = "phải đứng riêng thành một từ" if kw.mode == "token" else "khớp chuỗi con"
        print(f"  · {kw.text:<45} ({chu_thich})")

    print("\nCông cụ tìm kiếm:")
    for e in sources.search_engines:
        print(f"  · {e.name:<15} {'bật' if e.enabled else 'TẮT':<5} {e.pages} trang")

    bat = sources.enabled_feeds()
    print(f"\nFeed RSS ({len(bat)} bật / {len(sources.rss_feeds)} khai báo):")
    for f in sources.rss_feeds:
        print(f"  · {f.name:<28} {'bật' if f.enabled else 'TẮT':<5} {f.publisher:<18} {f.url}")

    store = StoreSettings.from_env()
    dich = (
        store.duckdb_path
        if store.kind == "duckdb"
        else f"{store.postgres_host}/{store.postgres_db}"
    )
    print(f"\nCấu hình nguồn đọc từ: {nguon_cau_hinh}")
    print(f"Kho ghi vào: {store.kind} → {dich}")


def _in_thong_ke() -> None:
    from .storage import open_store

    store = open_store()
    try:
        tong = store.count()
        print(f"Tổng số bài trong kho: {tong}")
        if tong == 0:
            print("Kho rỗng — chạy `uv run python -m crawler thu-thap` trước.")
            return

        def _in_bang(tieu_de: str, dong: list[tuple[str, int]]) -> None:
            print(f"\n{tieu_de}")
            for khoa, so in dong:
                print(f"  {khoa:<30} {so:>4}")

        _in_bang(
            "Earned (báo ngoài viết) so với owned (Học viện tự đăng):",
            [
                ("earned — báo ngoài" if k in ("false", "False", "0") else "owned — kênh của HV", v)
                for k, v in store.group_count("is_owned")
            ],
        )
        _in_bang("Theo nguồn phát hiện:", store.group_count("discovered_via"))
        _in_bang("10 báo nhắc đến nhiều nhất:", store.group_count("publisher", limit=10))
        # EXTRACT chạy được trên cả DuckDB lẫn PostgreSQL; hàm year() thì chỉ DuckDB có.
        _in_bang(
            "Số bài theo năm đăng:",
            store.group_count("EXTRACT(YEAR FROM published_at)", theo_khoa=True),
        )
        _in_bang("Chất lượng bóc toàn văn:", store.group_count("extraction_status"))
    finally:
        store.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="crawler", description="Thu thập tin bài công khai nhắc đến Học viện"
    )
    sub = parser.add_subparsers(dest="lenh", required=True)

    sub.add_parser("nguon", help="Liệt kê nguồn và từ khoá đang cấu hình")
    sub.add_parser("thong-ke", help="Thống kê dữ liệu đã có trong kho")
    sub.add_parser("seed", help="Nạp nguồn từ file JSON vào PostgreSQL để quản trị trên web")

    # Nhánh tài liệu công khai bắt buộc (Thông tư 09/2024 và 08/2022). Chạy theo thứ tự:
    # cong-khai → cong-khai-do → cong-khai-boc-so.
    sub.add_parser(
        "cong-khai",
        help="Quét tài liệu Ba công khai / đề án tuyển sinh của nhóm trường đối sánh",
    )
    sub.add_parser("cong-khai-thong-ke", help="Thống kê danh mục tài liệu công khai đã thu")
    p_do = sub.add_parser(
        "cong-khai-do",
        help="Dò xem tài liệu nào có lớp chữ đọc được, tài liệu nào là bản scan",
    )
    p_do.add_argument("--gioi-han", type=int, default=None, metavar="N", help="Chỉ dò N tài liệu")
    sub.add_parser(
        "cong-khai-ke-hoach",
        help="In việc cần làm: tài liệu nào bóc bằng máy được, tài liệu nào phải nhập tay",
    )
    sub.add_parser(
        "cong-khai-boc-so",
        help="Bóc số liệu từ các bản Biểu 18 đọc được bằng máy",
    )

    p_thu = sub.add_parser("thu-thap", help="Tìm bài và ghi vào kho")
    p_thu.add_argument(
        "--nhanh",
        action="store_true",
        help="Chỉ lấy tiêu đề/báo/ngày, bỏ qua bước tải toàn văn (chạy trong ~1 phút)",
    )
    p_thu.add_argument(
        "--gioi-han",
        type=int,
        default=None,
        metavar="N",
        help="Chỉ bóc toàn văn tối đa N bài. Dùng để chạy thử.",
    )

    args = parser.parse_args(argv)

    try:
        if args.lenh == "nguon":
            _in_nguon()
        elif args.lenh == "thong-ke":
            _in_thong_ke()
        elif args.lenh == "seed":
            _seed()
        elif args.lenh == "cong-khai":
            from . import edu_docs_job

            edu_docs_job.run()
        elif args.lenh == "cong-khai-thong-ke":
            from . import edu_docs_job

            edu_docs_job.in_thong_ke()
        elif args.lenh == "cong-khai-do":
            from . import edu_docs_probe

            edu_docs_probe.run(gioi_han=args.gioi_han)
        elif args.lenh == "cong-khai-ke-hoach":
            from . import edu_docs_probe

            edu_docs_probe.in_ke_hoach()
        elif args.lenh == "cong-khai-boc-so":
            from . import bm18_job

            bm18_job.run()
        elif args.lenh == "thu-thap":
            from . import collect

            sources, _ = _nguon_dang_dung()
            stats = collect.run(
                lay_toan_van=not args.nhanh,
                gioi_han_boc=args.gioi_han,
                sources=sources,
            )
            collect.in_tong_ket(stats)
    except CrawlerError as loi:
        print(f"Lỗi cấu hình: {loi}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
