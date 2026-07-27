"""YouTube Data API v3 — nguồn duy nhất có API chính thức phủ được TOÀN nền tảng.

Facebook và TikTok chỉ cho đọc dữ liệu của chính tài khoản mình sở hữu; muốn nghe cả nền
tảng thì phải là cơ sở nghiên cứu ở Mỹ/EU (TikTok Research API) hoặc qua ICPSR (Meta
Content Library). YouTube thì không: bất kỳ ai có khoá API miễn phí đều tìm được video và
bình luận công khai của người lạ. Vì vậy đây là nguồn chính của mảng lắng nghe.

Ba lệnh gọi, giá rất chênh nhau nên thứ tự gọi quyết định thu được bao nhiêu dữ liệu:

    search.list          100 đơn vị  → chỉ trả về id video
    videos.list            1 đơn vị  → chi tiết tối đa 50 video một lần
    commentThreads.list    1 đơn vị  → tối đa 100 bình luận một lần

Hạn mức mặc định 10.000 đơn vị/ngày. Tìm kiếm ngốn gần hết nếu gọi bừa, nên bước tìm chỉ
lấy id, lọc bằng từ khoá trước, rồi mới đổ đơn vị còn lại vào việc kéo bình luận.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from crawler.matching import normalize_text
from crawler.net import get

from ..settings import YOUTUBE_API_KEY, SocialError, YoutubeSource
from . import SocialItem
from .google_api import LY_DO_HET_HAN_MUC, ly_do_loi, mo_ta_loi

API_ROOT = "https://www.googleapis.com/youtube/v3"
PLATFORM = "youtube"

CHI_PHI = {"search": 100, "videos": 1, "commentThreads": 1}

# Trần cứng của API, không phải lựa chọn của ta.
TOI_DA_MOI_TRANG_SEARCH = 50
TOI_DA_MOI_TRANG_COMMENT = 100


class QuotaExhausted(RuntimeError):
    """Đã tiêu hết hạn mức cho lần chạy này. Dừng nguồn YouTube, các nguồn khác chạy tiếp."""


@dataclass
class Quota:
    """Đếm đơn vị đã tiêu. Tự dừng trước khi Google dừng hộ.

    Vượt hạn mức thật thì Google khoá tới nửa đêm giờ Thái Bình Dương — cả ngày hôm đó
    không thu được gì nữa. Tự đặt trần thấp hơn để luôn còn chỗ cho lần chạy sau.
    """

    tran: int
    da_tieu: int = 0

    def tieu(self, endpoint: str) -> None:
        gia = CHI_PHI[endpoint]
        if self.da_tieu + gia > self.tran:
            raise QuotaExhausted(
                f"đã tiêu {self.da_tieu}/{self.tran} đơn vị, không đủ cho một lệnh {endpoint}"
            )
        self.da_tieu += gia

    @property
    def con_lai(self) -> int:
        return max(0, self.tran - self.da_tieu)


def _goi(endpoint: str, tham_so: dict[str, Any], quota: Quota) -> dict[str, Any]:
    """Gọi một endpoint của YouTube Data API.

    Khoá API nằm trong URL nên URL đầy đủ TUYỆT ĐỐI không được lọt vào thông báo lỗi hay
    nhật ký — mọi thông báo dưới đây chỉ nhắc tên endpoint và mã trạng thái.
    """
    if not YOUTUBE_API_KEY:
        raise SocialError(
            "Thiếu YOUTUBE_API_KEY. Tạo khoá miễn phí trong Google Cloud Console "
            "(bật 'YouTube Data API v3'), rồi điền vào apps/worker/.env."
        )

    quota.tieu(endpoint)
    url = f"{API_ROOT}/{endpoint}?" + urlencode({**tham_so, "key": YOUTUBE_API_KEY})
    phan_hoi = get(url, accept="application/json")

    if phan_hoi.status_code != 200:
        if ly_do_loi(phan_hoi) in LY_DO_HET_HAN_MUC:
            raise QuotaExhausted(f"Google từ chối: {mo_ta_loi(phan_hoi)}")
        raise SocialError(
            f"YouTube {endpoint} trả mã {phan_hoi.status_code}: {mo_ta_loi(phan_hoi)}"
        )

    du_lieu: dict[str, Any] = phan_hoi.json()
    return du_lieu


def _thoi_diem(chuoi: str | None) -> datetime | None:
    """RFC3339 của Google luôn kết thúc bằng Z. Giữ nguyên múi giờ UTC, không quy đổi."""
    if not chuoi:
        return None
    try:
        return datetime.fromisoformat(chuoi.replace("Z", "+00:00"))
    except ValueError:
        return None


def _so(gia_tri: Any) -> int | None:
    """Chỉ số tương tác của YouTube về dưới dạng chuỗi, và vắng mặt khi tác giả tắt hiển thị."""
    if gia_tri is None:
        return None
    try:
        return int(gia_tri)
    except (TypeError, ValueError):
        return None


def tim_video(term: str, cau_hinh: YoutubeSource, quota: Quota) -> list[str]:
    """Trả về danh sách id video công khai khớp từ khoá, mới nhất trước.

    Chỉ xin `part=id` — xin thêm snippet ở đây không tốn thêm đơn vị nhưng cũng không lấy
    được mô tả đầy đủ, nên vẫn phải gọi videos.list. Giữ một đường lấy chi tiết cho gọn.
    """
    moc = (datetime.now(UTC) - timedelta(days=cau_hinh.so_ngay_nhin_lai)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    ids: list[str] = []
    page_token: str | None = None

    while len(ids) < cau_hinh.so_video_moi_tu_khoa:
        con_thieu = cau_hinh.so_video_moi_tu_khoa - len(ids)
        tham_so: dict[str, Any] = {
            "part": "id",
            "q": term,
            "type": "video",
            "order": "date",
            "maxResults": min(TOI_DA_MOI_TRANG_SEARCH, con_thieu),
            "publishedAfter": moc,
            # Thu hẹp về khán giả Việt: tìm "PTIT" toàn cầu sẽ ra video tiếng Thái, tiếng Hoa.
            "regionCode": "VN",
            "relevanceLanguage": "vi",
        }
        if page_token:
            tham_so["pageToken"] = page_token

        du_lieu = _goi("search", tham_so, quota)
        trang = [
            str(m["id"]["videoId"])
            for m in du_lieu.get("items", [])
            if isinstance(m.get("id"), dict) and m["id"].get("videoId")
        ]
        ids.extend(trang)

        page_token = du_lieu.get("nextPageToken")
        if not page_token or not trang:
            break

    return ids


def chi_tiet_video(ids: list[str], quota: Quota) -> list[dict[str, Any]]:
    """Lấy tiêu đề, mô tả, kênh và chỉ số cho tối đa 50 video mỗi lệnh gọi."""
    ket_qua: list[dict[str, Any]] = []

    for i in range(0, len(ids), 50):
        du_lieu = _goi(
            "videos",
            {"part": "snippet,statistics", "id": ",".join(ids[i : i + 50])},
            quota,
        )
        ket_qua.extend(du_lieu.get("items", []))

    return ket_qua


def la_kenh_hoc_vien(channel_id: str, channel_title: str, cau_hinh: YoutubeSource) -> bool:
    """Video này do chính Học viện đăng, hay do người ngoài làm?

    Nhận cả id kênh (UCxxxx — ổn định, nên dùng) lẫn tên kênh (dễ đọc, dễ điền tay). Tên
    so khớp sau khi chuẩn hoá dấu và chữ hoa thường, vì không ai gõ lại tên kênh y hệt.

    Phân biệt được mới tách được thảo luận của người ngoài khỏi nội dung Học viện tự đăng.
    Gộp chung là thổi phồng số liệu — đúng lỗi mà `is_owned_source` đã chặn ở bảng tin bài.
    """
    ten_can = normalize_text(channel_title)
    return any(
        khai_bao == channel_id or (ten_can and normalize_text(khai_bao) == ten_can)
        for khai_bao in cau_hinh.kenh_cua_hoc_vien
    )


def video_thanh_item(video: dict[str, Any], cau_hinh: YoutubeSource, term: str) -> SocialItem:
    snippet = video.get("snippet", {})
    thong_ke = video.get("statistics", {})
    video_id = str(video.get("id", ""))
    tieu_de = str(snippet.get("title", "")).strip()
    mo_ta = str(snippet.get("description", "")).strip()
    kenh_id = str(snippet.get("channelId") or "")
    kenh_ten = str(snippet.get("channelTitle") or "").strip()

    return SocialItem(
        platform=PLATFORM,
        # Tên kênh giữ vai trò như cột `publisher` của bảng tin bài: trả lời câu hỏi
        # "ai đang nói về Học viện nhiều nhất".
        source_name=kenh_ten or "youtube",
        content_type="video",
        native_id=video_id,
        url=f"https://www.youtube.com/watch?v={video_id}",
        title=tieu_de,
        # Gộp tiêu đề vào thân để bước đối chiếu từ khoá chỉ phải nhìn một trường.
        body_text=f"{tieu_de}\n{mo_ta}".strip(),
        author_id=kenh_id or None,
        author_name=kenh_ten or None,
        published_at=_thoi_diem(snippet.get("publishedAt")),
        like_count=_so(thong_ke.get("likeCount")),
        reply_count=_so(thong_ke.get("commentCount")),
        view_count=_so(thong_ke.get("viewCount")),
        discovered_via="youtube:search",
        search_term=term,
        is_owned=la_kenh_hoc_vien(kenh_id, kenh_ten, cau_hinh),
    )


def binh_luan(
    video_id: str, kenh: str, kenh_id: str, cau_hinh: YoutubeSource, quota: Quota
) -> Iterator[SocialItem]:
    """Kéo bình luận cấp một của một video.

    `kenh` là tên kênh chứa video — gắn vào từng bình luận để trả lời được câu hỏi
    "khán giả của kênh nào đang nói về Học viện", không phải chỉ "có ai đó nói trên YouTube".

    Bỏ qua phần trả lời lồng nhau: chúng thường là đối thoại giữa hai người xem với nhau,
    ít khi nói về thương hiệu, mà lại làm phồng số lượt nhắc đến.

    Tác giả tắt bình luận là chuyện thường — trả về rỗng chứ không làm hỏng cả mẻ.
    """
    page_token: str | None = None
    da_lay = 0

    while da_lay < cau_hinh.so_binh_luan_moi_video:
        tham_so: dict[str, Any] = {
            "part": "snippet",
            "videoId": video_id,
            "maxResults": min(TOI_DA_MOI_TRANG_COMMENT, cau_hinh.so_binh_luan_moi_video - da_lay),
            "order": "relevance",
            "textFormat": "plainText",
        }
        if page_token:
            tham_so["pageToken"] = page_token

        try:
            du_lieu = _goi("commentThreads", tham_so, quota)
        except SocialError as loi:
            # commentsDisabled / videoNotFound — video này thôi, không phải cả nguồn.
            print(f"    ! bỏ qua bình luận video {video_id}: {loi}")
            return

        muc = du_lieu.get("items", [])
        for m in muc:
            item = binh_luan_thanh_item(m, video_id, kenh, kenh_id)
            if item is not None:
                yield item
        da_lay += len(muc)

        page_token = du_lieu.get("nextPageToken")
        if not page_token or not muc:
            return


def binh_luan_thanh_item(
    thread: dict[str, Any], video_id: str, kenh: str, kenh_id: str
) -> SocialItem | None:
    top = thread.get("snippet", {}).get("topLevelComment", {})
    snippet = top.get("snippet", {})
    noi_dung = str(snippet.get("textOriginal") or "").strip()
    if not noi_dung:
        return None

    tai_khoan = snippet.get("authorChannelId") or {}
    tac_gia_id = str(tai_khoan.get("value") or "")

    return SocialItem(
        platform=PLATFORM,
        source_name=kenh or "youtube",
        content_type="comment",
        native_id=str(top.get("id") or thread.get("id") or ""),
        parent_native_id=video_id,
        url=f"https://www.youtube.com/watch?v={video_id}&lc={top.get('id', '')}",
        body_text=noi_dung,
        author_id=tac_gia_id or None,
        author_name=str(snippet.get("authorDisplayName") or "") or None,
        published_at=_thoi_diem(snippet.get("publishedAt")),
        like_count=_so(snippet.get("likeCount")),
        reply_count=_so(thread.get("snippet", {}).get("totalReplyCount")),
        discovered_via="youtube:comment",
        # Chủ kênh tự bình luận dưới video của mình — "Có thắc mắc gì hãy để lại bình luận
        # cho mình biết nhé" là lời của người làm video, không phải ý kiến của khán giả về
        # Học viện. Gắn cờ owned để tầng chấm sắc thái và dbt loại ra khỏi số liệu dư luận.
        is_owned=bool(tac_gia_id) and tac_gia_id == kenh_id,
    )
