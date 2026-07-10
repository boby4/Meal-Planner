"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface User {
  id: number;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  deviceId: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEVICE_KEY = "meal_planner_device_id";
const TOKEN_KEY = "meal_planner_token";
const USER_KEY = "meal_planner_user";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);

    // 检查本地存储的用户信息
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  /** 带认证的 fetch */
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = localStorage.getItem(TOKEN_KEY) || "";
      const headers = new Headers(options.headers || {});

      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("x-device-id", deviceId || getOrCreateDeviceId());

      return fetch(url, { ...options, headers });
    },
    [deviceId]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登录失败");

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    },
    [authFetch]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await authFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "注册失败");

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    },
    [authFetch]
  );

  const logout = useCallback(async () => {
    try {
      await authFetch("/api/auth", { method: "DELETE" });
    } catch {
      // ignore
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, [authFetch]);

  return (
    <AuthContext.Provider value={{ user, loading, deviceId, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
