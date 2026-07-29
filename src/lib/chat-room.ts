/**
 * Cloudflare Durable Object - 聊天室
 * 管理 WebSocket 连接、消息广播、在线用户列表
 */

interface Env {
  RECIPE_CACHE: import("@cloudflare/workers-types").KVNamespace;
  DB: import("@cloudflare/workers-types").D1Database;
}

interface ChatMessage {
  id: string;
  userId: number;
  email: string;
  username: string;
  content: string;
  messageType: 'text' | 'emoji';
  timestamp: number;
}

interface UserSession {
  userId: number;
  email: string;
  username: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CFWebSocket = any;

export class ChatRoom {
  private state: import("@cloudflare/workers-types").DurableObjectState;
  private env: Env;
  private sessions: Map<CFWebSocket, UserSession>;

  constructor(state: import("@cloudflare/workers-types").DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      // 检查是否是 WebSocket升级请求
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      // 验证用户身份
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }

      const token = authHeader.slice(7);
      const user = await this.verifyToken(token);
      if (!user) {
        return new Response('Unauthorized', { status: 401 });
      }

      // 创建 WebSocket对
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pair = new (globalThis as any).WebSocketPair();
      const [client, server] = Object.values(pair) as [CFWebSocket, CFWebSocket];
      
      // 接受 WebSocket连接
      this.state.acceptWebSocket(server);
      
      // 存储用户信息
      this.sessions.set(server, { userId: user.userId, email: user.email, username: user.username });
      
      // 发送在线用户列表（给新用户）
      const onlineUsers = Array.from(this.sessions.values()).map(session => ({
        id: session.userId,
        email: session.email,
        username: session.username
      }));
      server.send(JSON.stringify({
        type: 'online_users',
        users: onlineUsers
      }));

      // 广播用户上线消息（给其他人）
      this.broadcast({
        type: 'user_join',
        user: { id: user.userId, email: user.email, username: user.username },
        timestamp: Date.now()
      }, server);

      // 发送最近消息
      const recentMessages = await this.getRecentMessagesFromKV();
      server.send(JSON.stringify({
        type: 'recent_messages',
        messages: recentMessages
      }));

      // 返回客户端 WebSocket
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Response(null, { status: 101, webSocket: client } as any);
    }
    
    if (url.pathname === '/messages') {
      return await this.getRecentMessages();
    }
    
    if (url.pathname === '/online-users') {
      return this.getOnlineUsers();
    }
    
    return new Response('Not found', { status: 404 });
  }

  // WebSocket 消息处理（Durable Object 类方法）
  async webSocketMessage(ws: CFWebSocket, message: string | ArrayBuffer) {
    const user = this.sessions.get(ws);
    if (!user) return;

    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message);
        await this.handleMessage(ws, data, user);
      } catch (e) {
        console.error('Message handling error:', e);
      }
    }
  }

  // WebSocket 关闭处理
  async webSocketClose(ws: CFWebSocket) {
    const user = this.sessions.get(ws);
    if (user) {
      this.sessions.delete(ws);
      this.broadcast({
        type: 'user_leave',
        user: { id: user.userId, email: user.email, username: user.username },
        timestamp: Date.now()
      });
    }
  }

  // WebSocket 错误处理
  async webSocketError(ws: CFWebSocket, error: unknown) {
    console.error('WebSocket error:', error);
    const user = this.sessions.get(ws);
    if (user) {
      this.sessions.delete(ws);
    }
  }

  private async handleMessage(ws: CFWebSocket, data: { type: string; content?: string; messageType?: string }, user: UserSession) {
    if (data.type === 'message') {
      if (!data.content || typeof data.content !== 'string') {
        return;
      }

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
        username: user.username,
        content: data.content,
        messageType: (data.messageType as 'text' | 'emoji') || 'text',
        timestamp: Date.now()
      };

      this.broadcast({
        type: 'new_message',
        message
      });

      await this.saveMessageToKV(message);
      this.archiveMessageToD1(message).catch(console.error);
    }
  }

  private broadcast(message: { type: string; [key: string]: unknown }, excludeWs?: CFWebSocket) {
    const data = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      if (ws === excludeWs) continue;
      try {
        ws.send(data);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  private async saveMessageToKV(message: ChatMessage) {
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
    
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }
    
    try {
      await this.env.RECIPE_CACHE.put(key, JSON.stringify(messages), {
        expirationTtl: 7 * 24 * 60 * 60
      });
    } catch (e) {
      console.error('Failed to save to KV:', e);
    }
  }

  private async getRecentMessagesFromKV(): Promise<ChatMessage[]> {
    const key = 'chat:recent_messages';
    try {
      const messages = await this.env.RECIPE_CACHE.get(key, 'json');
      return Array.isArray(messages) ? messages : [];
    } catch (e) {
      console.error('Failed to get messages from KV:', e);
      return [];
    }
  }

  private async getRecentMessages(): Promise<Response> {
    const messages = await this.getRecentMessagesFromKV();
    return new Response(JSON.stringify({ messages }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private getOnlineUsers(): Response {
    const users = Array.from(this.sessions.values()).map(session => ({
      id: session.userId,
      email: session.email
    }));
    
    return new Response(JSON.stringify({ users }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async archiveMessageToD1(message: ChatMessage) {
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

  private async verifyToken(token: string): Promise<UserSession | null> {
    try {
      const session = await this.env.DB.prepare(
        "SELECT s.user_id, u.email, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
      ).bind(token).first() as { user_id: number; email: string; username: string } | null;
      
      return session ? { userId: session.user_id, email: session.email, username: session.username || session.email.split('@')[0] } : null;
    } catch (e) {
      console.error('Token verification failed:', e);
      return null;
    }
  }
}
