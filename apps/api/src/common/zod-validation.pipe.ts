import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/**
 * Kiểm tra dữ liệu đầu vào bằng chính zod schema ở `@ptit/shared`.
 *
 * Không dùng class-validator để khỏi phải mô tả lại một lược đồ đã có — schema
 * dùng chung với frontend vẫn là nguồn sự thật duy nhất.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const ket_qua = this.schema.safeParse(value);

    if (!ket_qua.success) {
      throw new BadRequestException({
        message: "Dữ liệu gửi lên không hợp lệ",
        issues: ket_qua.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }

    return ket_qua.data;
  }
}
