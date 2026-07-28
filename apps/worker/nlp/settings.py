"""Cấu hình phần chấm sắc thái.

Hai model cho hai loại văn bản, và đây là lựa chọn có chủ đích chứ không phải thừa:

  ViSoBERT  cho bình luận, bài đăng, chủ đề diễn đàn.
            Huấn luyện riêng trên văn bản mạng xã hội tiếng Việt (Facebook, TikTok,
            YouTube) nên đọc được teencode, chữ không dấu, emoji, viết tắt.
  PhoBERT   cho tin bài báo chí.
            Huấn luyện trên văn bản chuẩn (Wikipedia, báo). Đưa bình luận YouTube vào
            PhoBERT là đưa văn bản khác hẳn phân phối huấn luyện — điểm số không đáng tin.

Dùng nhầm model cho nhầm loại văn bản không báo lỗi, chỉ cho ra điểm sai một cách im lặng.
Vì vậy mỗi bảng dữ liệu buộc phải khai rõ mình dùng model nào, không có giá trị mặc định
chung cho cả hai.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from crawler.settings import CrawlerError

WORKER_ROOT = Path(__file__).resolve().parent.parent


class NlpError(CrawlerError):
    """Cấu hình thiếu hoặc model không nạp được — dừng ngay thay vì ghi điểm rác vào kho."""


@dataclass(frozen=True)
class ModelSacThai:
    """Một model chấm sắc thái kèm mọi thứ cần để tái lập kết quả."""

    ma: str
    """Tên ngắn dùng trong lệnh và trong cột model_version."""

    repo: str
    """Định danh trên HuggingFace Hub."""

    mo_ta: str

    max_tokens: int = 256
    """Cắt ở đây. Một bình luận dài hơn 256 token gần như luôn là bài quảng cáo dán hàng
    loạt; phần đuôi không đổi được sắc thái mà làm chậm cả mẻ. Bản ghi bị cắt được đánh
    dấu `truncated` để về sau còn kiểm chứng lại được."""


VISOBERT = ModelSacThai(
    ma="visobert-social",
    repo="5CD-AI/Vietnamese-Sentiment-visobert",
    mo_ta="Bình luận và bài đăng mạng xã hội (teencode, không dấu, emoji)",
)

PHOBERT = ModelSacThai(
    ma="phobert-news",
    repo="wonrax/phobert-base-vietnamese-sentiment",
    mo_ta="Tin bài báo chí, văn phong chuẩn",
    max_tokens=256,
)

MODELS = {m.ma: m for m in (VISOBERT, PHOBERT)}


def model_theo_ma(ma: str) -> ModelSacThai:
    if ma not in MODELS:
        raise NlpError(f"Không có model {ma!r}. Hiện có: {', '.join(sorted(MODELS))}.")
    return MODELS[ma]


@dataclass(frozen=True)
class Corpus:
    """Một kho văn bản cần chấm, kèm model phù hợp với loại văn bản đó.

    Ghép cứng kho với model ngay ở đây để không ai lỡ tay chấm bình luận YouTube bằng
    PhoBERT: chọn nhầm không báo lỗi, chỉ cho ra điểm sai một cách im lặng.
    """

    ma: str
    mo_ta: str
    bang_tho: str
    bang_diem: str
    model: ModelSacThai

    cot_khoa: str = "mention_key"

    bieu_thuc_van_ban: str = "body_text"
    """Biểu thức SQL lấy văn bản cần chấm. Là HẰNG do mã nguồn quy định, không bao giờ
    nhận đầu vào từ người dùng."""

    dieu_kien: str = "true"
    """Điều kiện lọc thêm, cũng là hằng. Dùng để loại những hạt dữ liệu không mang ý kiến."""


SOCIAL = Corpus(
    ma="social",
    mo_ta="Thảo luận của người ngoài trên mạng xã hội và diễn đàn",
    bang_tho="raw_social_mention",
    bang_diem="social_sentiment",
    model=VISOBERT,
    # Tiêu đề và mô tả video là lời giới thiệu của người làm nội dung, không phải nhận xét
    # về Học viện. Chấm chúng rồi gộp vào biểu đồ sắc thái là trộn thông điệp truyền thông
    # vào tiếng nói công chúng.
    dieu_kien="content_type IN ('comment', 'post', 'thread')",
)

NEWS = Corpus(
    ma="news",
    mo_ta="Tin bài báo chí viết về Học viện",
    bang_tho="raw_news_mention",
    bang_diem="news_sentiment",
    model=PHOBERT,
    # Tiêu đề mang phần lớn lập trường của bài, nên luôn đưa vào. Thân bài bị model cắt ở
    # 256 token — tức điểm của một bài dài thực chất là điểm của TIÊU ĐỀ + PHẦN ĐẦU BÀI,
    # không phải của toàn văn. Cột `truncated` đánh dấu để về sau còn kiểm chứng lại.
    bieu_thuc_van_ban="coalesce(title, '') || ' ' || coalesce(body_text, '')",
    # Không lọc `is_owned` ở đây: "thông cáo Học viện tự đăng mang sắc thái gì" là câu hỏi
    # có ích riêng. Việc tách earned khỏi owned khi lên báo cáo là của dbt.
)

CORPUS = {c.ma: c for c in (SOCIAL, NEWS)}


def corpus_theo_ma(ma: str) -> Corpus:
    if ma not in CORPUS:
        raise NlpError(f"Không có kho {ma!r}. Hiện có: {', '.join(sorted(CORPUS))}.")
    return CORPUS[ma]


# Nơi cất trọng số model. Trong Docker, thư mục này là một layer đã nướng sẵn lúc build —
# mục 6 CLAUDE.md: máy chủ Học viện có thể không ra được Internet, và nghiệm thu phải chạy
# offline được.
THU_MUC_MODEL = Path(os.getenv("HF_HOME", str(WORKER_ROOT / ".models")))

# Bật thì transformers không gọi ra mạng, thiếu file là báo lỗi ngay thay vì lặng lẽ tải về.
# Đặt = 1 trong image production để một lần dựng thiếu model bị phát hiện lúc chạy thử,
# chứ không phải lúc máy chủ mất mạng giữa đêm.
CHI_DUNG_FILE_CUC_BO = os.getenv("NLP_OFFLINE", "").strip() in ("1", "true", "True")

# Số bản ghi đưa vào model mỗi lượt. Lớn hơn thì nhanh hơn nhưng ăn RAM hơn.
KICH_THUOC_LO = int(os.getenv("NLP_BATCH_SIZE", "16"))

# Văn bản ngắn hơn ngần này thì bỏ qua: "ok", "?", một emoji — không đủ ngữ liệu để chấm,
# mà lại chiếm chỗ trong phân bố sắc thái của báo cáo.
DO_DAI_TOI_THIEU = int(os.getenv("NLP_MIN_CHARS", "10"))
