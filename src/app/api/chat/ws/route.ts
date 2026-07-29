/**
 * WebSocket API 路由
 * 代理 WebSocket 连接到 Durable Object
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/cloudflare';

export async function GET(request: NextRequest) {
  try {
    const env = await getEnv();
    
    // 检查 Durable Object 绑定是否存在
    if (!env.CHAT_ROOM) {
      return NextResponse.json(
        { error: 'Durable Objects not configured' },
        { status: 500 }
      );
    }

    // 获取 Durable Object 实例
    const id = env.CHAT_ROOM.idFromName('global-chat-room');
    const stub = env.CHAT_ROOM.get(id);

    // 代理请求到 Durable Object
    const url = new URL(request.url);
    const doUrl = new URL(url.pathname.replace('/api/chat/ws', '/websocket'), url.origin);
    
    // 复制请求头
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      headers.set(key, value);
    });
    
    // 使用 Cloudflare Workers 兼容的 Request 构造
    const doRequest = new Request(doUrl.toString(), {
      method: request.method,
      headers,
    }) as unknown as import("@cloudflare/workers-types").Request;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await stub.fetch(doRequest) as any;
    
    // 返回标准 Response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('WebSocket proxy error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}