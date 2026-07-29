'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface Message {
  id: string;
  userId: number;
  email: string;
  username: string;
  content: string;
  messageType: 'text' | 'emoji';
  timestamp: number;
}

interface OnlineUser {
  id: number;
  email: string;
  username: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!user || wsRef.current) return;

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
        wsRef.current = null;
        // 自动重连，不显示状态
        if (event.code !== 1008) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
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
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const handleWebSocketMessage = (data: { 
    type: string; 
    messages?: Message[]; 
    message?: Message; 
    user?: OnlineUser; 
    users?: OnlineUser[];
    message_text?: string 
  }) => {
    switch (data.type) {
      case 'recent_messages':
        setMessages(data.messages || []);
        break;
      case 'new_message':
        setMessages(prev => [...prev, data.message!]);
        break;
      case 'user_join':
        setOnlineUsers(prev => {
          if (!data.user) return prev;
          const exists = prev.some(u => u.id === data.user!.id);
          if (exists) return prev;
          return [...prev, data.user];
        });
        break;
      case 'user_leave':
        setOnlineUsers(prev => prev.filter(u => u.id !== data.user?.id));
        break;
      case 'online_users':
        // 收到完整的在线用户列表，直接替换
        setOnlineUsers(data.users || []);
        break;
      case 'error':
        console.error('Server error:', data.message_text);
        break;
    }
  };

  const sendMessage = useCallback(() => {
    if (!inputValue.trim() || !user) return;

    // 检查 WebSocket 是否处于 OPEN 状态
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not open, attempting to reconnect...');
      connectWebSocket();
      return;
    }

    const message = {
      type: 'message',
      content: inputValue.trim(),
      messageType: 'text' as const
    };

    try {
      wsRef.current.send(JSON.stringify(message));
      setInputValue('');
      setShowEmojiPicker(false);
      // 发送后聚焦输入框
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      // 尝试重连
      connectWebSocket();
    }
  }, [inputValue, user, connectWebSocket]);

  // 选择表情插入到输入框
  const insertEmoji = useCallback((emoji: string) => {
    setInputValue(prev => prev + emoji);
    // 插入后聚焦输入框
    inputRef.current?.focus();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取显示名称（优先用户名，其次邮箱前缀）
  const getDisplayName = (email: string, username?: string) => {
    if (username && username.trim()) return username;
    return email.split('@')[0];
  };

  // 生成随机头像颜色
  const getAvatarColor = (userId: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
    ];
    return colors[userId % colors.length];
  };

  if (!user) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">厨房闲聊</h1>
          <p className="text-gray-500 mb-6">登录后和吃货们聊聊美食心得</p>
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
    <main className="flex-1 flex flex-col h-[calc(100vh-4rem)] max-w-lg mx-auto w-full">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">💬 厨房闲聊</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? `在线 ${onlineUsers.length} 人` : '在线 0 人'}
              </span>
            </div>
          </div>
          <Link 
            href="/" 
            className="p-2 text-gray-500 hover:text-[#FF6B35] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
        
        {/* 在线用户列表 - 横向滚动 */}
        {isConnected && onlineUsers.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {onlineUsers.map((onlineUser) => (
              <div 
                key={onlineUser.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-full text-xs shrink-0"
              >
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
                  style={{ backgroundColor: getAvatarColor(onlineUser.id) }}
                >
                  {getDisplayName(onlineUser.email, onlineUser.username).charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-700 font-medium">{getDisplayName(onlineUser.email, onlineUser.username)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-5xl mb-4">👋</div>
            <p className="text-gray-500 text-sm">欢迎来到厨房闲聊</p>
            <p className="text-gray-400 text-xs mt-1">和吃货们分享你的美食心得吧</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((message) => {
              const isSelf = message.userId === user.id;
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] ${isSelf ? 'items-end' : 'items-start'}`}>
                    {/* 用户信息 */}
                    <div className={`flex items-center gap-2 mb-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                      {!isSelf && (
                        <>
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
                            style={{ backgroundColor: getAvatarColor(message.userId) }}
                          >
                            {getDisplayName(message.email, message.username).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-gray-700">
                            {getDisplayName(message.email, message.username)}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    
                    {/* 消息内容 */}
                    <div className={`px-4 py-2.5 rounded-2xl ${
                      isSelf 
                        ? 'bg-[#FF6B35] text-white rounded-br-md' 
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}>
                      {message.messageType === 'emoji' ? (
                        <span className="text-3xl">{message.content}</span>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部区域 - 表情选择器 + 输入框 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100">
        {/* 表情选择器 - 在输入框上方展开 */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-gray-100 overflow-hidden"
            >
              <div className="p-3">
                <div className="grid grid-cols-8 gap-1">
                  {commonEmojis.map((emoji, index) => (
                    <button
                      key={index}
                      onClick={() => insertEmoji(emoji)}
                      className="p-2 text-xl hover:bg-gray-100 rounded-lg transition-all active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 输入区域 */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 rounded-xl transition-all ${
                showEmojiPicker 
                  ? 'bg-[#FF6B35] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setInputValue(e.target.value);
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(); }}
              placeholder="说点什么..."
              maxLength={200}
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 transition-all text-sm"
            />
            {/* 字数统计 */}
            {inputValue.length > 0 && (
              <span className={`text-xs ${inputValue.length >= 180 ? 'text-orange-500' : 'text-gray-400'}`}>
                {inputValue.length}/200
              </span>
            )}
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || !isConnected}
              className="p-2.5 bg-[#FF6B35] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E55A2B] transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
