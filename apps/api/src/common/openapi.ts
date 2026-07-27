import { ApiOkResponse } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { z } from "zod";

/**
 * Sinh mô tả OpenAPI cho response thẳng từ zod schema ở `@ptit/shared`.
 *
 * Nhờ vậy tài liệu `/api/docs` luôn khớp với hợp đồng dữ liệu thật — không có
 * bước mô tả tay nào để lệch.
 */
export function ZodOkResponse(
  schema: z.ZodType,
  description: string,
): MethodDecorator & ClassDecorator {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "output",
  }) as SchemaObject;

  return ApiOkResponse({ description, schema: jsonSchema });
}
