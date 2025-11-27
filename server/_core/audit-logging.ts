import { Request } from "express";
import { getDb } from "../db";

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_RESET = 'password_reset',
  SESSION_EXPIRED = 'session_expired',
  
  // User management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  
  // Loan application events
  LOAN_CREATED = 'loan_created',
  LOAN_UPDATED = 'loan_updated',
  LOAN_STATUS_CHANGED = 'loan_status_changed',
  LOAN_APPROVED = 'loan_approved',
  LOAN_REJECTED = 'loan_rejected',
  LOAN_DISBURSED = 'loan_disbursed',
  
  // Payment events
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',
  AUTO_PAY_EXECUTED = 'auto_pay_executed',
  
  // Document events
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_VIEWED = 'document_viewed',
  DOCUMENT_DELETED = 'document_deleted',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // Admin actions
  ADMIN_ACTION = 'admin_action',
  SETTINGS_CHANGED = 'settings_changed',
  FEE_CONFIG_UPDATED = 'fee_config_updated',
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: number;
  ipAddress?: string;
  userAgent?: string;
  severity: AuditSeverity;
  description: string;
  metadata?: Record<string, any>;
  resourceType?: string;
  resourceId?: number;
}

// Log audit event
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await db.createAuditLog({
      eventType: entry.eventType,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      severity: entry.severity,
      description: entry.description,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      timestamp: new Date(),
    });

    // Log critical events to console immediately
    if (entry.severity === AuditSeverity.CRITICAL) {
      console.error('🚨 CRITICAL AUDIT EVENT:', {
        eventType: entry.eventType,
        userId: entry.userId,
        description: entry.description,
        metadata: entry.metadata,
      });
    }
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break application flow
  }
}

// Helper to extract request metadata
export function extractRequestMetadata(req: Request): Pick<AuditLogEntry, 'ipAddress' | 'userAgent'> {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
}

// Pre-configured audit loggers for common events
export const auditLoggers = {
  // Authentication
  loginSuccess: async (userId: number, req: Request) => {
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId,
      ...extractRequestMetadata(req),
      severity: AuditSeverity.INFO,
      description: `User ${userId} logged in successfully`,
    });
  },

  loginFailed: async (email: string, req: Request, reason: string) => {
    await logAuditEvent({
      eventType: AuditEventType.LOGIN_FAILED,
      ...extractRequestMetadata(req),
      severity: AuditSeverity.WARNING,
      description: `Failed login attempt for ${email}: ${reason}`,
      metadata: { email, reason },
    });
  },

  // Loan events
  loanStatusChanged: async (loanId: number, userId: number, oldStatus: string, newStatus: string, changedBy: number) => {
    await logAuditEvent({
      eventType: AuditEventType.LOAN_STATUS_CHANGED,
      userId: changedBy,
      severity: AuditSeverity.INFO,
      description: `Loan ${loanId} status changed from ${oldStatus} to ${newStatus}`,
      resourceType: 'loan',
      resourceId: loanId,
      metadata: { oldStatus, newStatus, affectedUserId: userId },
    });
  },

  loanApproved: async (loanId: number, amount: number, adminId: number) => {
    await logAuditEvent({
      eventType: AuditEventType.LOAN_APPROVED,
      userId: adminId,
      severity: AuditSeverity.INFO,
      description: `Loan ${loanId} approved for $${(amount / 100).toFixed(2)}`,
      resourceType: 'loan',
      resourceId: loanId,
      metadata: { amount, adminId },
    });
  },

  // Payment events
  paymentSuccess: async (paymentId: number, userId: number, amount: number, method: string) => {
    await logAuditEvent({
      eventType: AuditEventType.PAYMENT_SUCCESS,
      userId,
      severity: AuditSeverity.INFO,
      description: `Payment ${paymentId} of $${(amount / 100).toFixed(2)} completed via ${method}`,
      resourceType: 'payment',
      resourceId: paymentId,
      metadata: { amount, method },
    });
  },

  paymentFailed: async (userId: number, amount: number, method: string, reason: string) => {
    await logAuditEvent({
      eventType: AuditEventType.PAYMENT_FAILED,
      userId,
      severity: AuditSeverity.ERROR,
      description: `Payment of $${(amount / 100).toFixed(2)} failed: ${reason}`,
      metadata: { amount, method, reason },
    });
  },

  autoPayExecuted: async (loanId: number, success: boolean, amount: number, reason?: string) => {
    await logAuditEvent({
      eventType: AuditEventType.AUTO_PAY_EXECUTED,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      description: success 
        ? `Auto-pay successful for loan ${loanId}: $${(amount / 100).toFixed(2)}`
        : `Auto-pay failed for loan ${loanId}: ${reason}`,
      resourceType: 'loan',
      resourceId: loanId,
      metadata: { success, amount, reason },
    });
  },

  // Security events
  rateLimitExceeded: async (req: Request, endpoint: string) => {
    await logAuditEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      ...extractRequestMetadata(req),
      severity: AuditSeverity.WARNING,
      description: `Rate limit exceeded for endpoint: ${endpoint}`,
      metadata: { endpoint },
    });
  },

  unauthorizedAccess: async (req: Request, resource: string, userId?: number) => {
    await logAuditEvent({
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      userId,
      ...extractRequestMetadata(req),
      severity: AuditSeverity.WARNING,
      description: `Unauthorized access attempt to ${resource}`,
      metadata: { resource },
    });
  },

  suspiciousActivity: async (req: Request, description: string, metadata?: Record<string, any>) => {
    await logAuditEvent({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      ...extractRequestMetadata(req),
      severity: AuditSeverity.CRITICAL,
      description,
      metadata,
    });
  },

  // Admin actions
  adminAction: async (adminId: number, action: string, details: string, metadata?: Record<string, any>) => {
    await logAuditEvent({
      eventType: AuditEventType.ADMIN_ACTION,
      userId: adminId,
      severity: AuditSeverity.INFO,
      description: `Admin action: ${action} - ${details}`,
      metadata,
    });
  },
};
