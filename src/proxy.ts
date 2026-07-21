import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ===== 限流配置 =====
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 普通 API
  default: { windowMs: 60 * 1000, maxRequests: 30 },
  // AI 相关 API（更严格）
  ai: { windowMs: 60 * 1000, maxRequests: 10 },
  // 搜索 API
  search: { windowMs: 60 * 1000, maxRequests: 20 },
};

// ===== 内存存储（生产环境应使用 KV）=====
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// 定期清理过期记录（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/** 获取客户端 IP */
function getClientIP(request: NextRequest): string {
  // 优先从 Cloudflare 头获取
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // 其次从 X-Forwarded-For
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // 最后从 X-Real-IP
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;

  return "unknown";
}

/** 判断路由类型 */
function getRouteType(pathname: string): string {
  if (pathname.startsWith("/api/chat")) return "ai";
  if (pathname.startsWith("/api/recipe")) return "ai"; // recipe 也可能调用 DeepSeek
  if (pathname.startsWith("/api/search")) return "search";
  return "default";
}

/** 检查速率限制 */
function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    // 新的窗口
    requestCounts.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      retryAfter: 0,
    };
  }

  if (record.count >= config.maxRequests) {
    // 超出限制
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  // 增加计数
  record.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    retryAfter: 0,
  };
}

/** Proxy 主函数 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 只处理 API 路由
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 跳过认证相关的 API（避免影响登录）
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const clientIP = getClientIP(request);
  const routeType = getRouteType(pathname);
  const config = RATE_LIMITS[routeType] || RATE_LIMITS.default;
  const rateLimitKey = `${clientIP}:${routeType}`;

  const { allowed, remaining, retryAfter } = checkRateLimit(
    rateLimitKey,
    config
  );

  if (!allowed) {
    console.warn(
      `[RateLimit] IP ${clientIP} 超出 ${routeType} 限制，需等待 ${retryAfter}s`
    );

    return NextResponse.json(
      {
        error: "请求过于频繁，请稍后再试",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(
            Math.ceil(Date.now() / 1000) + retryAfter
          ),
        },
      }
    );
  }

  // 正常请求，添加速率限制头
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(Date.now() / 1000) + config.windowMs / 1000)
  );

  return response;
}

/** Middleware 配置 */
export const config = {
  matcher: [
    // 匹配所有 API 路由
    "/api/:path*",
  ],
};
