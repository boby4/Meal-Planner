import { useRef, useCallback, useEffect } from "react";

/**
 * 请求取消 Hook
 * 用于管理 AbortController，支持组件卸载时自动取消请求
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  // 组件卸载时取消请求
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  /** 获取或创建 AbortController */
  const getController = useCallback(() => {
    // 如果存在旧的 controller，先取消
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // 创建新的 controller
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }, []);

  /** 取消当前请求 */
  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  /** 获取当前 signal */
  const getSignal = useCallback(() => {
    return getController().signal;
  }, [getController]);

  return {
    getController,
    abort,
    getSignal,
    signal: controllerRef.current?.signal,
  };
}
