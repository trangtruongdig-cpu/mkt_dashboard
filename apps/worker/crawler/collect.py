"""Luồng chạy chính: tìm bài → lọc theo từ khoá → bóc toàn văn → ghi kho.

Quy tắc lọc khác nhau theo nguồn, và có lý do:

  Nguồn tìm kiếm (bing_news, google_news) — LUÔN ghi vào kho.
      Từ khoá tìm kiếm đã là bộ lọc rồi. Tiêu đề có thể viết tắt ("HV Công nghệ BCVT")
      nên bắt buộc khớp chuỗi sẽ đánh rơi bài thật.
  Nguồn RSS chuyên mục — CHỈ ghi khi khớp từ khoá.
      Feed giáo dục của một tờ báo mỗi ngày có hàng chục bài không liên quan gì đến
      Học viện. Không lọc thì kho thành bản sao của mục Giáo dục.

Cột `matched_keywords` ghi lại từ khoá thực sự tìm thấy (có thể rỗng). Đây là bảng thô —
việc siết thêm để loại nhiễu là của dbt, không làm ở đây.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from . import discover, extract
from .discover import MentionRef
from .matching import canonical_url, find_keywords, is_owned_source, mention_key
from .settings import BrandKeywords, MediaSources
from .storage import NewsMention, Store, now, open_store


@dataclass
class Stats:
    """Số liệu một lần chạy — in ra cuối job để biết mẻ vừa rồi có gì."""

    tim_thay: dict[str, int] = field(default_factory=dict)
    sau_khi_loc: int = 0
    bo_qua_khong_khop: int = 0
    boc_thanh_cong: int = 0
    boc_that_bai: int = 0
    khong_co_url: int = 0
    truoc_khi_ghi: int = 0
    sau_khi_ghi: int = 0

    @property
    def ban_ghi_moi(self) -> int:
        return self.sau_khi_ghi - self.truoc_khi_ghi


def discover_all(sources: MediaSources, keywords: BrandKeywords, stats: Stats) -> list[MentionRef]:
    """Gọi mọi nguồn đang bật. Một nguồn hỏng không làm dừng các nguồn còn lại."""
    tim_thay: list[MentionRef] = []

    for engine in sources.enabled_engines():
        for term in keywords.search_terms:
            try:
                if engine.name == "bing_news":
                    ket_qua = discover.from_bing_news(term, pages=engine.pages)
                else:
                    ket_qua = discover.from_google_news(term)
            except Exception as loi:  # noqa: BLE001 — nguồn ngoài, lỗi gì cũng chỉ ghi nhận rồi đi tiếp
                print(f"  ! {engine.name} lỗi với {term!r}: {type(loi).__name__}: {loi}")
                continue

            stats.tim_thay[engine.name] = stats.tim_thay.get(engine.name, 0) + len(ket_qua)
            tim_thay.extend(ket_qua)
            print(f"  {engine.name} · {term[:45]:<45} {len(ket_qua):>4} bài")

    for feed in sources.enabled_feeds():
        try:
            ket_qua = discover.from_rss(feed)
        except Exception as loi:  # noqa: BLE001
            print(f"  ! rss:{feed.name} lỗi: {type(loi).__name__}: {loi}")
            continue

        khop = [
            m for m in ket_qua if find_keywords(f"{m.title}\n{m.summary}", keywords.match_keywords)
        ]
        stats.tim_thay[f"rss:{feed.name}"] = len(khop)
        tim_thay.extend(khop)
        print(f"  rss:{feed.name:<28} {len(ket_qua):>4} bài → {len(khop)} khớp từ khoá")

    return tim_thay


def _gom_trung(refs: list[MentionRef]) -> dict[str, MentionRef]:
    """Gộp các bản ghi cùng một bài. Bản có URL thắng bản không có URL."""
    theo_khoa: dict[str, MentionRef] = {}

    for ref in refs:
        khoa = mention_key(ref.url, ref.title, ref.publisher)
        cu = theo_khoa.get(khoa)
        if cu is None or (ref.url and not cu.url):
            theo_khoa[khoa] = ref

    return theo_khoa


def build_mention(
    khoa: str, ref: MentionRef, article: extract.Article | None, keywords: BrandKeywords
) -> NewsMention:
    body = article.body_text if article else ""
    thoi_diem = now()

    return NewsMention(
        mention_key=khoa,
        url=ref.url,
        canonical_url=canonical_url(ref.url) if ref.url else None,
        title=ref.title,
        publisher=ref.publisher,
        published_at=(
            article.published_at if article and article.published_at else ref.published_at
        ),
        discovered_via=ref.discovered_via,
        search_term=ref.search_term,
        matched_keywords=find_keywords(
            f"{ref.title}\n{ref.summary}\n{body}", keywords.match_keywords
        ),
        body_text=body,
        body_chars=len(body),
        language=article.language if article else None,
        extraction_status=article.status if article else ("no_url" if not ref.url else "skipped"),
        is_owned=is_owned_source(ref.url, ref.publisher, keywords.owned_sources),
        first_seen_at=thoi_diem,
        last_seen_at=thoi_diem,
    )


def run(
    lay_toan_van: bool = True,
    gioi_han_boc: int | None = None,
    store: Store | None = None,
    sources: MediaSources | None = None,
) -> Stats:
    """Chạy một mẻ thu thập.

    `sources` để trống thì đọc từ file JSON. Khi chạy dưới quyền điều khiển của màn hình
    quản trị, phần gọi sẽ truyền vào cấu hình đã đọc từ PostgreSQL.
    """
    keywords = BrandKeywords.load()
    sources = sources or MediaSources.load()
    stats = Stats()

    print("Tìm bài trên các nguồn công khai:")
    refs = discover_all(sources, keywords, stats)

    theo_khoa = _gom_trung(refs)
    stats.sau_khi_loc = len(theo_khoa)
    print(f"\n{len(refs)} kết quả → {len(theo_khoa)} bài khác nhau sau khi gộp trùng.")

    tu_dong: Store = store or open_store()
    try:
        stats.truoc_khi_ghi = tu_dong.count()

        can_boc = [(k, r) for k, r in theo_khoa.items() if r.url]
        stats.khong_co_url = len(theo_khoa) - len(can_boc)
        if gioi_han_boc is not None:
            can_boc = can_boc[:gioi_han_boc]

        ban_ghi: list[NewsMention] = []

        if lay_toan_van and can_boc:
            print(f"\nBóc toàn văn {len(can_boc)} bài (kiểm tra robots.txt, giãn cách tên miền):")

        da_boc: set[str] = set()
        for i, (khoa, ref) in enumerate(can_boc, start=1):
            article = extract.fetch_article(ref.url) if lay_toan_van else None  # type: ignore[arg-type]
            if article is not None:
                if article.status == "ok":
                    stats.boc_thanh_cong += 1
                else:
                    stats.boc_that_bai += 1
                print(
                    f"  [{i:>3}/{len(can_boc)}] {article.status:<22} "
                    f"{ref.publisher:<20} {ref.title[:42]}",
                    flush=True,
                )
            ban_ghi.append(build_mention(khoa, ref, article, keywords))
            da_boc.add(khoa)

        ban_ghi.extend(
            build_mention(k, r, None, keywords) for k, r in theo_khoa.items() if k not in da_boc
        )

        tu_dong.upsert(ban_ghi)
        stats.sau_khi_ghi = tu_dong.count()
    finally:
        if store is None:
            tu_dong.close()

    return stats


def in_tong_ket(stats: Stats) -> None:
    print("\n" + "─" * 70)
    print(f"Bài khác nhau tìm được : {stats.sau_khi_loc}")
    print(f"Bóc được toàn văn      : {stats.boc_thanh_cong}")
    print(f"Bóc lỗi / quá ngắn     : {stats.boc_that_bai}")
    print(f"Không có URL bài gốc   : {stats.khong_co_url}  (Google News)")
    print(f"Đã có trong kho từ trước: {stats.sau_khi_loc - stats.ban_ghi_moi}")
    print(f"Bản ghi mới thêm vào   : {stats.ban_ghi_moi}")
    print(f"Tổng bản ghi trong kho : {stats.sau_khi_ghi}")
