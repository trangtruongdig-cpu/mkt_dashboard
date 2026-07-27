"""Luồng chạy chính: gọi từng nguồn → lọc theo từ khoá → ẩn danh tác giả → ghi kho.

Quy tắc lọc khác nhau theo hạt dữ liệu, và có lý do:

  Bài gốc (video YouTube, bài Reddit, chủ đề diễn đàn) — CHỈ ghi khi khớp từ khoá.
      Công cụ tìm kiếm trả về theo mức độ liên quan chứ không theo chuỗi chính xác.
      Tìm "PTIT" ra cả video về "PTIT Sports Club" ở Ấn Độ. Không lọc thì kho thành rác.
  Bình luận dưới một bài đã khớp — LUÔN ghi, kể cả khi tự nó không nhắc tên trường.
      "Trường này học nặng lắm" dưới video tuyển sinh PTIT là ý kiến về PTIT, dù không có
      chữ nào khớp từ khoá. Bỏ những câu này đi là đánh rơi phần lớn nội dung cần nghe.
      Quan hệ cha–con giữ ở cột `parent_key` để tầng dbt truy ngược được bối cảnh.

Cột `matched_keywords` ghi lại từ khoá thực sự tìm thấy (có thể rỗng). Đây là bảng thô —
việc siết thêm để loại nhiễu là của dbt, không làm ở đây.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from crawler.matching import find_keywords, is_owned_source
from crawler.settings import BrandKeywords

from .settings import SocialError, SocialSources
from .sources import SocialItem, forum, reddit, youtube
from .storage import SocialMention, Store, now, open_store


@dataclass
class Stats:
    """Số liệu một lần chạy — in ra cuối job để biết mẻ vừa rồi có gì."""

    tim_thay: dict[str, int] = field(default_factory=dict)
    bai_goc_khop: int = 0
    bai_goc_bo_qua: int = 0
    binh_luan: int = 0
    don_vi_youtube: int = 0
    truoc_khi_ghi: int = 0
    sau_khi_ghi: int = 0
    canh_bao: list[str] = field(default_factory=list)

    @property
    def ban_ghi_moi(self) -> int:
        return self.sau_khi_ghi - self.truoc_khi_ghi


def mention_key(platform: str, native_id: str) -> str:
    """Khoá tự nhiên: băm của (nền tảng, định danh gốc).

    Gộp nền tảng vào băm vì id của hai nền tảng có thể trùng nhau — Reddit dùng "t3_abc",
    YouTube dùng chuỗi 11 ký tự, không có gì bảo đảm chúng không đụng nhau về sau.
    """
    return hashlib.sha256(f"{platform}:{native_id}".encode()).hexdigest()


# Hạt dữ liệu mà "tác giả" là một NHÀ XUẤT BẢN chứ không phải một người bình luận: kênh
# YouTube đăng video, diễn đàn đăng chủ đề. Đây là thứ tương đương cột `publisher` của bảng
# tin bài, và bảng đó lưu tên báo nguyên vẹn.
#
# Băm chúng lại là vừa mất tác dụng bảo vệ (kênh là tài khoản công khai, tên hiển thị công
# khai) vừa mất thông tin cần thiết: không tách được video do chính Học viện đăng khỏi video
# người ngoài làm, nên owned media bị đếm thành thảo luận của người khác.
NHA_XUAT_BAN = frozenset({"video", "thread"})


def author_ref(item: SocialItem, an_danh: bool) -> tuple[str | None, bool]:
    """Trả về (giá trị lưu vào kho, đã băm hay chưa).

    Băm giữ được tính ổn định: cùng một tài khoản bình luận mười lần vẫn ra mười dòng cùng
    author_ref, nên vẫn phát hiện được tài khoản đăng dồn dập — thứ cần cho việc nhận diện
    chiến dịch bôi nhọ có tổ chức — mà không giữ dữ liệu định danh cá nhân trong kho.
    """
    nguon = item.author_id or item.author_name
    if not nguon:
        return None, False
    if not an_danh or item.content_type in NHA_XUAT_BAN:
        return item.author_name or item.author_id, False
    return "anon:" + hashlib.sha256(nguon.encode()).hexdigest()[:16], True


def build_mention(item: SocialItem, keywords: BrandKeywords, an_danh: bool) -> SocialMention:
    tac_gia, da_bam = author_ref(item, an_danh)
    thoi_diem = now()

    return SocialMention(
        mention_key=mention_key(item.platform, item.native_id),
        platform=item.platform,
        source_name=item.source_name,
        content_type=item.content_type,
        native_id=item.native_id,
        parent_key=(
            mention_key(item.platform, item.parent_native_id) if item.parent_native_id else None
        ),
        url=item.url,
        title=item.title,
        body_text=item.body_text,
        body_chars=len(item.body_text),
        author_ref=tac_gia,
        author_is_hashed=da_bam,
        published_at=item.published_at,
        like_count=item.like_count,
        reply_count=item.reply_count,
        view_count=item.view_count,
        matched_keywords=find_keywords(item.body_text, keywords.match_keywords),
        discovered_via=item.discovered_via,
        search_term=item.search_term,
        is_owned=item.is_owned
        or is_owned_source(item.url, item.source_name, keywords.owned_sources),
        first_seen_at=thoi_diem,
        last_seen_at=thoi_diem,
    )


def _khop_tu_khoa(item: SocialItem, keywords: BrandKeywords) -> bool:
    return bool(find_keywords(item.body_text, keywords.match_keywords))


def thu_youtube(sources: SocialSources, keywords: BrandKeywords, stats: Stats) -> list[SocialItem]:
    """Tìm video nhắc đến thương hiệu rồi kéo bình luận của những video đó."""
    cau_hinh = sources.youtube
    if not cau_hinh.co_khoa_api:
        stats.canh_bao.append(
            "YouTube: thiếu YOUTUBE_API_KEY nên đã bỏ qua — đây là nguồn quan trọng nhất "
            "của mảng lắng nghe. Tạo khoá miễn phí ở Google Cloud Console."
        )
        return []

    quota = youtube.Quota(tran=cau_hinh.han_muc_don_vi_moi_lan_chay)
    ket_qua: list[SocialItem] = []

    try:
        # Một video hay lọt vào kết quả của nhiều từ khoá. Gộp trước khi xin chi tiết,
        # nếu không sẽ trả hạn mức hai lần cho cùng một video. Giữ từ khoá đầu tiên tìm
        # ra nó để cột search_term còn truy được vì sao video này vào kho.
        term_cua_video: dict[str, str] = {}
        for term in keywords.search_terms:
            tim = youtube.tim_video(term, cau_hinh, quota)
            for vid in tim:
                term_cua_video.setdefault(vid, term)
            print(f"  youtube · {term[:45]:<45} {len(tim):>4} video")

        chi_tiet = youtube.chi_tiet_video(list(term_cua_video), quota)

        khop: list[tuple[str, SocialItem]] = []
        for video in chi_tiet:
            vid = str(video.get("id", ""))
            item = youtube.video_thanh_item(video, cau_hinh, term_cua_video.get(vid, ""))
            if _khop_tu_khoa(item, keywords):
                khop.append((item.native_id, item))
            else:
                stats.bai_goc_bo_qua += 1

        ket_qua.extend(item for _, item in khop)
        stats.tim_thay["youtube:video"] = len(khop)
        print(f"  youtube · {len(chi_tiet)} video → {len(khop)} thật sự nói về Học viện")

        if khop:
            print(f"\n  Kéo bình luận {len(khop)} video (còn {quota.con_lai} đơn vị hạn mức):")
        for i, (video_id, item) in enumerate(khop, start=1):
            binh_luan = list(
                youtube.binh_luan(video_id, item.source_name, item.author_id or "", cau_hinh, quota)
            )
            ket_qua.extend(binh_luan)
            stats.binh_luan += len(binh_luan)
            tieu_de = (item.title or "")[:48]
            print(
                f"    [{i:>3}/{len(khop)}] {len(binh_luan):>4} bình luận  {tieu_de}",
                flush=True,
            )
    except youtube.QuotaExhausted as het:
        stats.canh_bao.append(
            f"YouTube: dừng giữa chừng vì hết hạn mức ({het}). Dữ liệu đã lấy vẫn được ghi; "
            "chạy lại vào ngày hôm sau sẽ đi tiếp."
        )
    except SocialError as loi:
        stats.canh_bao.append(f"YouTube: {loi}")

    stats.don_vi_youtube = quota.da_tieu
    return ket_qua


def thu_reddit(sources: SocialSources, keywords: BrandKeywords, stats: Stats) -> list[SocialItem]:
    ket_qua: list[SocialItem] = []

    for term in keywords.search_terms:
        try:
            tim = reddit.tim_bai(term, sources.reddit)
        except Exception as loi:  # noqa: BLE001 — nguồn ngoài, lỗi gì cũng ghi nhận rồi đi tiếp
            print(f"  ! reddit lỗi với {term!r}: {type(loi).__name__}: {loi}")
            continue

        khop = [m for m in tim if _khop_tu_khoa(m, keywords)]
        stats.bai_goc_bo_qua += len(tim) - len(khop)
        ket_qua.extend(khop)
        print(f"  reddit  · {term[:45]:<45} {len(tim):>4} bài → {len(khop)} khớp")

    stats.tim_thay["reddit"] = len(ket_qua)
    return ket_qua


def thu_dien_dan(
    sources: SocialSources, keywords: BrandKeywords, stats: Stats, gioi_han_tai: int | None
) -> list[SocialItem]:
    """Tìm chủ đề trên các diễn đàn rồi tải nội dung từng chủ đề."""
    if not forum.co_cau_hinh_tim_kiem():
        stats.canh_bao.append(
            "Diễn đàn: thiếu GOOGLE_CSE_KEY hoặc GOOGLE_CSE_CX nên đã bỏ qua. Diễn đàn Việt "
            "không có API tìm kiếm công khai; Custom Search là đường chính thức duy nhất "
            "tôn trọng ràng buộc tên miền (miễn phí 100 truy vấn/ngày)."
        )
        return []

    tim_duoc: dict[str, SocialItem] = {}

    for dd in sources.enabled_forums():
        for term in keywords.search_terms:
            try:
                tim = forum.tim_chu_de(term, dd)
            except Exception as loi:  # noqa: BLE001
                print(f"  ! forum:{dd.name} lỗi với {term!r}: {type(loi).__name__}: {loi}")
                continue

            for m in tim:
                tim_duoc.setdefault(m.native_id, m)
            print(f"  {dd.name:<8}· {term[:45]:<45} {len(tim):>4} chủ đề")

    danh_sach = list(tim_duoc.values())
    stats.tim_thay["forum"] = len(danh_sach)
    if not danh_sach:
        return []

    can_tai = danh_sach if gioi_han_tai is None else danh_sach[:gioi_han_tai]
    print(f"\n  Tải nội dung {len(can_tai)} chủ đề (kiểm tra robots.txt, giãn cách tên miền):")

    day_du: list[SocialItem] = []
    for i, item in enumerate(can_tai, start=1):
        day_du.append(forum.tai_noi_dung(item))
        print(
            f"    [{i:>3}/{len(can_tai)}] {len(day_du[-1].body_text):>6} ký tự  "
            f"{(item.title or '')[:48]}",
            flush=True,
        )
    day_du.extend(danh_sach[len(can_tai) :])

    khop = [m for m in day_du if _khop_tu_khoa(m, keywords)]
    stats.bai_goc_bo_qua += len(day_du) - len(khop)
    return khop


def run(
    chi_nguon: str | None = None,
    gioi_han_tai: int | None = None,
    store: Store | None = None,
    sources: SocialSources | None = None,
) -> Stats:
    """Chạy một mẻ thu thập.

    `chi_nguon` để chạy thử từng nguồn một. Để trống thì chạy mọi nguồn đang bật.
    """
    keywords = BrandKeywords.load()
    sources = sources or SocialSources.load()
    stats = Stats()
    items: list[SocialItem] = []

    def _chay(ten: str) -> bool:
        return chi_nguon is None or chi_nguon == ten

    if sources.youtube.enabled and _chay("youtube"):
        print("YouTube — video và bình luận công khai:")
        items.extend(thu_youtube(sources, keywords, stats))

    if sources.reddit.enabled and _chay("reddit"):
        print("\nReddit — bài đăng công khai:")
        items.extend(thu_reddit(sources, keywords, stats))

    if sources.enabled_forums() and _chay("forum"):
        print("\nDiễn đàn Việt — chủ đề thảo luận:")
        items.extend(thu_dien_dan(sources, keywords, stats, gioi_han_tai))

    stats.bai_goc_khop = sum(1 for m in items if m.content_type != "comment")

    # Gộp trùng lần cuối: cùng một chủ đề có thể lọt vào kết quả của nhiều từ khoá, và
    # ON CONFLICT chỉ chống trùng giữa các lần chạy chứ không chống trùng trong một mẻ.
    theo_khoa = {mention_key(m.platform, m.native_id): m for m in items}

    tu_dong: Store = store or open_store()
    try:
        stats.truoc_khi_ghi = tu_dong.count()
        tu_dong.upsert(
            [build_mention(m, keywords, sources.an_danh_tac_gia) for m in theo_khoa.values()]
        )
        stats.sau_khi_ghi = tu_dong.count()
    finally:
        if store is None:
            tu_dong.close()

    return stats


def in_tong_ket(stats: Stats) -> None:
    print("\n" + "─" * 70)
    for ten, so in stats.tim_thay.items():
        print(f"Tìm được từ {ten:<24}: {so}")
    print(f"Bài gốc nói về Học viện   : {stats.bai_goc_khop}")
    print(f"Bài gốc lệch chủ đề, đã bỏ: {stats.bai_goc_bo_qua}")
    print(f"Bình luận thu được        : {stats.binh_luan}")
    if stats.don_vi_youtube:
        print(f"Hạn mức YouTube đã tiêu   : {stats.don_vi_youtube} / 10.000 đơn vị mỗi ngày")
    print(f"Bản ghi mới thêm vào      : {stats.ban_ghi_moi}")
    print(f"Tổng bản ghi trong kho    : {stats.sau_khi_ghi}")

    for canh_bao in stats.canh_bao:
        print(f"\n  ⚠ {canh_bao}")
