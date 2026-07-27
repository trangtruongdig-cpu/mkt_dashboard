import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Env } from "../../config/env";

@ApiTags("Hệ thống")
@Controller("health")
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get()
  @ApiOperation({ summary: "Kiểm tra tình trạng dịch vụ" })
  check(): {
    status: "ok";
    dataSource: Env["DATA_SOURCE"];
    environment: Env["NODE_ENV"];
  } {
    return {
      status: "ok",
      dataSource: this.config.get("DATA_SOURCE", { infer: true }),
      environment: this.config.get("NODE_ENV", { infer: true }),
    };
  }
}
