'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface Message {
  id: string;
  userId: number;
  email: string;
  content: string;
  messageType: 'text' | 'emoji';
  timestamp: number;
}

interface OnlineUser {
  id: number;
  email: string;
}

export default function ChatPage() {
  const { user, authFetch } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 常用表情列表
  const commonEmojis = [
    '😊', '😂', '🥰', '😍', '🤩', '😋', '🤤', '🍕',
    '🍔', '🍟', '🌭', '🍿', '🧂', '🥚', '🍳', '🧈',
    '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌽',
    '🥕', '🍠', '🥑', '🍆', '🥦', '🥬', '🥒', '🍅',
    '🧄', '🧅', '🥔', '🍞', '🥐', '🥖', '🥨', '🧀',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍'
  ];

  // 连接 WebSocket
  const connectWebSocket = useCallback(async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('meal_planner_token');
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/chat/ws?token=${encodeURIComponent(token)}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (event.code !== 1008) { // 非认证失败
          // 重连逻辑
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, [user]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'recent_messages':
        setMessages(data.messages || []);
        break;
      case 'new_message':
        setMessages(prev => [...prev, data.message]);
        break;
      case 'user_join':
        setOnlineUsers(prev => {
          const exists = prev.some(u => u.id === data.user.id);
          if (exists) return prev;
          return [...prev, data.user];
        });
        break;
      case 'user_leave':
        setOnlineUsers(prev => prev.filter(u => u.id !== data.user.id));
        break;
      case 'error':
        console.error('Server error:', data.message);
        break;
    }
  };

  const sendMessage = useCallback(() => {
    if (!inputValue.trim() || !wsRef.current || !user) return;

    const message = {
      type: 'message',
      content: inputValue.trim(),
      messageType: 'text' as const
    };

    wsRef.current.send(JSON.stringify(message));
    setInputValue('');
    setShowEmojiPicker(false);
  }, [inputValue, user]);

  const sendEmoji = useCallback((emoji: string) => {
    if (!wsRef.current || !user) return;

    const message = {
      type: 'message',
      content: emoji,
      messageType: 'emoji' as const
    };

    wsRef.current.send(JSON.stringify(message));
    setShowEmojiPicker(false);
  }, [user]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 获取用户名（邮箱前缀）
  const getUsername = (email: string) => {
    return email.split('@')[0];
  };

  // 生成随机头像颜色
  const getAvatarColor = (userId: number) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return colors[userId % colors.length];
  };

  if (!user) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">社区聊天室</h1>
          <p className="text-gray-500 mb-6">请先登录后使用聊天室功能</p>
          <Link 
            href="/login" 
            className="px-6 py-3 bg-[#FF6B35] text-white rounded-xl font-medium hover:bg-[#E55A2B] transition-all"
          >
            登录/注册
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-md mx-auto w-full">
      {/* 头部 */}
      <div className="w-full mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">💬 社区聊天室</h1>
            <p className="text-xs text-gray-400">
              {isConnected ? '已连接' : '连接中...'} · 
              {onlineUsers.length} 人在线
            </p>
          </div>
          <Link 
            href="/" 
            className="px-4 py-2 text-sm text-gray-500 hover:text-[#FF6B35] transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* 在线用户列表 */}
      {onlineUsers.length > 0 && (
        <div className="w-full mb-4">
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map((onlineUser) => (
              <div 
                key={onlineUser.id}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs"
              >
                <div className={`w-2 h-2 rounded-full ${getAvatarColor(onlineUser.id)}`} />
                <span className="text-gray-700">{getUsername(onlineUser.email)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="w-full flex-1 overflow-y-auto mb-4 space-y-4 min-h-[400px] max-h-[500px]">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.userId === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${message.userId === user.id ? 'order-2' : 'order-1'}`}>
                {/* 用户信息 */}
                <div className={`flex items-center gap-2 mb-1 ${message.userId === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${getAvatarColor(message.userId)}`}>
                    {getUsername(message.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {getUsername(message.email)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                
                {/* 消息内容 */}
                <div className={`p-3 rounded-2xl ${
                  message.userId === user.id 
                    ? 'bg-[#FF6B35] text-white rounded-br-md' 
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}>
                  {message.messageType === 'emoji' ? (
                    <span className="text-3xl">{message.content}</span>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* 表情选择器 */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full mb-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-lg"
          >
            <div className="grid grid-cols-8 gap-2">
              {commonEmojis.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => sendEmoji(emoji)}
                  className="p-2 text-2xl hover:bg-gray-100 rounded-lg transition-all active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 输入区域 */}
      <div className="w-full">
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
          >
            😊
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
            placeholder="输入消息..."
            className="flex-1 p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || !isConnected}
            className="px-6 py-3 bg-[#FF6B35] text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E55A2B] transition-all active:scale-95"
          >
            发送
          </button>
        </div>
      </div>
    </main>
  );
}