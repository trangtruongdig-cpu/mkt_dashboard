"""
Lấy refresh token OAuth cho GA4 Data API.

Chỉ phải chạy MỘT LẦN. Refresh token lấy được dùng lâu dài, dán vào apps/worker/.env.

Chuẩn bị trước (làm trên console.cloud.google.com, bằng chính tài khoản Google đang
có quyền xem property GA4 — quyền "viewer" là đủ, không cần quyền quản trị GA4):

  1. Tạo một project mới, ví dụ "ptit-dashboard".
  2. APIs & Services → Library → bật "Google Analytics Data API".
  3. APIs & Services → OAuth consent screen:
       - User type: External
       - Điền tên ứng dụng, email hỗ trợ, email liên hệ
       - Scopes: bỏ qua, để trống cũng được
       - Test users: THÊM CHÍNH EMAIL CỦA BẠN — bỏ bước này là hỏng
  4. APIs & Services → Credentials → Create Credentials → OAuth client ID
       - Application type: "Desktop app"
       - Sao lại Client ID và Client secret

Rồi chạy:  uv run python scripts/get_ga4_refresh_token.py
"""

from __future__ import annotations

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]


def main() -> int:
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Thiếu thư viện. Chạy: uv sync --all-groups")
        return 1

    print("Dán thông tin OAuth client vừa tạo (Desktop app).\n")
    client_id = input("Client ID     : ").strip()
    client_secret = input("Client secret : ").strip()

    if not client_id or not client_secret:
        print("\nThiếu client id hoặc client secret.")
        return 1

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        },
        scopes=SCOPES,
    )

    print("\nTrình duyệt sẽ mở ra. Đăng nhập bằng tài khoản có quyền xem property GA4.")
    print('Gặp cảnh báo "Google chưa xác minh ứng dụng này" thì bấm')
    print("Nâng cao → Truy cập (không an toàn) — đây là ứng dụng do chính bạn tạo,")
    print("cảnh báo đó là bình thường.\n")

    # access_type=offline + prompt=consent để Google chắc chắn trả về refresh token.
    credentials = flow.run_local_server(port=0, access_type="offline", prompt="consent")

    if not credentials.refresh_token:
        print(
            "\nGoogle không trả về refresh token. Thử lại và nhớ bấm đồng ý ở màn hình xin quyền."
        )
        return 1

    print("\n" + "=" * 72)
    print("Dán ba dòng sau vào apps/worker/.env  (KHÔNG commit file này):\n")
    print(f"GA4_CLIENT_ID={client_id}")
    print(f"GA4_CLIENT_SECRET={client_secret}")
    print(f"GA4_REFRESH_TOKEN={credentials.refresh_token}")
    print("=" * 72)
    print("\nSau đó kiểm tra:  uv run python -m ingest check")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
