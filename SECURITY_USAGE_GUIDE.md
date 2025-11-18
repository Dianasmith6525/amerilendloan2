# How to Use Security Utilities in Your Application

## Quick Start

### 1. Import Security Functions

```typescript
import {
  emailSchema,
  usernameSchema,
  fullNameSchema,
  loanAmountSchema,
  phoneSchema,
  routingNumberSchema,
  accountNumberSchema,
  ssnSchema,
  sanitizeString,
  isSafeString,
  escapeHtml,
  logSecurityEvent,
  checkRateLimit,
  isSafeNumber,
  hashForLogging,
  validateJSON,
} from "@/_core/security";
```

---

## Input Validation Examples

### Email Validation
```typescript
// In your tRPC router
import { z } from "zod";
import { emailSchema } from "@/_core/security";

const auth = router({
  register: publicProcedure
    .input(z.object({
      email: emailSchema, // Automatically validates email format
      password: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      // Email is already validated - safe to use
      const user = await db.createUser({
        email: input.email,
        passwordHash: hashPassword(input.password),
      });
      return user;
    }),
});
```

### Loan Application Validation
```typescript
import { loanAmountSchema, fullNameSchema } from "@/_core/security";

const loans = router({
  create: protectedProcedure
    .input(z.object({
      loanAmount: loanAmountSchema, // Min: $10, Max: $5,000
      employerName: fullNameSchema, // Only letters, spaces, hyphens, apostrophes
      monthlyIncome: z.number().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      // All inputs are validated
      // Injection attempts are rejected at schema validation
      return db.createLoanApplication({
        userId: ctx.user.id,
        loanAmount: input.loanAmount,
        employerName: input.employerName,
        monthlyIncome: input.monthlyIncome,
      });
    }),
});
```

---

## Rate Limiting Examples

### Protect Login Endpoint
```typescript
import { checkRateLimit } from "@/_core/security";

const auth = router({
  login: publicProcedure
    .input(z.object({
      email: emailSchema,
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      const key = `login:${input.email}`;
      
      // Check rate limit: 5 attempts per minute
      if (!checkRateLimit(key, 5, 60000)) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many login attempts. Please try again later.'
        });
      }

      // Process login
      return performLogin(input.email);
    }),
});
```

### Protect Search Endpoint
```typescript
import { checkRateLimit, searchQuerySchema } from "@/_core/security";

const search = router({
  users: publicProcedure
    .input(z.object({
      query: searchQuerySchema,
    }))
    .query(async ({ input, ctx }) => {
      const key = `search:${ctx.req?.ip || 'unknown'}`;
      
      // Limit search: 20 per hour
      if (!checkRateLimit(key, 20, 3600000)) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Search rate limit exceeded'
        });
      }

      return db.query.users.findMany({
        where: like(users.name, `%${input.query}%`),
      });
    }),
});
```

---

## Security Event Logging

### Log Suspicious Activity
```typescript
import { logSecurityEvent, hashForLogging } from "@/_core/security";

// Log failed login attempt
const user = await findUserByEmail(email);
if (!user || !verifyPassword(password, user.passwordHash)) {
  logSecurityEvent(
    'auth_failure',
    email,
    `Failed login attempt. Password mismatch for ${hashForLogging(email)}`
  );
  throw new Error('Invalid credentials');
}

// Log injection attempt
if (!isSafeString(userInput)) {
  logSecurityEvent(
    'injection_attempt',
    ctx.user?.id || null,
    `Suspicious input detected: ${hashForLogging(userInput)}`
  );
  throw new Error('Invalid input');
}

// Log unauthorized access
if (resource.userId !== ctx.user.id) {
  logSecurityEvent(
    'unauthorized_access',
    ctx.user.id,
    `User attempted to access resource owned by ${resource.userId}`
  );
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

---

## Bank Data Protection

### Example: Update Bank Information
```typescript
import { routingNumberSchema, accountNumberSchema, ssnSchema } from "@/_core/security";
import { encryptBankData } from "@/_core/db";

const bank = router({
  updateBankInfo: protectedProcedure
    .input(z.object({
      bankName: z.string().max(100),
      accountHolder: fullNameSchema,
      routingNumber: routingNumberSchema, // Validates 9 digits
      accountNumber: accountNumberSchema, // Validates format
      accountType: z.enum(['checking', 'savings']),
      ssn: ssnSchema, // Validates and normalizes
    }))
    .mutation(async ({ input, ctx }) => {
      // All inputs are validated
      // SSN is validated and normalized (hyphens removed)
      // Encrypt sensitive data
      const encryptedSSN = encryptBankData(input.ssn);
      const encryptedAccount = encryptBankData(input.accountNumber);

      return db.updateUserBankInfo(ctx.user.id, {
        bankName: input.bankName,
        accountHolder: input.accountHolder,
        routingNumber: input.routingNumber, // Not sensitive
        accountNumber: encryptedAccount, // Encrypted
        accountType: input.accountType,
        ssn: encryptedSSN, // Encrypted
      });
    }),
});
```

---

## String Sanitization

### For User-Generated Content
```typescript
import { sanitizeString, escapeHtml } from "@/_core/security";

// When storing user comments
const comment = sanitizeString(userInput);
// Removes: < > " ' % \ and limits to 1000 chars

// When displaying user content in HTML
const safeComment = escapeHtml(comment);
// Converts: & < > " ' to HTML entities
// Prevents XSS attacks
```

---

## Number Validation

### Safe Numeric Operations
```typescript
import { isSafeNumber, loanAmountSchema } from "@/_core/security";

// Check if number is within safe range
const amount = parseFloat(userInput);
if (!isSafeNumber(amount, 1000, 500000)) {
  throw new Error('Loan amount out of valid range');
}

// Or use schema validation
const validated = loanAmountSchema.parse(userInput);
// Automatically rejects non-numbers and out-of-range values
```

---

## JSON Validation

### Prevent JSON Injection
```typescript
import { validateJSON } from "@/_core/security";

// When accepting JSON data
const data = req.body.data; // Could be malicious JSON

if (!validateJSON(data)) {
  throw new Error('Invalid JSON');
}

// Safe to parse
const parsed = JSON.parse(typeof data === 'string' ? data : JSON.stringify(data));
```

---

## Complete Real-World Example

### User Registration with Full Security
```typescript
import {
  emailSchema,
  usernameSchema,
  fullNameSchema,
  passwordSchema,
  logSecurityEvent,
  checkRateLimit,
  sanitizeString,
} from "@/_core/security";

const auth = router({
  register: publicProcedure
    .input(z.object({
      email: emailSchema,
      username: usernameSchema,
      firstName: fullNameSchema,
      lastName: fullNameSchema,
      password: z.string().min(12),
      agreeToTerms: z.boolean().refine(val => val === true),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Rate limit registration
      const key = `register:${ctx.req?.ip || 'unknown'}`;
      if (!checkRateLimit(key, 3, 3600000)) { // 3 per hour per IP
        logSecurityEvent('auth_failure', null, `Registration rate limit exceeded from IP`);
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many registration attempts'
        });
      }

      // 2. All inputs are validated by schema
      // Email is lowercase and trimmed
      // Username is checked for dangerous characters
      // Names are sanitized

      // 3. Check for existing user
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, input.email)
      });

      if (existingUser) {
        logSecurityEvent(
          'auth_failure',
          null,
          `Registration attempt with existing email`
        );
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already registered'
        });
      }

      // 4. Hash password
      const passwordHash = await hashPassword(input.password);

      // 5. Create user
      const newUser = await db.insert(users).values({
        email: input.email,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
      });

      // 6. Log successful registration
      logSecurityEvent(
        'auth_success',
        newUser.id,
        `User registered successfully`
      );

      return {
        success: true,
        message: 'Registration successful. Check your email to verify.'
      };
    }),
});
```

---

## Testing Your Security

### Unit Tests
```typescript
import { security } from "@/_core/security";

describe('Security Functions', () => {
  describe('Input Validation', () => {
    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('should reject SQL injection in username', () => {
      const result = usernameSchema.safeParse("admin'; DROP TABLE users;--");
      expect(result.success).toBe(false);
    });

    it('should accept valid loan amount', () => {
      const result = loanAmountSchema.safeParse(25000);
      expect(result.success).toBe(true);
      expect(result.data).toBe(25000);
    });
  });

  describe('Injection Detection', () => {
    it('should detect SQL injection', () => {
      expect(isSafeString("'; DROP TABLE users; --")).toBe(false);
    });

    it('should allow safe strings', () => {
      expect(isSafeString("John Smith")).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow first attempts', () => {
      expect(checkRateLimit('test-key', 5)).toBe(true);
      expect(checkRateLimit('test-key', 5)).toBe(true);
    });

    it('should block after limit', () => {
      const key = 'rate-limit-test-' + Math.random();
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 5);
      }
      expect(checkRateLimit(key, 5)).toBe(false);
    });
  });
});
```

---

## Summary

Your application is protected by:
1. ✅ **Drizzle ORM** - Automatic SQL injection prevention
2. ✅ **Zod Schemas** - Input validation
3. ✅ **TypeScript** - Type safety
4. ✅ **Encryption** - Sensitive data protection
5. ✅ **Security Utilities** - Additional validation layer

Use these utilities to:
- Validate all user input
- Sanitize data before storage
- Log security events
- Rate limit sensitive operations
- Prevent injection attacks

Stay secure! 🔒
