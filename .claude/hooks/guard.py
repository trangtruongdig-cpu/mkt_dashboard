#!/usr/bin/env python3
"""Bộ gác quyền cho các phiên Claude Code chạy song song trong dự án này.

Chạy như hook PreToolUse. Nhận JSON của lời gọi công cụ qua stdin, trả về quyết định
allow / deny / ask qua stdout.

NGUYÊN TẮC: mặc định ALLOW, chặn theo danh sách cấm.

Đây là lựa chọn có chủ đích cho phiên chạy đêm. Mặc định "ask" thì an toàn hơn nhưng
không ai thức để bấm, phiên sẽ đứng im tới sáng — tức là không hoàn thành việc gì.
Đổi lại, mọi thứ ngoài danh sách cấm đều được duyệt tự động, nên danh sách cấm phải
bao đúng những thứ không thể hoàn tác.

Bốn nhóm bị chặn, rút ra từ đúng những gì đã xảy ra trong dự án này:

  1. BÍ MẬT     — .secrets/ và .env đã từng lọt vào commit, chỉ dừng lại nhờ GitHub
                  chặn ở bước push. Không để lặp lại.
  2. XOÁ VIỆC   — git checkout/stash/reset đã xoá trắng một lượt việc của phiên khác.
                  Nhiều phiên chạy song song thì đây là rủi ro lớn nhất, không phải
                  lệnh phá hoại.
  3. KHÔNG LÙI  — xoá thư mục, ép push, viết lại lịch sử, publish ra ngoài.
  4. SAI NGĂN XẾP — cài thư viện nằm trong danh sách cấm ở CLAUDE.md mục 2.

Nhật ký mọi quyết định ghi ra .claude/auto-approve.log để sáng hôm sau soát lại.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
LOG = REPO / ".claude" / "auto-approve.log"

# Thư mục được phép xoá thoải mái: đều là thứ dựng lại được bằng một lệnh.
XOA_DUOC = (
    ".next", "node_modules", "dist", ".turbo", ".venv", "__pycache__",
    ".mypy_cache", ".ruff_cache", ".pytest_cache", "dbt/target", "dbt/logs",
    "/tmp/", "/scratchpad",
)

# (biểu thức, lý do). Khớp cái nào thì chặn ngay, không xét tiếp.
CAM_BASH: list[tuple[str, str]] = [
    # ── 1. Bí mật ────────────────────────────────────────────────────────────
    (r"\.secrets\b",
     "Đụng tới .secrets/ — nơi chứa token Google. Bí mật chỉ được nằm trong biến môi trường."),
    (r"git\s+add\b[^\n]*\.env(?!\.example)",
     "git add một file .env. File này không bao giờ được vào git."),
    (r"git\s+(commit|push)\b[^\n]*--no-verify",
     "--no-verify bỏ qua mọi bước kiểm tra trước commit, kể cả dò bí mật."),
    (r"(curl|wget)\b[^\n]*(\-\-data|\-d\s|\-\-upload-file|\-F\s)",
     "Gửi dữ liệu ra ngoài bằng curl/wget. Dữ liệu vận hành của Học viện không được đưa ra ngoài."),

    # ── 2. Xoá việc của phiên đang chạy song song ────────────────────────────
    (r"git\s+checkout\s+(--\s|\.|\-\-\s*\.)",
     "git checkout kiểu này vứt bỏ thay đổi chưa commit — đã từng xoá trắng việc của một phiên khác."),
    (r"git\s+restore\b(?![^\n]*--staged\s*$)",
     "git restore ghi đè file trong working tree, có thể xoá việc phiên khác đang làm dở."),
    (r"git\s+reset\s+--hard",
     "git reset --hard vứt bỏ toàn bộ thay đổi chưa commit của MỌI phiên."),
    (r"git\s+stash\b",
     "git stash cất hết thay đổi của mọi phiên vào chỗ khác — phiên kia sẽ thấy việc của mình biến mất."),
    (r"git\s+clean\b[^\n]*-[a-zA-Z]*f",
     "git clean -f xoá file chưa được theo dõi, gồm cả file phiên khác vừa tạo."),

    # ── 3. Không lùi lại được ────────────────────────────────────────────────
    (r"git\s+push\b[^\n]*(--force(?!-with-lease)|\s-f\b)",
     "push ép buộc ghi đè lịch sử trên GitHub. Dùng --force-with-lease nếu thật sự cần."),
    (r"git\s+filter-branch|git-filter-repo|\bbfg\b",
     "Viết lại lịch sử git. Phải có người thức để kiểm chứng trước và sau."),
    (r"git\s+branch\s+-D",
     "Xoá cưỡng bức một nhánh. Nhánh chưa merge sẽ mất."),
    (r"git\s+rebase\b",
     "rebase viết lại commit; chạy khi nhiều phiên cùng ghi thì rất dễ hỏng."),
    (r"\brm\s+(-[a-zA-Z]*\s+)*-?[a-zA-Z]*[rf]",  # mọi rm có -r hoặc -f
     "Xoá thư mục đệ quy."),  # lọc tiếp ở ham_rm_an_toan()
    (r"docker\s+compose\b[^\n]*\bdown\b[^\n]*(-v|--volumes)",
     "Xoá volume Docker — mất sạch dữ liệu PostgreSQL đã thu thập."),
    (r"\bsudo\b|\bchown\b|chmod\s+777",
     "Lệnh cần quyền hệ thống hoặc mở toang quyền file."),
    (r"(npm|pnpm|yarn)\s+publish|gh\s+release\s+create",
     "Phát hành gói/bản release ra ngoài. Việc này cần người quyết định."),
    (r"vercel\b[^\n]*--prod|vercel\s+deploy\b[^\n]*--prod",
     "Triển khai lên URL công khai. Cần người xem lại trước khi đẩy ra ngoài."),
    (r"gh\s+pr\s+merge",
     "Gộp pull request. Cần người duyệt."),
    (r">\s*/dev/(sda|disk)|mkfs|diskutil\s+erase",
     "Thao tác trực tiếp lên ổ đĩa."),
]

# CLAUDE.md mục 2 — ngăn xếp đã chốt, không được tự ý thêm thứ khác.
CAM_THU_VIEN = re.compile(
    # Cờ có thể nằm giữa tên trình quản lý gói và lệnh con:
    # `pnpm --filter web add recharts` phải khớp y như `pnpm add recharts`.
    r"\b(npm|pnpm|yarn|uv|pip)\b[^\n|;&]*?\b(add|install|i)\b[^\n|;&]*\b("
    r"prisma|typeorm|sequelize|mongoose|mongodb|"
    r"redux|@reduxjs|styled-components|emotion|"
    r"chart\.js|recharts|nivo|victory|"
    r"express|fastapi|django|flask|"
    r"streamlit|dash|superset|airflow|dagster|celery"
    r")\b",
    re.IGNORECASE,
)


def ham_rm_an_toan(lenh: str) -> bool:
    """rm -rf chỉ được duyệt khi mọi đích đến đều là thứ dựng lại được."""
    dich = re.findall(r"rm\s+(?:-[a-zA-Z]+\s+)*(.+)", lenh)
    if not dich:
        return False
    duong_dan = dich[0].split()
    if not duong_dan:
        return False
    return all(any(an_toan in d for an_toan in XOA_DUOC) for d in duong_dan)


def tra_loi(quyet_dinh: str, ly_do: str, tom_tat: str) -> None:
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            dau = "CHẶN " if quyet_dinh == "deny" else "duyệt"
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  {dau}  {tom_tat}\n")
            if quyet_dinh == "deny":
                f.write(f"{'':21}└─ {ly_do}\n")
    except OSError:
        pass  # không ghi được nhật ký thì vẫn phải trả quyết định

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": quyet_dinh,
            "permissionDecisionReason": ly_do,
        }
    }, ensure_ascii=False))
    sys.exit(0)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # Không đọc được đầu vào thì không tự nhận quyền quyết định.
        tra_loi("ask", "Hook không đọc được dữ liệu lời gọi công cụ.", "(đầu vào hỏng)")
        return

    ten = data.get("tool_name", "")
    dau_vao = data.get("tool_input") or {}

    # ── Công cụ ghi file ────────────────────────────────────────────────────
    if ten in ("Write", "Edit", "NotebookEdit"):
        duong_dan = str(dau_vao.get("file_path", ""))
        tom_tat = f"{ten} {duong_dan}"

        if ".secrets" in duong_dan:
            tra_loi("deny", "Ghi vào .secrets/. Bí mật chỉ nằm trong biến môi trường "
                            "(CLAUDE.md mục 4).", tom_tat)

        ten_file = os.path.basename(duong_dan)
        if ten_file.startswith(".env") and not ten_file.endswith(".example"):
            tra_loi("deny", "Ghi vào file .env. Chỉ được sửa .env.example, và phải ghi "
                            "chú thích tiếng Việt cho biến mới (CLAUDE.md mục 8).", tom_tat)

        try:
            trong_repo = Path(duong_dan).resolve().is_relative_to(REPO)
        except (OSError, ValueError):
            trong_repo = False
        if duong_dan and not trong_repo and "/scratchpad" not in duong_dan and not duong_dan.startswith("/tmp"):
            tra_loi("ask", f"Ghi file nằm ngoài dự án: {duong_dan}", tom_tat)

        tra_loi("allow", "Sửa file trong dự án.", tom_tat)

    # ── Lệnh shell ──────────────────────────────────────────────────────────
    if ten == "Bash":
        lenh = str(dau_vao.get("command", ""))
        tom_tat = lenh if len(lenh) <= 110 else lenh[:107] + "..."

        if CAM_THU_VIEN.search(lenh):
            tra_loi("deny", "Cài thư viện nằm trong danh sách cấm ở CLAUDE.md mục 2. "
                            "Ngăn xếp đã chốt — muốn đổi phải hỏi người dùng.", tom_tat)

        for mau, ly_do in CAM_BASH:
            if re.search(mau, lenh, re.IGNORECASE):
                # rm là trường hợp duy nhất có ngoại lệ hợp lệ.
                if "rm" in mau and ham_rm_an_toan(lenh):
                    continue
                tra_loi("deny", ly_do, tom_tat)

        tra_loi("allow", "Lệnh nằm ngoài danh sách cấm.", tom_tat)

    tra_loi("allow", f"Công cụ {ten} không nằm trong phạm vi bộ gác.", ten)


if __name__ == "__main__":
    main()
