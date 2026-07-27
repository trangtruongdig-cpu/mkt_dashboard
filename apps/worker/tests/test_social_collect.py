"""Kiểm tra phần logic thuần của mảng lắng nghe: sinh khoá, ẩn danh, lọc từ khoá.

Không gọi mạng. Mọi thứ ở đây phải chạy được trên máy không có Internet.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from crawler.settings import BrandKeywords, Keyword
from social.collect import author_ref, build_mention, mention_key
from social.settings import SOCIAL_SOURCES_PATH, SocialError, SocialSources, YoutubeSource
from social.sources import SocialItem
from social.sources.reddit import _thanh_van_ban
from social.sources.youtube import CHI_PHI, Quota, QuotaExhausted, la_kenh_hoc_vien

KEYWORDS = BrandKeywords(
    search_terms=["PTIT tuyển sinh"],
    match_keywords=[
        Keyword(text="Học viện Công nghệ Bưu chính Viễn thông", mode="substring"),
        Keyword(text="PTIT", mode="token"),
    ],
    owned_sources=["ptit.edu.vn"],
)


def item(**ghi_de: object) -> SocialItem:
    mac_dinh: dict[str, object] = {
        "platform": "youtube",
        "source_name": "youtube",
        "content_type": "comment",
        "native_id": "UgxABC",
        "body_text": "Học phí PTIT năm nay bao nhiêu vậy mọi người",
        "discovered_via": "youtube:comment",
        "published_at": datetime(2026, 7, 1, tzinfo=UTC),
    }
    return SocialItem(**{**mac_dinh, **ghi_de})  # type: ignore[arg-type]


# --- Khoá tự nhiên ------------------------------------------------------------


def test_khoa_on_dinh_giua_cac_lan_chay() -> None:
    assert mention_key("youtube", "abc") == mention_key("youtube", "abc")


def test_cung_id_khac_nen_tang_ra_khoa_khac() -> None:
    """Reddit dùng 't3_abc', YouTube dùng chuỗi 11 ký tự — không có gì bảo đảm chúng
    không đụng nhau về sau, nên nền tảng phải nằm trong khoá."""
    assert mention_key("youtube", "abc") != mention_key("reddit", "abc")


# --- Ẩn danh tác giả ----------------------------------------------------------


def test_an_danh_giu_duoc_tinh_on_dinh() -> None:
    """Băm ổn định thì vẫn phát hiện được một tài khoản đăng nhiều lần — thứ cần cho việc
    nhận diện chiến dịch bôi nhọ có tổ chức — mà không giữ dữ liệu định danh cá nhân."""
    a, da_bam = author_ref(item(author_id="UC123", author_name="Nguyễn Văn A"), an_danh=True)
    b, _ = author_ref(item(author_id="UC123", author_name="Tên đã đổi"), an_danh=True)

    assert da_bam is True
    assert a == b
    assert a is not None and a.startswith("anon:")
    assert "Nguyễn Văn A" not in a


def test_khong_an_danh_thi_luu_ten_hien_thi() -> None:
    gia_tri, da_bam = author_ref(item(author_id="UC123", author_name="Nguyễn Văn A"), an_danh=False)
    assert (gia_tri, da_bam) == ("Nguyễn Văn A", False)


def test_khong_co_tac_gia_thi_de_trong() -> None:
    gia_tri, _ = author_ref(item(author_id=None, author_name=None), an_danh=True)
    assert gia_tri is None


def test_kenh_dang_video_khong_bi_bam() -> None:
    """Kênh YouTube là nhà xuất bản, tương đương cột `publisher` của bảng tin bài — băm nó
    thì không tách được video Học viện tự đăng khỏi video người ngoài làm."""
    gia_tri, da_bam = author_ref(
        item(content_type="video", author_id="UC123", author_name="PTIT Official"),
        an_danh=True,
    )
    assert (gia_tri, da_bam) == ("PTIT Official", False)


def test_nguoi_binh_luan_duoi_video_van_bi_bam() -> None:
    _, da_bam = author_ref(item(content_type="comment", author_id="UC456"), an_danh=True)
    assert da_bam is True


# --- Dựng bản ghi -------------------------------------------------------------


def test_binh_luan_tro_ve_bai_cha() -> None:
    ban_ghi = build_mention(item(parent_native_id="video1"), KEYWORDS, an_danh=True)
    assert ban_ghi.parent_key == mention_key("youtube", "video1")


def test_bai_goc_khong_co_cha() -> None:
    assert build_mention(item(), KEYWORDS, an_danh=True).parent_key is None


def test_ghi_lai_tu_khoa_thuc_su_tim_thay() -> None:
    ban_ghi = build_mention(item(), KEYWORDS, an_danh=True)
    assert ban_ghi.matched_keywords == ["PTIT"]


def test_binh_luan_khong_nhac_ten_van_ghi_voi_tu_khoa_rong() -> None:
    """ "Trường này học nặng lắm" dưới video tuyển sinh PTIT là ý kiến về PTIT dù không có
    chữ nào khớp. Bỏ những câu này đi là đánh rơi phần lớn nội dung cần nghe."""
    ban_ghi = build_mention(item(body_text="Trường này học nặng lắm"), KEYWORDS, an_danh=True)
    assert ban_ghi.matched_keywords == []
    assert ban_ghi.body_chars == len("Trường này học nặng lắm")


def test_kenh_cua_hoc_vien_duoc_danh_dau() -> None:
    assert build_mention(item(is_owned=True), KEYWORDS, an_danh=True).is_owned is True


def test_bai_tren_ten_mien_cua_hoc_vien_duoc_danh_dau() -> None:
    ban_ghi = build_mention(
        item(platform="forum", source_name="ptit.edu.vn", url="https://portal.ptit.edu.vn/x"),
        KEYWORDS,
        an_danh=True,
    )
    assert ban_ghi.is_owned is True


# --- Nhận diện kênh của Học viện ----------------------------------------------

CAU_HINH_YT = YoutubeSource(
    enabled=True,
    so_video_moi_tu_khoa=25,
    so_binh_luan_moi_video=200,
    so_ngay_nhin_lai=365,
    han_muc_don_vi_moi_lan_chay=9000,
    kenh_cua_hoc_vien=["UCabc123", "Học viện Công nghệ Bưu chính Viễn thông"],
)


def test_nhan_kenh_theo_id() -> None:
    assert la_kenh_hoc_vien("UCabc123", "Tên bất kỳ", CAU_HINH_YT) is True


def test_nhan_kenh_theo_ten_bo_qua_hoa_thuong() -> None:
    """Không ai gõ lại tên kênh y hệt từng chữ hoa."""
    assert la_kenh_hoc_vien("UCkhac", "HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG", CAU_HINH_YT)


def test_kenh_nguoi_ngoai_khong_bi_nhan_nham() -> None:
    assert la_kenh_hoc_vien("UCxyz", "Review Đại Học", CAU_HINH_YT) is False


def test_kenh_khong_ten_khong_khop_bua() -> None:
    """Kênh thiếu tên không được khớp với một khai báo bất kỳ chỉ vì cả hai đều rỗng."""
    assert la_kenh_hoc_vien("UCxyz", "", CAU_HINH_YT) is False


# --- Hạn mức YouTube ----------------------------------------------------------


def test_han_muc_dung_truoc_khi_google_dung_ho() -> None:
    quota = Quota(tran=CHI_PHI["search"] + 1)
    quota.tieu("search")
    quota.tieu("videos")
    with pytest.raises(QuotaExhausted):
        quota.tieu("videos")


def test_han_muc_khong_cho_tieu_qua_tran() -> None:
    quota = Quota(tran=50)
    with pytest.raises(QuotaExhausted):
        quota.tieu("search")
    assert quota.da_tieu == 0


# --- Bóc văn bản Reddit -------------------------------------------------------


def test_go_the_html_ve_van_ban_thuan() -> None:
    """Reddit trả thân bài dưới dạng HTML đã escape hai lần."""
    goc = (
        "&lt;!-- SC_OFF --&gt;&lt;div class=&quot;md&quot;&gt;"
        "&lt;p&gt;Học PTIT có ổn không?&lt;/p&gt;&lt;/div&gt;"
    )
    assert "Học PTIT có ổn không?" in _thanh_van_ban(goc)
    assert "<" not in _thanh_van_ban(goc)


def test_giu_dau_tieng_viet_khi_go_the() -> None:
    assert _thanh_van_ban("<p>Bưu chính Viễn thông</p>") == "Bưu chính Viễn thông"


# --- Cấu hình -----------------------------------------------------------------


def test_file_cau_hinh_trong_repo_doc_duoc() -> None:
    """File mẫu trong repo phải luôn nạp được — hội đồng nghiệm thu dựng lại từ repo."""
    sources = SocialSources.load()
    assert sources.youtube.enabled
    assert sources.an_danh_tac_gia is True
    assert {f.name for f in sources.dien_dan} >= {"tinhte", "voz"}


def test_so_am_bi_tu_choi(tmp_path: Path) -> None:
    duong_dan = tmp_path / "sai.json"
    duong_dan.write_text('{"youtube": {"enabled": true, "so_video_moi_tu_khoa": 0}}')
    with pytest.raises(SocialError, match="phải lớn hơn 0"):
        SocialSources.load(duong_dan)


def test_khong_nguon_nao_bat_thi_bao_loi(tmp_path: Path) -> None:
    duong_dan = tmp_path / "tat.json"
    duong_dan.write_text('{"youtube": {"enabled": false}, "reddit": {"enabled": false}}')
    with pytest.raises(SocialError, match="không có nguồn nào đang bật"):
        SocialSources.load(duong_dan)


def test_ten_dien_dan_trung_bi_tu_choi(tmp_path: Path) -> None:
    duong_dan = tmp_path / "trung.json"
    duong_dan.write_text(
        '{"reddit": {"enabled": true}, "dien_dan": ['
        '{"name": "a", "domain": "x.vn"}, {"name": "a", "domain": "y.vn"}]}'
    )
    with pytest.raises(SocialError, match="trùng"):
        SocialSources.load(duong_dan)


def test_duong_dan_cau_hinh_nam_canh_cac_file_khac() -> None:
    assert SOCIAL_SOURCES_PATH.name == "social-sources.json"
    assert SOCIAL_SOURCES_PATH.exists()
