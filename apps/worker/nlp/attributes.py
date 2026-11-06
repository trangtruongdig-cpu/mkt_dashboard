"""
Gán THUỘC TÍNH THƯƠNG HIỆU cho tin bài — nền của mục tiêu truyền thông `com_attributes`.

Học viện tuyên bố nhắm ba thuộc tính: trọng điểm quốc gia, gắn với doanh nghiệp, ra
trường có việc làm. Module này trả lời cho từng bài: bài này nói tới thuộc tính nào.

ĐO THEO TỪNG THUỘC TÍNH, KHÔNG GỘP. Bài 5.1 của khung IBMC đặt mục tiêu thuộc tính
dạng cặp tăng–giữ: tăng thuộc tính đang nhắm trong khi KHÔNG giảm thuộc tính đang
mạnh. Một tỷ lệ gộp giữ nguyên 45% trong khi toàn bộ tin bài chuyển từ "trọng điểm
quốc gia" sang "việc làm" sẽ đọc ra là đạt mục tiêu, còn thực tế thương hiệu vừa đánh
đổi thuộc tính này lấy thuộc tính kia — đúng thứ mục tiêu cặp sinh ra để chặn.

VÌ SAO ĐỐI CHIẾU TỪ KHOÁ CHỨ KHÔNG PHẢI MÔ HÌNH. Phân loại thuộc tính bằng mô hình cần
một tập gán nhãn, mà hiện chưa ai gán và cũng chưa có ai để gán. Từ khoá thì tra lại
được bằng mắt: hội đồng nghiệm thu mở `config/brand-attributes.json` ra là thấy đúng
cụm nào đã sinh ra con số. Khi nào có tập gán nhãn thì thay ruột ở đây, hợp đồng giữ
nguyên.

Việc này KHÔNG chấm sắc thái — nó trả lời "bài có nói về thuộc tính đó không", không
trả lời "nói tốt hay xấu". Sắc thái đã có PhoBERT lo ở bảng riêng, và hai thứ phải
tách: một bài nói về việc làm theo hướng tiêu cực vẫn là một bài gắn thuộc tính việc
làm.

Hàm trong file này thuần trên chuỗi — không đọc kho, không gọi mạng.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from crawler.matching import find_keywords
from crawler.settings import CrawlerError, Keyword, read_json

WORKER_ROOT = Path(__file__).resolve().parent.parent
ATTRIBUTES_PATH = WORKER_ROOT / "config" / "brand-attributes.json"


@dataclass(frozen=True)
class Attribute:
    key: str
    label: str
    keywords: list[Keyword]


@dataclass(frozen=True)
class AttributeMatchers:
    attributes: list[Attribute]

    @classmethod
    def load(cls, path: Path | None = None) -> AttributeMatchers:
        du_lieu = read_json(path or ATTRIBUTES_PATH)
        muc = du_lieu.get("attributes")
        if not isinstance(muc, list) or not muc:
            raise CrawlerError("brand-attributes.json: thiếu mảng 'attributes'.")

        thuoc_tinh: list[Attribute] = []
        for a in muc:
            key = str(a.get("key", "")).strip()
            label = str(a.get("label", "")).strip()
            if not key or not label:
                raise CrawlerError("brand-attributes.json: thuộc tính thiếu 'key' hoặc 'label'.")

            tu_khoa: list[Keyword] = []
            for k in a.get("keywords", []):
                text = str(k.get("text", "")).strip()
                mode = str(k.get("mode", "substring")).strip()
                if not text:
                    raise CrawlerError(f"{key}: có từ khoá thiếu 'text'.")
                if mode not in ("substring", "token"):
                    raise CrawlerError(
                        f"{key}: mode của {text!r} phải là 'substring' hoặc 'token'."
                    )
                tu_khoa.append(Keyword(text=text, mode=mode))  # type: ignore[arg-type]

            if not tu_khoa:
                raise CrawlerError(
                    f"{key}: không có từ khoá nào, thuộc tính sẽ không bao giờ khớp."
                )

            thuoc_tinh.append(Attribute(key=key, label=label, keywords=tu_khoa))

        return cls(attributes=thuoc_tinh)

    @property
    def keys(self) -> list[str]:
        return [a.key for a in self.attributes]


@dataclass(frozen=True)
class AttributeHit:
    """Một thuộc tính khớp, kèm ĐÚNG những cụm đã làm nó khớp."""

    key: str
    matched: list[str]


def gan_thuoc_tinh(text: str, matchers: AttributeMatchers) -> list[AttributeHit]:
    """
    Thuộc tính nào xuất hiện trong bài, kèm cụm từ đã khớp.

    Trả về cả cụm đã khớp chứ không chỉ trả `True`: con số cuối cùng lên bảng điều
    khiển là tỷ lệ phần trăm, và khi ai đó hỏi "vì sao bài này được tính" thì phải chỉ
    ra được cụm chữ, không phải chỉ ra một cờ boolean.
    """
    ket_qua: list[AttributeHit] = []
    for a in matchers.attributes:
        khop = find_keywords(text, a.keywords)
        if khop:
            ket_qua.append(AttributeHit(key=a.key, matched=khop))
    return ket_qua
