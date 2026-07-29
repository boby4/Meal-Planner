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
  ws: CFWebSocket;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CFWebSocket = any;

export class ChatRoom {
  private state: import("@cloudflare/workers-types").DurableObjectState;
  private env: Env;
  // 使用 userId 作为 key，确保同一用户只有一个连接
  private sessions: Map<number, UserSession>;
  // WebSocket 到 userId 的反向映射
  private wsToUserId: Map<CFWebSocket, number>;

  constructor(state: import("@cloudflare/workers-types").DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.wsToUserId = new Map();
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
      
      // 检查该用户是否已有连接，如果有则关闭旧连接
      const existingSession = this.sessions.get(user.userId);
      if (existingSession) {
        try {
          existingSession.ws.close(1000, 'New connection opened');
        } catch (e) {
          console.error('Failed to close old connection:', e);
        }
        this.wsToUserId.delete(existingSession.ws);
      }
      
      // 存储用户信息（使用 userId 作为 key）
      this.sessions.set(user.userId, { 
        userId: user.userId, 
        email: user.email, 
        username: user.username,
        ws: server 
      });
      this.wsToUserId.set(server, user.userId);
      
      // 发送在线用户列表（给新用户，去重）
      const onlineUsers = this.getUniqueOnlineUsers();
      server.send(JSON.stringify({
        type: 'online_users',
        users: onlineUsers
      }));

      // 广播用户上线消息（给其他人）
      if (!existingSession) {
        // 只有当用户之前不在线时才广播上线消息
        this.broadcast({
          type: 'user_join',
          user: { id: user.userId, email: user.email, username: user.username },
          timestamp: Date.now()
        }, server);
      }

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
    const userId = this.wsToUserId.get(ws);
    if (userId === undefined) return;
    
    const user = this.sessions.get(userId);
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
    const userId = this.wsToUserId.get(ws);
    if (userId !== undefined) {
      const user = this.sessions.get(userId);
      this.sessions.delete(userId);
      this.wsToUserId.delete(ws);
      
      if (user) {
        // 检查该用户是否还有其他连接
        const hasOtherConnection = Array.from(this.wsToUserId.values()).includes(userId);
        if (!hasOtherConnection) {
          // 只有当用户完全离线时才广播下线消息
          this.broadcast({
            type: 'user_leave',
            user: { id: user.userId, email: user.email, username: user.username },
            timestamp: Date.now()
          });
        }
      }
    }
  }

  // WebSocket 错误处理
  async webSocketError(ws: CFWebSocket, error: unknown) {
    console.error('WebSocket error:', error);
    const userId = this.wsToUserId.get(ws);
    if (userId !== undefined) {
      this.sessions.delete(userId);
      this.wsToUserId.delete(ws);
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

      // 先广播消息（实时性优先）
      this.broadcast({
        type: 'new_message',
        message
      });

      // 异步保存到存储（不阻塞广播）
      this.saveMessageToKV(message).catch(console.error);
      this.archiveMessageToD1(message).catch(console.error);
    }
  }

  private broadcast(message: { type: string; [key: string]: unknown }, excludeWs?: CFWebSocket) {
    const data = JSON.stringify(message);
    for (const [, session] of this.sessions) {
      if (session.ws === excludeWs) continue;
      try {
        session.ws.send(data);
      } catch {
        this.sessions.delete(session.userId);
        this.wsToUserId.delete(session.ws);
      }
    }
  }

  // 获取去重后的在线用户列表
  private getUniqueOnlineUsers(): { id: number; email: string; username: string }[] {
    const users: { id: number; email: string; username: string }[] = [];
    const seen = new Set<number>();
    
    for (const [userId, session] of this.sessions) {
      if (!seen.has(userId)) {
        seen.add(userId);
        users.push({
          id: session.userId,
          email: session.email,
          username: session.username
        });
      }
    }
    
    return users;
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
    const users = this.getUniqueOnlineUsers();
    
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
      
      return session ? { userId: session.user_id, email: session.email, username: session.username || session.email.split('@')[0], ws: null } : null;
    } catch (e) {
      console.error('Token verification failed:', e);
      return null;
    }
  }
}
