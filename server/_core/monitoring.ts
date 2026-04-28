import * as Sentry from "@sentry/node";
import { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";

let sentryInitialized = false;

// Initialize Sentry
export function initSentry(app: Express) {
  if (!process.env.SENTRY_DSN) {
    logger.warn('⚠️  SENTRY_DSN not configured - error monitoring disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Filter sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        
        // Remove sensitive body data
        if (event.request?.data) {
          const data = event.request.data as Record<string, any>;
          if (typeof data === 'object') {
            ['password', 'ssn', 'cardNumber', 'cvv', 'apiKey'].forEach(field => {
              if (field in data) {
                data[field] = '[REDACTED]';
              }
            });
          }
        }
        
        return event;
      },
    });

    sentryInitialized = true;
    logger.info('✓ Sentry error monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

// Error handler must be last
export function sentryErrorHandler() {
  // Return a middleware that captures errors if Sentry is initialized
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (sentryInitialized) {
      Sentry.captureException(err);
    }
    next(err);
  };
}

// Capture custom events
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (!sentryInitialized) return;
  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  if (!sentryInitialized) return;
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

// Add user context to Sentry
export const setUserContext = (userId: number, email?: string) => {
  if (!sentryInitialized) return;
  Sentry.setUser({
    id: userId.toString(),
    email,
  });
};

// Clear user context (on logout)
export const clearUserContext = () => {
  if (!sentryInitialized) return;
  Sentry.setUser(null);
};

// Add tags for better filtering
export const addSentryTag = (key: string, value: string) => {
  if (!sentryInitialized) return;
  Sentry.setTag(key, value);
};

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  if (!sentryInitialized) return null;
  // startTransaction is deprecated in newer Sentry versions
  // Use Sentry.startSpan instead or just return null for now
  return null;
};

