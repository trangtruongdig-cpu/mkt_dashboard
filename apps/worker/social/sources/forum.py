"""Diễn đàn Việt — nơi thảo luận thật nhất về điểm chuẩn, chất lượng đào tạo, việc làm.

Báo chí viết về Học viện theo góc thông cáo. Fanpage là sân nhà. Diễn đàn là chỗ duy nhất
người ngoài nói với nhau mà không cần giữ ý — chính là dữ liệu mảng lắng nghe đang thiếu.

Hai bước, vì diễn đàn Việt không có API tìm kiếm công khai:

  1. Hỏi Google Programmable Search (Custom Search JSON API) xem chủ đề nào trên tên miền
     đó có nhắc đến thương hiệu.
  2. Tải trang chủ đề về và bóc nội dung bằng news-please — có kiểm tra robots.txt trước.

Vì sao không dùng lại feed RSS của Bing như crawler báo chí: ĐÃ THỬ VÀ KHÔNG DÙNG ĐƯỢC.
Endpoint `bing.com/search?format=RSS` bỏ qua toán tử `site:` lẫn dấu ngoặc kép — hỏi
`site:tinhte.vn PTIT` thì nó trả về trang chủ ptit.edu.vn và vnpt.com.vn. Feed RSS của
chính diễn đàn cũng không thay thế được: tinhte.vn trả 403 cho `/forums/-/index.rss`,
webtretho.vn là ứng dụng Next.js không có RSS. Google Custom Search là đường chính thức
duy nhất tôn trọng ràng buộc tên miền, và hạn mức miễn phí 100 truy vấn/ngày là đủ dùng.

Hạt dữ liệu là CHỦ ĐỀ, không phải từng bài trả lời: mỗi diễn đàn có cấu trúc HTML riêng,
tách từng bài trả lời đòi hỏi một bộ quy tắc cho mỗi trang và sẽ hỏng mỗi lần họ đổi giao
diện. Chấm sắc thái ở mức chủ đề kém tinh hơn nhưng bền, và không cần bảo trì theo trang.

Diễn đàn đứng sau Cloudflare (voz.vn) trả 403 cho mọi client không phải trình duyệt thật.
Giả mạo trình duyệt để vượt qua là lách kiểm soát truy cập — hệ thống này không làm.
Muốn có dữ liệu voz thì phải thoả thuận với ban quản trị diễn đàn.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from typing import Any
from urllib.parse import urlencode, urlparse

from crawler.extract import fetch_article
from crawler.net import get

from ..settings import GOOGLE_CSE_CX, GOOGLE_CSE_KEY, ForumSource, SocialError
from . import SocialItem
from .google_api import LY_DO_HET_HAN_MUC, ly_do_loi, mo_ta_loi

PLATFORM = "forum"

CSE_URL = "https://www.googleapis.com/customsearch/v1"

# Trần cứng của API: 10 kết quả một truy vấn, không lấy quá kết quả thứ 100.
KET_QUA_MOI_TRANG = 10
KET_QUA_TOI_DA = 100

# Trang quá ngắn gần như chắc chắn là trang chuyên mục hoặc trang chuyển hướng, không phải
# chủ đề thảo luận. news-please đã có ngưỡng riêng; đây là ngưỡng cho phần lưu kho.
MIN_THREAD_CHARS = 120


def co_cau_hinh_tim_kiem() -> bool:
    """Đủ khoá để gọi Custom Search hay chưa."""
    return bool(GOOGLE_CSE_KEY and GOOGLE_CSE_CX)


def _goi_cse(tham_so: dict[str, Any]) -> dict[str, Any]:
    """Gọi Custom Search JSON API.

    Khoá API nằm trong URL nên URL đầy đủ TUYỆT ĐỐI không được lọt vào thông báo lỗi hay
    nhật ký — mọi thông báo dưới đây chỉ nhắc mã trạng thái và lý do máy đọc được.
    """
    url = f"{CSE_URL}?" + urlencode({**tham_so, "key": GOOGLE_CSE_KEY, "cx": GOOGLE_CSE_CX})
    phan_hoi = get(url, accept="application/json")

    if phan_hoi.status_code != 200:
        raise SocialError(
            f"Custom Search trả mã {phan_hoi.status_code}: {mo_ta_loi(phan_hoi)}. "
            + (
                "Hết hạn mức 100 truy vấn/ngày — chạy lại vào hôm sau."
                if ly_do_loi(phan_hoi) in LY_DO_HET_HAN_MUC
                else "Kiểm tra đã bật 'Custom Search API' cho project trong Google Cloud "
                "Console chưa, và khoá có bị hạn chế loại API không."
            )
        )

    du_lieu: dict[str, Any] = phan_hoi.json()
    return du_lieu


def _ngay_dang(muc: dict[str, Any]) -> datetime | None:
    """Google trả ngày đăng trong metatag của trang, và thường là không có.

    Không đoán ngày từ nội dung: một chủ đề diễn đàn kéo dài nhiều năm thì "ngày" nào cũng
    sai. Để trống còn hơn ghi vào kho một mốc thời gian bịa.
    """
    thu = muc.get("pagemap", {}).get("metatags", [{}])[0]
    for khoa in ("article:published_time", "og:published_time", "datepublished"):
        gia_tri = thu.get(khoa)
        if not gia_tri:
            continue
        try:
            return datetime.fromisoformat(str(gia_tri).replace("Z", "+00:00"))
        except ValueError:
            continue
    return None


def tim_chu_de(term: str, dien_dan: ForumSource) -> list[SocialItem]:
    """Tìm chủ đề trên một diễn đàn. Chưa tải nội dung — bước đó chậm, làm riêng."""
    ket_qua: list[SocialItem] = []
    da_thay: set[str] = set()

    for trang in range(dien_dan.pages):
        bat_dau = trang * KET_QUA_MOI_TRANG + 1
        if bat_dau > KET_QUA_TOI_DA:
            break

        du_lieu = _goi_cse(
            {
                "q": term,
                # siteSearch + siteSearchFilter=i là ràng buộc tên miền ở phía máy chủ,
                # chắc chắn hơn toán tử `site:` gõ trong câu truy vấn.
                "siteSearch": dien_dan.domain,
                "siteSearchFilter": "i",
                "num": KET_QUA_MOI_TRANG,
                "start": bat_dau,
                "lr": "lang_vi",
            }
        )

        muc = du_lieu.get("items", [])
        for m in muc:
            url = str(m.get("link", "") or "")
            tieu_de = str(m.get("title", "") or "").strip()
            if not url.startswith(("http://", "https://")) or not tieu_de or url in da_thay:
                continue
            if not _dung_ten_mien(url, dien_dan.domain):
                continue

            da_thay.add(url)
            ket_qua.append(
                SocialItem(
                    platform=PLATFORM,
                    source_name=dien_dan.domain,
                    content_type="thread",
                    # URL là định danh ổn định duy nhất mà bước tìm kiếm biết được.
                    native_id=url,
                    url=url,
                    title=tieu_de,
                    body_text=f"{tieu_de}\n{m.get('snippet', '')}".strip(),
                    published_at=_ngay_dang(m),
                    discovered_via=f"forum:{dien_dan.name}",
                    search_term=term,
                )
            )

        if len(muc) < KET_QUA_MOI_TRANG:
            break

    return ket_qua


def _dung_ten_mien(url: str, domain: str) -> bool:
    """Khớp theo biên tên miền: "tinhte.vn" nhận cả "www.tinhte.vn" nhưng không nhận
    "khongphaitinhte.vn"."""
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return host == domain or host.endswith(f".{domain}")


def tai_noi_dung(item: SocialItem) -> SocialItem:
    """Tải trang chủ đề và thay phần thân bằng nội dung thật.

    Không ném lỗi: một chủ đề tải hỏng (Cloudflare chặn, chủ đề đã xoá, robots.txt cấm)
    không được làm dừng cả mẻ. Giữ lại bản ghi với tiêu đề và đoạn trích từ Google để lần
    chạy sau vá tiếp — bảng thô cập nhật nội dung khi lần sau lấy được nhiều chữ hơn.
    """
    if not item.url:
        return item

    bai = fetch_article(item.url)
    if bai.status != "ok" or len(bai.body_text) < MIN_THREAD_CHARS:
        return item

    return replace(
        item,
        body_text=f"{item.title}\n{bai.body_text}".strip(),
        published_at=bai.published_at or item.published_at,
    )
