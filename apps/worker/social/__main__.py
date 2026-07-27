"""
Lắng nghe mạng xã hội — người NGOÀI nói gì về Học viện.

Khác với `crawler` (báo chí viết về Học viện) và `ingest` (dữ liệu kênh của chính Học viện),
gói này thu ý kiến của người dùng thường: bình luận YouTube, bài đăng Reddit, chủ đề diễn đàn.

    uv run python -m social nguon                     # nguồn và hạn mức đang cấu hình
    uv run python -m social thu-thap                  # chạy mọi nguồn đang bật
    uv run python -m social thu-thap --nguon reddit   # chạy thử một nguồn
    uv run python -m social thu-thap --gioi-han 10    # chỉ tải 10 chủ đề diễn đàn
    uv run python -m social thong-ke                  # xem những gì đã có trong kho

Reddit chạy được ngay, không cần khoá. YouTube cần YOUTUBE_API_KEY và diễn đàn cần
GOOGLE_CSE_KEY + GOOGLE_CSE_CX — đều miễn phí, tạo trong Google Cloud Console. Thiếu khoá
nào thì nguồn đó tự bỏ qua kèm cảnh báo ở cuối, các nguồn còn lại vẫn chạy bình thường.
"""

from __future__ import annotations

import argparse
import sys

from crawler.matching import normalize_text
from crawler.settings import BrandKeywords, CrawlerError, StoreSettings

from .settings import GOOGLE_CSE_CX, GOOGLE_CSE_KEY, YOUTUBE_API_KEY, SocialSources


def _in_nguon() -> None:
    keywords = BrandKeywords.load()
    sources = SocialSources.load()

    print("Từ khoá tìm kiếm (dùng chung với crawler báo chí):")
    for t in keywords.search_terms:
        print(f"  · {t}")

    yt = sources.youtube
    co_khoa = "đã có" if YOUTUBE_API_KEY else "CHƯA CÓ — nguồn sẽ bị bỏ qua"
    so_tu_khoa = len(keywords.search_terms)
    print("\nYouTube:")
    print(f"  · trạng thái            {'bật' if yt.enabled else 'TẮT'}")
    print(f"  · khoá API              {co_khoa}")
    print(f"  · video mỗi từ khoá     {yt.so_video_moi_tu_khoa}")
    print(f"  · bình luận mỗi video   {yt.so_binh_luan_moi_video}")
    print(f"  · nhìn lại              {yt.so_ngay_nhin_lai} ngày")
    print(f"  · trần hạn mức mỗi lần  {yt.han_muc_don_vi_moi_lan_chay} / 10000 đơn vị mỗi ngày")
    print(f"  · bước tìm kiếm tiêu    ~{so_tu_khoa * 100} đơn vị ({so_tu_khoa} từ khoá × 100)")
    print(f"  · kênh của Học viện     {', '.join(yt.kenh_cua_hoc_vien) or 'chưa khai báo'}")

    rd = sources.reddit
    pham_vi = ", ".join("r/" + s for s in rd.subreddits) or "toàn Reddit"
    print("\nReddit:")
    print(f"  · trạng thái            {'bật' if rd.enabled else 'TẮT'}")
    print(f"  · phạm vi               {pham_vi}")
    print(f"  · bài mỗi từ khoá       {rd.so_bai_moi_tu_khoa}")

    bat = sources.enabled_forums()
    co_cse = "đã có" if (GOOGLE_CSE_KEY and GOOGLE_CSE_CX) else "CHƯA CÓ — nguồn sẽ bị bỏ qua"
    print(f"\nDiễn đàn ({len(bat)} bật / {len(sources.dien_dan)} khai báo):")
    print(f"  · khoá Custom Search    {co_cse}")
    for f in sources.dien_dan:
        trang_thai = "bật" if f.enabled else "TẮT"
        print(f"  · {f.name:<12} {trang_thai:<5} {f.domain:<16} {f.pages} trang × 10 kết quả")
    print(f"  · tiêu ~{sum(f.pages for f in bat) * so_tu_khoa} truy vấn / 100 miễn phí mỗi ngày")

    an_danh = "ẩn danh bằng mã băm" if sources.an_danh_tac_gia else "LƯU TÊN THẬT"
    print(f"\nTác giả bình luận: {an_danh}")

    store = StoreSettings.from_env()
    dich = (
        store.duckdb_path
        if store.kind == "duckdb"
        else f"{store.postgres_host}/{store.postgres_db}"
    )
    print(f"Kho ghi vào: {store.kind} → {dich}")


def _in_thong_ke() -> None:
    from .storage import open_store

    store = open_store()
    try:
        tong = store.count()
        print(f"Tổng số bản ghi trong kho: {tong}")
        if tong == 0:
            print("Kho rỗng — chạy `uv run python -m social thu-thap` trước.")
            return

        def _in_bang(tieu_de: str, dong: list[tuple[str, int]]) -> None:
            print(f"\n{tieu_de}")
            for khoa, so in dong:
                print(f"  {khoa:<34} {so:>5}")

        _in_bang("Theo nền tảng:", store.group_count("platform"))
        _in_bang("Theo hạt dữ liệu:", store.group_count("content_type"))
        _in_bang("10 nguồn nhiều thảo luận nhất:", store.group_count("source_name", limit=10))
        _in_bang("Theo cách phát hiện:", store.group_count("discovered_via"))
        # EXTRACT chạy được trên cả DuckDB lẫn PostgreSQL; hàm year() thì chỉ DuckDB có.
        _in_bang(
            "Số bản ghi theo năm đăng:",
            store.group_count("EXTRACT(YEAR FROM published_at)", theo_khoa=True),
        )
        _in_bang(
            "Do kênh của Học viện đăng hay người ngoài:",
            [
                ("người ngoài nói" if k in ("false", "False", "0") else "kênh của Học viện", v)
                for k, v in store.group_count("is_owned")
            ],
        )
    finally:
        store.close()


def _in_kenh() -> None:
    """Liệt kê kênh đang nói về Học viện, kèm dấu cho kênh đã khai là của Học viện.

    Đây là bước để điền `kenh_cua_hoc_vien` trong social-sources.json: chưa khai thì mọi
    video do chính Học viện đăng đều bị đếm thành "người ngoài nói", làm phồng số liệu.
    """
    from .storage import open_store

    store = open_store()
    try:
        if store.count() == 0:
            print("Kho rỗng — chạy `uv run python -m social thu-thap` trước.")
            return

        da_khai = {normalize_text(k) for k in SocialSources.load().youtube.kenh_cua_hoc_vien}
        print("Kênh / nguồn nói về Học viện nhiều nhất:\n")
        print(f"  {'bản ghi':>8}  {'đã khai là của HV':<18} kênh")
        for ten, so in store.group_count("source_name", limit=25):
            dau = "✓ owned" if normalize_text(ten) in da_khai else ""
            print(f"  {so:>8}  {dau:<18} {ten}")

        print(
            "\nChép tên kênh của Học viện vào `youtube.kenh_cua_hoc_vien` trong "
            "config/social-sources.json.\nNhận cả id kênh (UCxxxx, ổn định hơn) lẫn tên kênh."
        )
    finally:
        store.close()


def _kiem_tra_khoa() -> None:
    """Gọi thử từng API bằng lệnh rẻ nhất và nói rõ khoá nào dùng được cho việc gì.

    Có lệnh này thì không phải chạy cả mẻ thu thập mới biết khoá sai — và hội đồng nghiệm
    thu dựng lại hệ thống cũng tự kiểm chứng được cấu hình mà không cần đọc mã nguồn.
    """
    import requests

    from .sources.google_api import mo_ta_loi

    def _che(khoa: str) -> str:
        return f"{khoa[:10]}…{khoa[-4:]}" if khoa else "TRỐNG"

    print(f"Khoá YouTube      : {_che(YOUTUBE_API_KEY)}")
    print(f"Khoá Custom Search: {_che(GOOGLE_CSE_KEY)}")
    print(f"Mã engine (cx)    : {GOOGLE_CSE_CX or 'TRỐNG'}\n")

    # videos.list tốn 1 đơn vị, rẻ hơn search.list 100 lần. Id là video công khai bất kỳ.
    phep_thu = [
        (
            "YouTube Data API v3",
            "https://www.googleapis.com/youtube/v3/videos",
            {"key": YOUTUBE_API_KEY, "part": "id", "id": "dQw4w9WgXcQ"},
            bool(YOUTUBE_API_KEY),
        ),
        (
            "Custom Search API",
            "https://www.googleapis.com/customsearch/v1",
            {"key": GOOGLE_CSE_KEY, "cx": GOOGLE_CSE_CX, "q": "test"},
            bool(GOOGLE_CSE_KEY and GOOGLE_CSE_CX),
        ),
    ]

    for ten, url, tham_so, du_cau_hinh in phep_thu:
        if not du_cau_hinh:
            print(f"  {ten:<22} — bỏ qua, chưa đủ cấu hình")
            continue
        try:
            phan_hoi = requests.get(url, params=tham_so, timeout=25)
        except requests.RequestException as loi:
            print(f"  {ten:<22} ✗ không gọi được: {type(loi).__name__}")
            continue

        if phan_hoi.status_code == 200:
            print(f"  {ten:<22} ✓ dùng được")
        else:
            print(f"  {ten:<22} ✗ {phan_hoi.status_code}: {mo_ta_loi(phan_hoi)}")

    print(
        "\n'This project does not have the access' nói về project SỞ HỮU KHOÁ, không phải\n"
        "project đang mở trên màn hình. Một API bật ở project A không giúp gì cho khoá của\n"
        "project B. Kiểm tra khoá nằm ở đâu: APIs & Services → Credentials, nhớ chọn đúng\n"
        "project ở thanh trên cùng."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="social", description="Thu thập thảo luận của người ngoài về Học viện"
    )
    sub = parser.add_subparsers(dest="lenh", required=True)

    sub.add_parser("nguon", help="Liệt kê nguồn, hạn mức và từ khoá đang cấu hình")
    sub.add_parser("thong-ke", help="Thống kê dữ liệu đã có trong kho")
    sub.add_parser("kenh", help="Liệt kê kênh/nguồn nói nhiều nhất, để điền owned media")
    sub.add_parser("kiem-tra-khoa", help="Gọi thử từng API, xem khoá nào dùng được")

    p_thu = sub.add_parser("thu-thap", help="Thu thập và ghi vào kho")
    p_thu.add_argument(
        "--nguon",
        choices=("youtube", "reddit", "forum"),
        default=None,
        help="Chỉ chạy một nguồn. Để trống thì chạy mọi nguồn đang bật.",
    )
    p_thu.add_argument(
        "--gioi-han",
        type=int,
        default=None,
        metavar="N",
        help="Chỉ tải nội dung tối đa N chủ đề diễn đàn. Dùng để chạy thử.",
    )

    args = parser.parse_args(argv)

    try:
        if args.lenh == "nguon":
            _in_nguon()
        elif args.lenh == "thong-ke":
            _in_thong_ke()
        elif args.lenh == "kenh":
            _in_kenh()
        elif args.lenh == "kiem-tra-khoa":
            _kiem_tra_khoa()
        elif args.lenh == "thu-thap":
            from . import collect

            stats = collect.run(chi_nguon=args.nguon, gioi_han_tai=args.gioi_han)
            collect.in_tong_ket(stats)
    except CrawlerError as loi:
        print(f"Lỗi cấu hình: {loi}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
