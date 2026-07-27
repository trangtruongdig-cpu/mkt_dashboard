import os
from pathlib import Path

from anthropic import Anthropic


def load_env_file() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

API_KEY = os.getenv("ANTHROPIC_API_KEY")
MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")

if not API_KEY:
    raise SystemExit("Thiếu ANTHROPIC_API_KEY. Hãy tạo file .env từ .env.example và thêm khóa API.")

client = Anthropic(api_key=API_KEY)


def ask_claude(prompt: str) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        temperature=0.7,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


if __name__ == "__main__":
    user_input = input("Nhập câu hỏi cho Claude: ").strip()
    if not user_input:
        user_input = "Viết một câu chào bằng tiếng Việt"

    print("\nClaude trả lời:\n")
    print(ask_claude(user_input))
