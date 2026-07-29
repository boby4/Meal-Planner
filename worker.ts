import type { ExportedHandler, KVNamespace, R2Bucket, D1Database, DurableObjectNamespace } from "@cloudflare/workers-types";

interface CloudflareEnv {
  RECIPE_CACHE: KVNamespace;
  RECIPE_DATA: R2Bucket;
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
}

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

// 导出 ChatRoom Durable Object
export { ChatRoom } from "./src/lib/chat-room";

export default {
  fetch: handler.fetch,
} satisfies ExportedHandler<CloudflareEnv>;
