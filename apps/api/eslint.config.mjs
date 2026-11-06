import tseslint from "typescript-eslint";

/**
 * Cấu hình lint cho API.
 *
 * Dùng bộ `recommended` không cần type-check: nó chạy trong một giây và đã chứa đủ hai
 * điều CLAUDE.md mục 4 bắt buộc — cấm `any` và cấm `@ts-ignore`. Bộ
 * `recommendedTypeChecked` bắt được nhiều hơn nhưng phải dựng cả chương trình
 * TypeScript mỗi lần lint, mà `pnpm typecheck` đã làm đúng việc đó rồi.
 */
export default tseslint.config(
  { ignores: ["dist/**", ".turbo/**", "src/db/migrations/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      // Tham số chưa dùng mở đầu bằng `_` là có chủ ý (ví dụ `_query` trong bản demo).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
