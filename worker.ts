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

// 处理 HTTP发送消息请求
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleChatSend(request: any, env: CloudflareEnv): Promise<any> {
  if (!env.CHAT_ROOM) {
    return new Response('Durable Objects not configured', { status: 500 });
  }

  const id = env.CHAT_ROOM.idFromName('global-chat-room');
  const stub = env.CHAT_ROOM.get(id);

  const doUrl = new URL('/send', request.url);
  const headers = new Headers(request.headers);
  
  const doRequest = new Request(doUrl.toString(), {
    method: 'POST',
    headers,
    body: request.body,
  });

  // @ts-ignore - Durable Object fetch accepts standard Request
  return stub.fetch(doRequest);
}

// 处理 WebSocket升级请求
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWebSocket(request: any, env: CloudflareEnv): Promise<any> {
  // 检查是否是 WebSocket升级请求
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // 检查 Durable Object绑定是否存在
  if (!env.CHAT_ROOM) {
    return new Response('Durable Objects not configured', { status: 500 });
  }

  // 从 URL参数获取 token
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token', { status: 401 });
  }

  // 获取 Durable Object实例
  const id = env.CHAT_ROOM.idFromName('global-chat-room');
  const stub = env.CHAT_ROOM.get(id);

  // 代理请求到 Durable Object，将 token放在 Authorization header中
  const doUrl = new URL('/websocket', request.url);
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  const doRequest = new Request(doUrl.toString(), {
    method: 'GET',
    headers,
  });

  // @ts-ignore - Durable Object fetch returns a special Response with webSocket
  return stub.fetch(doRequest);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default {
  fetch: async (request: any, env: CloudflareEnv, ctx: any) => {
    const url = new URL(request.url);
    
    // 处理 WebSocket连接
    if (url.pathname === '/api/chat/ws') {
      return handleWebSocket(request, env);
    }

    // 处理 HTTP发送消息
    if (url.pathname === '/api/chat/send' && request.method === 'POST') {
      return handleChatSend(request, env);
    }
    
    // 其他请求交给 Next.js处理
    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
