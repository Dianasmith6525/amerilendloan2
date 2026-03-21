import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";
import { Request, Response } from "express";
import { logger } from "./logger";

// Redis client (optional - falls back to memory store)
let redisClient: ReturnType<typeof createClient> | null = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis error:', err);
  });
  
  redisClient.connect();
}

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (dashboard loads many queries)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
      prefix: 'rl:api:',
    }),
  } : {}),
});

// Strict limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
      prefix: 'rl:auth:',
    }),
  } : {}),
});

// Payment endpoint limiter (more restrictive)
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit to 20 payment attempts per hour
  message: 'Too many payment attempts, please contact support.',
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
      prefix: 'rl:payment:',
    }),
  } : {}),
});

// File upload limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit to 50 uploads per hour
  message: 'Too many upload attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
      prefix: 'rl:upload:',
    }),
  } : {}),
});

// Contact form limiter (prevent email spam abuse)
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 contact emails per hour per IP
  message: 'Too many messages sent. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
      prefix: 'rl:contact:',
    }),
  } : {}),
});

// Admin action limiter (very permissive)
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute for admins
  message: 'Rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? {
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
      prefix: 'rl:admin:',
    }),
  } : {}),
});

// Custom rate limiter for specific user actions
export function createUserRateLimiter(windowMs: number, max: number, prefix: string) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req: Request) => {
      // Use user ID if available, otherwise fall back to IP
      return (req as any).userId || req.ip || 'anonymous';
    },
    message: 'You are performing this action too frequently. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    ...(redisClient ? {
      store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
        prefix: `rl:${prefix}:`,
      }),
    } : {}),
  });
}

// Export Redis client for cleanup
export { redisClient };
