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
