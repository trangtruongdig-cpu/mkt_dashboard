"""Kiểm tra chuẩn hoá URL và đối chiếu từ khoá — chạy được offline, không gọi mạng."""

from __future__ import annotations

from crawler.matching import (
    canonical_url,
    find_keywords,
    is_owned_source,
    mention_key,
    publisher_from_url,
)
from crawler.settings import BrandKeywords, Keyword, MediaSources

_TU_KHOA_FILE = BrandKeywords.load()
TU_KHOA = _TU_KHOA_FILE.match_keywords
OWNED = _TU_KHOA_FILE.owned_sources


def test_bo_tham_so_theo_doi() -> None:
    """Cùng một bài chia sẻ qua Facebook phải ra cùng một URL chuẩn."""
    goc = "https://vnexpress.net/bai-viet-123.html"
    assert canonical_url(f"{goc}?fbclid=abc&utm_source=facebook") == goc


def test_giu_tham_so_co_nghia() -> None:
    """Chỉ được bỏ tham số theo dõi. Bỏ nhầm tham số phân trang là mất bài."""
    url = "https://giaoduc.net.vn/tin.html?page=2"
    assert "page=2" in canonical_url(url)


def test_bo_neo_va_dau_gach_cuoi() -> None:
    assert canonical_url("https://PTIT.edu.vn/tin-tuc/#noi-dung") == "https://ptit.edu.vn/tin-tuc"


def test_url_hong_tra_ve_nguyen_van() -> None:
    assert canonical_url("khong-phai-url") == "khong-phai-url"


def test_publisher_bo_www() -> None:
    assert publisher_from_url("https://www.24h.com.vn/bai.html") == "24h.com.vn"


def test_khoa_on_dinh_giua_hai_lan_chay() -> None:
    """Nền tảng của tính idempotent: cùng đầu vào phải cho cùng khoá."""
    a = mention_key("https://vnexpress.net/x.html?fbclid=1", "Tiêu đề", "VnExpress")
    b = mention_key("https://vnexpress.net/x.html", "Tiêu đề khác hẳn", "Báo khác")
    assert a == b, "có URL thì khoá phải tính theo URL, không phụ thuộc tiêu đề"


def test_khoa_khi_khong_co_url() -> None:
    """Bài từ Google News không có URL — khoá tính theo báo + tiêu đề."""
    a = mention_key(None, "Điểm chuẩn PTIT năm 2026", "VietNamNet")
    b = mention_key(None, "  Điểm chuẩn PTIT năm 2026  ", "VietNamNet")
    khac = mention_key(None, "Điểm chuẩn PTIT năm 2026", "Tuổi Trẻ")

    assert a == b, "khoảng trắng thừa không được tạo ra bản ghi mới"
    assert a != khac, "hai báo đăng cùng tin là hai lần xuất hiện khác nhau"


def test_khop_ten_day_du() -> None:
    assert "Học viện Công nghệ Bưu chính Viễn thông" in find_keywords(
        "Điểm chuẩn Học viện Công nghệ Bưu chính Viễn thông năm 2026", TU_KHOA
    )


def test_khop_khong_phan_biet_hoa_thuong() -> None:
    assert find_keywords("học viện công nghệ bưu chính viễn thông", TU_KHOA)


def test_ptit_phai_dung_rieng_thanh_mot_tu() -> None:
    """PTIT là từ viết tắt ngắn — khớp chuỗi con sẽ nuốt cả những từ chứa nó ngẫu nhiên."""
    assert "PTIT" in find_keywords("Sinh viên PTIT giành giải nhất", TU_KHOA)
    assert "PTIT" in find_keywords("Trường (PTIT) thông báo", TU_KHOA)
    assert "PTIT" not in find_keywords("Công ty COMPTITION tuyển dụng", TU_KHOA)


def test_tin_khong_lien_quan_thi_khong_khop() -> None:
    """Ngoài nhóm sáu trường đối sánh thì không khớp.

    Trước đây bài kiểm này dùng Bách khoa Hà Nội làm ví dụ "không liên quan". Từ khi
    bộ từ khoá phủ cả nhóm đối sánh để tính thị phần thảo luận, Bách khoa nằm TRONG
    phạm vi — nên ví dụ phải đổi sang một trường ngoài nhóm.
    """
    assert find_keywords("Đại học Y Hà Nội công bố điểm chuẩn", TU_KHOA) == []


def test_khop_ca_truong_doi_sanh() -> None:
    """Không khớp trường đối sánh thì kho chỉ có bài về Học viện, thị phần luôn bằng 100%."""
    assert find_keywords("Đại học Bách khoa Hà Nội công bố điểm chuẩn", TU_KHOA) != []


def test_khong_tra_ve_tu_khoa_trung() -> None:
    nhieu_lan = "PTIT và PTIT và PTIT"
    assert find_keywords(nhieu_lan, TU_KHOA).count("PTIT") == 1


def test_giu_thu_tu_khai_bao() -> None:
    kw = [Keyword("alpha", "substring"), Keyword("beta", "substring")]
    assert find_keywords("beta rồi alpha", kw) == ["alpha", "beta"]


def test_bao_ngoai_la_earned_media() -> None:
    assert is_owned_source("https://vnexpress.net/bai.html", "VnExpress", OWNED) is False


def test_cong_thong_tin_hoc_vien_la_owned_media() -> None:
    """Thông cáo Học viện tự đăng không được đếm là báo chí viết về Học viện."""
    assert is_owned_source("https://ptit.edu.vn/tin-tuc.html", "ptit.edu.vn", OWNED) is True


def test_ten_mien_con_cung_la_owned() -> None:
    assert is_owned_source("https://portal.ptit.edu.vn/tin.html", "portal.ptit.edu.vn", OWNED)


def test_khong_nham_ten_mien_chi_trung_duoi() -> None:
    """Khớp phải theo biên tên miền, không phải khớp chuỗi con."""
    assert is_owned_source(
        "https://khongphaiptit.edu.vn/a.html", "khongphaiptit.edu.vn", OWNED
    ) is (False)


def test_nhan_dien_owned_qua_ten_nguon_khi_khong_co_url() -> None:
    """Bài từ Google News không có URL — chỉ còn tên nguồn để đối chiếu."""
    assert is_owned_source(None, "PTIT", OWNED) is True
    assert is_owned_source(None, "VietNamNet", OWNED) is False


def test_cau_hinh_co_khai_bao_kenh_so_huu() -> None:
    assert OWNED, "thiếu owned_sources thì owned media bị đếm lẫn vào earned media"


def test_cau_hinh_nguon_hop_le() -> None:
    sources = MediaSources.load()
    assert sources.enabled_engines(), "phải có ít nhất một công cụ tìm kiếm đang bật"
    assert sources.enabled_feeds(), "phải có ít nhất một feed RSS đang bật"
    for feed in sources.rss_feeds:
        assert feed.url.startswith("https://"), feed.name
