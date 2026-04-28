import { toast } from "sonner";
import React from "react";

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

// Error type mapping for better user messages
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Your session has expired. Please log in again.",
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  CONFLICT: "This operation conflicts with existing data.",
  VALIDATION_ERROR: "Please check your input and try again.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  SERVER_ERROR: "An error occurred on our end. Please try again later.",
  NETWORK_ERROR: "Network connection lost. Please check your internet connection.",
  TIMEOUT: "Request timed out. Please try again.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

export class ApiErrorHandler {
  static parseError(error: any): ApiError {
    let statusCode = 500;
    let message = ERROR_MESSAGES.UNKNOWN;
    let code = "UNKNOWN";
    let retryable = false;
    let retryAfterSeconds: number | undefined;

    if (error?.data?.code) {
      // tRPC error
      code = error.data.code;
      message = error.message || ERROR_MESSAGES[code] || message;
      statusCode = this.codeToStatus(code);
    } else if (error?.status) {
      // Standard HTTP error
      statusCode = error.status;
      message = error.message || ERROR_MESSAGES[this.statusToMessage(statusCode)];
      code = this.statusToCode(statusCode);
    } else if (error?.message?.includes("offline")) {
      code = "NETWORK_ERROR";
      message = ERROR_MESSAGES.NETWORK_ERROR;
      retryable = true;
    } else if (error?.name === "AbortError") {
      code = "TIMEOUT";
      message = ERROR_MESSAGES.TIMEOUT;
      retryable = true;
    }

    // Determine if error is retryable
    retryable = retryable || this.isRetryable(statusCode, code);

    return {
      code,
      message,
      statusCode,
      retryable,
      retryAfterSeconds,
    };
  }

  private static codeToStatus(code: string): number {
    const map: Record<string, number> = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      BAD_REQUEST: 400,
      CONFLICT: 409,
      INTERNAL_SERVER_ERROR: 500,
      SERVICE_UNAVAILABLE: 503,
    };
    return map[code] || 500;
  }

  private static statusToCode(status: number): string {
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 404) return "NOT_FOUND";
    if (status === 429) return "RATE_LIMITED";
    if (status === 500 || status === 502 || status === 503) return "SERVER_ERROR";
    if (status >= 400 && status < 500) return "CLIENT_ERROR";
    if (status >= 500) return "SERVER_ERROR";
    return "UNKNOWN";
  }

  private static statusToMessage(status: number): string {
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 404) return "NOT_FOUND";
    if (status === 429) return "RATE_LIMITED";
    if (status >= 500) return "SERVER_ERROR";
    return "UNKNOWN";
  }

  private static isRetryable(statusCode: number, code: string): boolean {
    // Retry on network errors, timeouts, and server errors
    if (code === "NETWORK_ERROR" || code === "TIMEOUT") return true;
    if (statusCode >= 500) return true; // Server errors
    if (statusCode === 429) return true; // Rate limited
    if (statusCode === 408) return true; // Request timeout
    return false;
  }

  static showErrorToast(error: any) {
    const parsed = this.parseError(error);
    toast.error(parsed.message);
  }

  static async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: any;
    let delay = finalConfig.delayMs;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const parsed = this.parseError(error);

        if (!parsed.retryable || attempt === finalConfig.maxAttempts) {
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Increase delay for next attempt
        delay = Math.min(
          delay * finalConfig.backoffMultiplier,
          finalConfig.maxDelayMs
        );

        // Show retry toast for user feedback
        if (attempt > 1) {
          toast.info(`Retrying... (Attempt ${attempt} of ${finalConfig.maxAttempts})`);
        }
      }
    }

    throw lastError;
  }
}

// Custom hook for error handling
export function useApiErrorHandler() {
  const handleError = (error: any) => {
    ApiErrorHandler.showErrorToast(error);
  };

  const withRetry = <T,>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ) => {
    return ApiErrorHandler.withRetry(fn, config);
  };

  return { handleError, withRetry };
}

// Offline detection hook
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Please check your internet connection.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

// Data persistence for offline support
export class OfflineDataManager {
  static save(key: string, data: any) {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save offline data:", error);
    }
  }

  static retrieve(key: string): any | null {
    try {
      const data = localStorage.getItem(`offline_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to retrieve offline data:", error);
      return null;
    }
  }

  static clear(key: string) {
    try {
      localStorage.removeItem(`offline_${key}`);
    } catch (error) {
      console.error("Failed to clear offline data:", error);
    }
  }

  static clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("offline_")) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Failed to clear all offline data:", error);
    }
  }
}
