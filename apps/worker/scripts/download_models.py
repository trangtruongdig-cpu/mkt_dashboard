"""Tải sẵn trọng số model về thư mục cache.

Chạy lúc BUILD IMAGE, không phải lúc chạy job. Mục 6 CLAUDE.md: máy chủ Học viện có thể
không ra được Internet, và nghiệm thu phải chạy offline được — model tải lúc chạy nghĩa là
lần đầu chạy trên máy chủ thật sẽ hỏng, đúng lúc không ai kịp sửa.

    uv run python scripts/download_models.py                 # tải mọi model
    uv run python scripts/download_models.py visobert-social # chỉ một model

Trong Dockerfile, đặt lệnh này TRƯỚC khi copy mã nguồn để layer model được cache lại —
sửa một dòng Python không phải tải lại 1GB trọng số.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Script nằm trong scripts/ nên gói `nlp` không tự nằm trên đường tìm kiếm khi gọi thẳng
# bằng `python scripts/download_models.py`. Thêm thư mục worker vào trước khi import.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from nlp.settings import MODELS, THU_MUC_MODEL, ModelSacThai, model_theo_ma  # noqa: E402


def tai(cau_hinh: ModelSacThai) -> None:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    print(f"\n{cau_hinh.ma} — {cau_hinh.repo}")
    print(f"  {cau_hinh.mo_ta}")

    chung = {"cache_dir": str(THU_MUC_MODEL)}
    AutoTokenizer.from_pretrained(cau_hinh.repo, **chung)
    model = AutoModelForSequenceClassification.from_pretrained(cau_hinh.repo, **chung)

    # In bảng nhãn ngay lúc tải. Model tiếng Việt đặt nhãn mỗi nơi một kiểu và không theo
    # thứ tự âm→trung→dương; thấy được bảng này lúc build thì phát hiện sớm nếu tác giả
    # đổi thứ tự trong một bản cập nhật, thay vì phát hiện qua báo cáo sai.
    print(f"  nhãn: {dict(model.config.id2label)}")
    ban = getattr(model.config, "_commit_hash", None)
    print(f"  phiên bản: {str(ban)[:7] if ban else 'không rõ'}")


def main(argv: list[str] | None = None) -> int:
    ten = (argv if argv is not None else sys.argv[1:]) or sorted(MODELS)

    print(f"Tải model về {THU_MUC_MODEL}")
    for ma in ten:
        tai(model_theo_ma(ma))

    print(f"\nXong. Đặt NLP_OFFLINE=1 để buộc chỉ đọc từ {THU_MUC_MODEL}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
