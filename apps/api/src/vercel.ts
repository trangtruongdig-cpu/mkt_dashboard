import "reflect-metadata";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./bootstrap";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Promise<NodeHandler> | undefined;

/**
 * Điểm vào khi chạy như hàm serverless trên Vercel.
 *
 * Không gọi `app.listen()` — Vercel đã có sẵn máy chủ HTTP; ta chỉ đẩy request
 * vào đúng instance Fastify bên trong Nest. Instance được nhớ lại giữa các lần
 * gọi để lần gọi nguội chỉ dựng ứng dụng một lần.
 */
export async function createServerlessHandler(): Promise<NodeHandler> {
  const app = await createApp();
  await app.init();

  const instance = app.getHttpAdapter().getInstance();
  await instance.ready();

  return (req, res) => {
    instance.server.emit("request", req, res);
  };
}

export function getServerlessHandler(): Promise<NodeHandler> {
  cached ??= createServerlessHandler();
  return cached;
}
