import { NextResponse } from "next/server";

// ===== 错误类型定义 =====
export interface AppError {
  code: string;
  message: string;
  status: number;
  retryAfter?: number;
  details?: unknown;
}

// ===== 错误代码 =====
export const ErrorCodes = {
  // 客户端错误
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // 服务端错误
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

// ===== 自定义错误类 =====
export class APIError extends Error {
  code: ErrorCode;
  status: number;
  retryAfter?: number;
  details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      status?: number;
      retryAfter?: number;
      details?: unknown;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "APIError";
    this.code = code;
    this.status = options?.status || getStatusCodeFromCode(code);
    this.retryAfter = options?.retryAfter;
    this.details = options?.details;
  }
}

// ===== 工具函数 =====

/** 根据错误代码获取 HTTP 状态码 */
function getStatusCodeFromCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    VALIDATION_ERROR: 422,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    TIMEOUT: 504,
    EXTERNAL_API_ERROR: 502,
  };
  return statusMap[code] || 500;
}

/** 判断是否为客户端错误 */
function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/** 判断是否可重试 */
function isRetryable(code: ErrorCode): boolean {
  return [
    "RATE_LIMITED",
    "SERVICE_UNAVAILABLE",
    "TIMEOUT",
    "EXTERNAL_API_ERROR",
  ].includes(code);
}

/** 记录错误日志 */
function logError(error: unknown, context?: string) {
  const prefix = context ? `[${context}]` : "[API]";

  if (error instanceof APIError) {
    if (isClientError(error.status)) {
      console.warn(`${prefix} 客户端错误:`, {
        code: error.code,
        message: error.message,
        details: error.details,
      });
    } else {
      console.error(`${prefix} 服务端错误:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack,
      });
    }
  } else if (error instanceof Error) {
    console.error(`${prefix} 未知错误:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  } else {
    console.error(`${prefix} 错误:`, error);
  }
}

/** 获取用户友好的错误消息 */
function getFriendlyMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    BAD_REQUEST: "请求参数错误",
    UNAUTHORIZED: "请先登录",
    FORBIDDEN: "没有权限执行此操作",
    NOT_FOUND: "请求的资源不存在",
    RATE_LIMITED: "请求过于频繁，请稍后再试",
    VALIDATION_ERROR: "输入数据验证失败",
    INTERNAL_ERROR: "服务内部错误，请稍后再试",
    SERVICE_UNAVAILABLE: "服务暂时不可用，请稍后再试",
    TIMEOUT: "请求超时，请稍后再试",
    EXTERNAL_API_ERROR: "外部服务调用失败，请稍后再试",
  };
  return messages[code] || "未知错误";
}

// ===== 错误处理函数 =====

/** 处理 API 错误并返回响应 */
export function handleAPIError(
  error: unknown,
  context?: string
): NextResponse {
  // 记录日志
  logError(error, context);

  // 处理 APIError
  if (error instanceof APIError) {
    const response: Record<string, unknown> = {
      error: error.message,
      code: error.code,
    };

    // 限流错误添加 retryAfter
    if (error.retryAfter) {
      response.retryAfter = error.retryAfter;
    }

    const nextResponse = NextResponse.json(response, {
      status: error.status,
    });

    // 添加限流头
    if (error.code === "RATE_LIMITED" && error.retryAfter) {
      nextResponse.headers.set("Retry-After", String(error.retryAfter));
    }

    return nextResponse;
  }

  // 处理标准 Error
  if (error instanceof Error) {
    // 检查是否是 DeepSeek API 错误
    if (error.message.includes("DeepSeek API 错误")) {
      const statusMatch = error.message.match(/(\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 500;

      // 429 错误（限流）
      if (status === 429) {
        return NextResponse.json(
          {
            error: "AI 服务请求过于频繁，请稍后再试",
            code: "RATE_LIMITED",
            retryAfter: 60,
          },
          {
            status: 429,
            headers: { "Retry-After": "60" },
          }
        );
      }

      // 其他 DeepSeek 错误
      return NextResponse.json(
        {
          error: "AI 服务暂时不可用，请稍后再试",
          code: "EXTERNAL_API_ERROR",
        },
        { status: 502 }
      );
    }

    // 超时错误
    if (error.message.includes("超时") || error.message.includes("timeout")) {
      return NextResponse.json(
        {
          error: "请求超时，请稍后再试",
          code: "TIMEOUT",
        },
        { status: 504 }
      );
    }

    // 通用错误
    return NextResponse.json(
      {
        error: getFriendlyMessage("INTERNAL_ERROR"),
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }

  // 未知错误
  return NextResponse.json(
    {
      error: getFriendlyMessage("INTERNAL_ERROR"),
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}

/** 创建验证错误 */
export function validationError(message: string, details?: unknown): APIError {
  return new APIError("VALIDATION_ERROR", message, {
    status: 422,
    details,
  });
}

/** 创建限流错误 */
export function rateLimitError(retryAfter: number): APIError {
  return new APIError("RATE_LIMITED", `请求过于频繁，请 ${retryAfter} 秒后再试`, {
    status: 429,
    retryAfter,
  });
}

/** 创建未授权错误 */
export function unauthorizedError(message = "请先登录"): APIError {
  return new APIError("UNAUTHORIZED", message, { status: 401 });
}

/** 创建未找到错误 */
export function notFoundError(resource = "资源"): APIError {
  return new APIError("NOT_FOUND", `${resource}不存在`, { status: 404 });
}
