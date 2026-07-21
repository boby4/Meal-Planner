import type { ChatMessage } from "./types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// ===== 配置常量 =====
const CONFIG = {
  maxRetries: 3, // 最大重试次数
  baseDelay: 1000, // 基础延迟（毫秒）
  maxDelay: 10000, // 最大延迟（毫秒）
  timeout: 30000, // 请求超时（毫秒）
  maxConcurrent: 3, // 最大并发数
};

// ===== 请求队列 =====
class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processNext();
        }
      });
      this.processNext();
    });
  }

  private processNext() {
    if (this.running >= CONFIG.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift();
    if (task) {
      task();
    }
  }
}

const requestQueue = new RequestQueue();

// ===== 工具函数 =====

/** 延迟函数 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 计算指数退避延迟 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = CONFIG.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // 添加随机抖动
  return Math.min(exponentialDelay + jitter, CONFIG.maxDelay);
}

/** 判断是否可重试的错误 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 网络错误
    if (message.includes("fetch failed") || message.includes("network")) {
      return true;
    }

    // 超时
    if (message.includes("timeout") || message.includes("aborted")) {
      return true;
    }

    // 检查状态码
    const statusMatch = message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      // 429 (Too Many Requests), 500, 502, 503 可重试
      if ([429, 500, 502, 503, 504].includes(status)) {
        return true;
      }
    }
  }

  return false;
}

// ===== 核心 API =====

interface DeepSeekOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/** 调用 DeepSeek API（带重试和队列） */
export async function callDeepSeek({
  messages,
  temperature = 0.7,
  maxTokens = 2048,
  signal,
}: DeepSeekOptions): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  // 使用队列控制并发
  return requestQueue.add(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        // 创建 AbortController 实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

        // 如果外部传入了 signal，也需要监听
        if (signal) {
          signal.addEventListener("abort", () => controller.abort());
        }

        const response = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages,
            temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(
            `DeepSeek API 错误: ${response.status} ${errorText}`
          );

          // 判断是否可重试
          if (isRetryableError(error) && attempt < CONFIG.maxRetries) {
            lastError = error;
            const delayMs = getBackoffDelay(attempt);
            console.warn(
              `[DeepSeek] 请求失败 (${attempt + 1}/${CONFIG.maxRetries + 1})，${delayMs}ms 后重试:`,
              error.message
            );
            await delay(delayMs);
            continue;
          }

          throw error;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error("DeepSeek 未返回有效内容");
        }

        return content;
      } catch (error) {
        // 处理 AbortError（超时或取消）
        if (error instanceof DOMException && error.name === "AbortError") {
          // 如果是外部取消，直接抛出
          if (signal?.aborted) {
            throw new Error("请求已取消");
          }

          // 超时错误，可重试
          const timeoutError = new Error("DeepSeek API 请求超时");
          if (attempt < CONFIG.maxRetries) {
            lastError = timeoutError;
            const delayMs = getBackoffDelay(attempt);
            console.warn(
              `[DeepSeek] 请求超时 (${attempt + 1}/${CONFIG.maxRetries + 1})，${delayMs}ms 后重试`
            );
            await delay(delayMs);
            continue;
          }
          throw timeoutError;
        }

        // 其他错误
        if (isRetryableError(error) && attempt < CONFIG.maxRetries) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const delayMs = getBackoffDelay(attempt);
          console.warn(
            `[DeepSeek] 请求失败 (${attempt + 1}/${CONFIG.maxRetries + 1})，${delayMs}ms 后重试:`,
            error
          );
          await delay(delayMs);
          continue;
        }

        throw error;
      }
    }

    // 所有重试都失败
    throw lastError || new Error("DeepSeek API 请求失败");
  });
}

/** 解析 DeepSeek 返回的 JSON */
export function parseDeepSeekJSON<T>(raw: string): T {
  // 尝试直接解析
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 尝试从 markdown code block 中提取
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) {
      return JSON.parse(match[1].trim()) as T;
    }
    throw new Error("无法解析 DeepSeek 返回的 JSON");
  }
}
