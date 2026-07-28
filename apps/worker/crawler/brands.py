"""
Gán nhãn thương hiệu cho tin bài — nền của chỉ số THỊ PHẦN THẢO LUẬN.

Kho tin bài trước đây chỉ chứa bài về Học viện, nên "thị phần" không có mẫu số. Module
này khai từ khoá của cả sáu trường rồi suy ra mỗi bài nhắc tới trường nào.

Cạm bẫy đã gặp thật, và là lý do mọi từ khoá ở đây phải ĐẶC TRƯNG: đối chiếu ngây thơ
bằng cụm "Công nghệ Thông tin" cho ra 33 trên 479 bài "nhắc tới UIT", trong khi phần
lớn chúng nói về NGÀNH công nghệ thông tin của chính Học viện. Một mẫu số sai kiểu đó
làm thị phần của Học viện tụt xuống mà không ai hiểu vì sao.

Phần trong file này là hàm thuần trên chuỗi — không đọc kho, không gọi mạng.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .matching import find_keywords
from .settings import KEYWORDS_PATH, CrawlerError, Keyword, read_json

# Khoá của chính Học viện. Đặt ở đây để nơi khác khỏi viết chuỗi "ptit" rải rác.
US_BRAND_KEY = "ptit"


@dataclass(frozen=True)
class BrandMatcher:
    key: str
    label: str
    search_terms: list[str]
    match_keywords: list[Keyword]


@dataclass(frozen=True)
class BrandMatchers:
    """Bộ đối chiếu của cả nhóm: Học viện đứng đầu, rồi tới các trường đối sánh."""

    brands: list[BrandMatcher]

    @classmethod
    def load(cls, path: Path | None = None) -> BrandMatchers:
        du_lieu = read_json(path or KEYWORDS_PATH)

        def doc_keywords(muc: list[dict[str, str]], o_dau: str) -> list[Keyword]:
            ket_qua: list[Keyword] = []
            for m in muc:
                text = str(m.get("text", "")).strip()
                mode = str(m.get("mode", "substring")).strip()
                if not text:
                    raise CrawlerError(f"{o_dau}: có match_keywords thiếu 'text'.")
                if mode not in ("substring", "token"):
                    raise CrawlerError(
                        f"{o_dau}: mode của {text!r} phải là 'substring' hoặc 'token'."
                    )
                ket_qua.append(Keyword(text=text, mode=mode))  # type: ignore[arg-type]
            return ket_qua

        hoc_vien = BrandMatcher(
            key=US_BRAND_KEY,
            label="Học viện Công nghệ Bưu chính Viễn thông",
            search_terms=[str(t) for t in du_lieu.get("search_terms", [])],
            match_keywords=doc_keywords(du_lieu.get("match_keywords", []), "match_keywords"),
        )

        doi_sanh = [
            BrandMatcher(
                key=str(m["key"]).strip(),
                label=str(m["label"]).strip(),
                search_terms=[str(t) for t in m.get("search_terms", [])],
                match_keywords=doc_keywords(
                    m.get("match_keywords", []), f"competitors[{m.get('key')}]"
                ),
            )
            for m in du_lieu.get("competitors", [])
        ]

        brands = [hoc_vien, *doi_sanh]
        khoa = [b.key for b in brands]
        if len(set(khoa)) != len(khoa):
            raise CrawlerError("Có thương hiệu bị trùng key trong brand-keywords.json.")
        for b in brands:
            if not b.match_keywords:
                raise CrawlerError(
                    f"Thương hiệu {b.key!r} không có match_keywords — sẽ không bao giờ "
                    "được gán nhãn, và mẫu số thị phần thiếu mất nó."
                )

        return cls(brands=brands)

    def search_terms(self) -> list[str]:
        """Toàn bộ từ khoá tìm kiếm, để crawler quét cho cả nhóm chứ không riêng Học viện."""
        return [t for b in self.brands for t in b.search_terms]

    def all_match_keywords(self) -> list[Keyword]:
        return [k for b in self.brands for k in b.match_keywords]


def tag_brands(text: str, matchers: BrandMatchers) -> list[str]:
    """Những thương hiệu được nhắc trong một bài.

    Một bài nhắc nhiều trường là chuyện bình thường và ĐÚNG — bài so sánh điểm chuẩn
    nhắc cả sáu trường. Không ép mỗi bài về đúng một nhãn: làm thế là tự bịa ra
    "bài này thuộc về ai".
    """
    return [b.key for b in matchers.brands if find_keywords(text, b.match_keywords)]
