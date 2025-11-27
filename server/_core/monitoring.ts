import * as Sentry from "@sentry/node";
import { Express, Request, Response, NextFunction } from "express";

// Initialize Sentry
export function initSentry(app: Express) {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not configured - error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive body data
      if (event.request?.data) {
        const data = event.request.data;
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

  // Request handler must be first
  app.use(Sentry.Handlers.requestHandler());
  
  // Tracing handler
  app.use(Sentry.Handlers.tracingHandler());
}

// Error handler must be last
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status >= 500
      return true;
    },
  });
}

// Capture custom events
export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

// Add user context to Sentry
export const setUserContext = (userId: number, email?: string) => {
  Sentry.setUser({
    id: userId.toString(),
    email,
  });
};

// Clear user context (on logout)
export const clearUserContext = () => {
  Sentry.setUser(null);
};

// Add tags for better filtering
export const addSentryTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  return Sentry.startTransaction({
    name,
    op,
  });
};
