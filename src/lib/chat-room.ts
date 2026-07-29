/**
 * Cloudflare Durable Object - 聊天室
 * 管理 WebSocket 连接、消息广播、在线用户列表
 */

interface Env {
  RECIPE_CACHE: import("@cloudflare/workers-types").KVNamespace;
  DB: import("@cloudflare/workers-types").D1Database;
}

// WebSocketPair 是 Cloudflare Workers 全局类，不需要导入
declare class WebSocketPair {
  constructor();
  0: import("@cloudflare/workers-types").WebSocket;
  1: import("@cloudflare/workers-types").WebSocket;
}

interface ChatMessage {
  id: string;
  userId: number;
  email: string;
  content: string;
  messageType: 'text' | 'emoji';
  timestamp: number;
}

interface UserSession {
  userId: number;
  email: string;
}

export class ChatRoom {
  private state: import("@cloudflare/workers-types").DurableObjectState;
  private env: Env;
  private sessions: Map<import("@cloudflare/workers-types").WebSocket, UserSession>;

  constructor(state: import("@cloudflare/workers-types").DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      // 处理 WebSocket 连接
      const pair = new WebSocketPair();
      await this.handleWebSocket(pair[1], request);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Response(null, { status: 101, webSocket: pair[0] } as any);
    }
    
    if (url.pathname === '/messages') {
      // 获取最近消息
      return await this.getRecentMessages();
    }
    
    if (url.pathname === '/online-users') {
      // 获取在线用户列表
      return this.getOnlineUsers();
    }
    
    return new Response('Not found', { status: 404 });
  }

  async handleWebSocket(ws: import("@cloudflare/workers-types").WebSocket, request: Request) {
    // 验证用户身份
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const token = authHeader.slice(7);
    const user = await this.verifyToken(token);
    if (!user) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // 接受 WebSocket 连接
    ws.accept();
    
    // 存储会话
    this.sessions.set(ws, { userId: user.userId, email: user.email });
    
    // 广播用户上线消息
    this.broadcast({
      type: 'user_join',
      user: { id: user.userId, email: user.email },
      timestamp: Date.now()
    });

    // 发送最近消息
    const recentMessages = await this.getRecentMessagesFromKV();
    ws.send(JSON.stringify({
      type: 'recent_messages',
      messages: recentMessages
    }));

    // 处理消息
    ws.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleMessage(ws, data, user);
      } catch (e) {
        console.error('Message handling error:', e);
      }
    });

    // 处理断开连接
    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
      this.broadcast({
        type: 'user_leave',
        user: { id: user.userId, email: user.email },
        timestamp: Date.now()
      });
    });
  }

  async handleMessage(ws: import("@cloudflare/workers-types").WebSocket, data: { type: string; content?: string; messageType?: string }, user: UserSession) {
    if (data.type === 'message') {
      // 验证消息内容
      if (!data.content || typeof data.content !== 'string') {
        return;
      }

      // 限制消息长度
      if (data.content.length > 1000) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '消息长度不能超过1000字符'
        }));
        return;
      }

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        userId: user.userId,
        email: user.email,
        content: data.content,
        messageType: (data.messageType as 'text' | 'emoji') || 'text',
        timestamp: Date.now()
      };

      // 广播消息
      this.broadcast({
        type: 'new_message',
        message
      });

      // 存储到 KV
      await this.saveMessageToKV(message);
      
      // 异步归档到 D1（可选）
      this.archiveMessageToD1(message).catch(console.error);
    }
  }

  broadcast(message: { type: string; [key: string]: unknown }) {
    const data = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      try {
        ws.send(data);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  async saveMessageToKV(message: ChatMessage) {
    const key = 'chat:recent_messages';
    let messages: ChatMessage[] = [];
    
    try {
      const stored = await this.env.RECIPE_CACHE.get(key, 'json');
      if (Array.isArray(stored)) {
        messages = stored;
      }
    } catch (e) {
      console.error('Failed to read from KV:', e);
    }
    
    messages.push(message);
    
    // 只保留最近 100 条
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }
    
    try {
      await this.env.RECIPE_CACHE.put(key, JSON.stringify(messages), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 天
      });
    } catch (e) {
      console.error('Failed to save to KV:', e);
    }
  }

  async getRecentMessagesFromKV(): Promise<ChatMessage[]> {
    const key = 'chat:recent_messages';
    try {
      const messages = await this.env.RECIPE_CACHE.get(key, 'json');
      return Array.isArray(messages) ? messages : [];
    } catch (e) {
      console.error('Failed to get messages from KV:', e);
      return [];
    }
  }

  async getRecentMessages(): Promise<Response> {
    const messages = await this.getRecentMessagesFromKV();
    return new Response(JSON.stringify({ messages }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  getOnlineUsers(): Response {
    const users = Array.from(this.sessions.values()).map(session => ({
      id: session.userId,
      email: session.email
    }));
    
    return new Response(JSON.stringify({ users }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async archiveMessageToD1(message: ChatMessage) {
    try {
      await this.env.DB.prepare(
        'INSERT INTO chat_messages (user_id, content, message_type, created_at) VALUES (?, ?, ?, ?)'
      ).bind(
        message.userId,
        message.content,
        message.messageType,
        new Date(message.timestamp).toISOString()
      ).run();
    } catch (e) {
      console.error('Archive to D1 failed:', e);
    }
  }

  async verifyToken(token: string): Promise<UserSession | null> {
    try {
      // 复用现有的认证逻辑
      const session = await this.env.DB.prepare(
        "SELECT s.user_id, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
      ).bind(token).first() as { user_id: number; email: string } | null;
      
      return session ? { userId: session.user_id, email: session.email } : null;
    } catch (e) {
      console.error('Token verification failed:', e);
      return null;
    }
  }
}