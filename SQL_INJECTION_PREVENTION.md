# SQL Injection Prevention & Database Security Guide

## Current Status ✅
Your application is **well-protected** against SQL injection because:
1. **Drizzle ORM** - Uses parameterized queries automatically
2. **No raw SQL queries** - All database operations use type-safe ORM methods
3. **Input validation** - tRPC handles request validation before database operations

---

## How SQL Injection Works (Understanding the Threat)

### Vulnerable Code Example (DON'T DO THIS):
```typescript
// ❌ VULNERABLE - Direct string concatenation
const username = req.body.username; // User input: admin' OR '1'='1
const query = `SELECT * FROM users WHERE username = '${username}'`;
// Result: SELECT * FROM users WHERE username = 'admin' OR '1'='1'
// This returns ALL users!
```

### Safe Code (What You're Doing):
```typescript
// ✅ SAFE - Using Drizzle ORM with parameterized queries
const user = await db.query.users.findFirst({
  where: eq(users.username, input.username)
});
// Parameters are safely separated from SQL structure
```

---

## Your Current Security Implementation

### 1. **Drizzle ORM Protection**
All database queries in your codebase use Drizzle's type-safe methods:

```typescript
// ✅ SAFE - Automatic parameterization
await db.query.users.findFirst({
  where: eq(users.email, email)
});

await db.query.loanApplications.findMany({
  where: eq(loanApplications.userId, userId)
});

await db.update(users)
  .set({ email: newEmail })
  .where(eq(users.id, userId));
```

### 2. **Input Validation via tRPC**
Every procedure validates input before reaching database:

```typescript
// ✅ SAFE - Schema validation
createLoan: protectedProcedure
  .input(z.object({
    loanAmount: z.number().min(1000).max(100000),
    employerName: z.string().min(2).max(200)
  }))
  .mutation(async ({ input, ctx }) => {
    // Input is validated before any database operation
    await db.createLoanApplication({
      userId: ctx.user.id,
      loanAmount: input.loanAmount, // Safe - validated as number
      employerName: input.employerName // Safe - length validated
    });
  });
```

### 3. **Encryption for Sensitive Data**
Bank information is encrypted before storage:

```typescript
// ✅ SAFE - Sensitive data encrypted
function encryptBankData(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
```

---

## Additional Security Best Practices

### 1. **Never Trust User Input**
Always validate and sanitize:

```typescript
// ✅ GOOD - Validation before use
const createApplication = protectedProcedure
  .input(applicationSchema) // Schema validation
  .mutation(async ({ input, ctx }) => {
    // Additional checks
    if (input.loanAmount < 1000 || input.loanAmount > 500000) {
      throw new Error('Invalid loan amount');
    }
    
    // Only then proceed with database operation
    return db.createLoanApplication({
      userId: ctx.user.id,
      loanAmount: input.loanAmount,
      ...input
    });
  });
```

### 2. **Use Prepared Statements (Parameterized Queries)**
✅ Your codebase already does this automatically with Drizzle!

```typescript
// ✅ SAFE - Prepared statement (implicit with Drizzle)
const user = await db.query.users.findFirst({
  where: eq(users.email, userEmail)
});

// Equivalent to:
// Prepared: SELECT * FROM users WHERE email = $1
// Parameter: $1 = userEmail (never interpreted as SQL)
```

### 3. **Limit Database Permissions**
Your database user should have minimal required permissions:

```
✅ In production, ensure your database user only has:
  - SELECT on necessary tables
  - INSERT on application tables
  - UPDATE on own user records
  - DELETE only if truly needed
```

### 4. **Error Handling**
Don't expose database errors to clients:

```typescript
// ✅ GOOD - Safe error handling
try {
  await db.createLoanApplication(data);
} catch (error) {
  // Log the actual error for debugging
  console.error('Database error:', error);
  
  // Return safe message to client
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to create application'
  });
}
```

### 5. **Escape Special Characters**
Drizzle handles this automatically, but good to know:

```typescript
// ✅ SAFE - Drizzle escapes for you
const name = "O'Brien"; // Contains apostrophe
await db.update(users)
  .set({ fullName: name })
  .where(eq(users.id, userId));

// Drizzle automatically handles the quote character
```

---

## Recommended Additional Security Measures

### 1. **Use Environment Variables for Credentials**
```typescript
// ✅ GOOD
const dbUrl = process.env.DATABASE_URL;

// ❌ BAD - Never hardcode
const dbUrl = "postgresql://user:password@host/db";
```

### 2. **Enable SQL Logging in Development Only**
```typescript
// server/_core/env.ts
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Log SQL queries for debugging (dev only)
}
```

### 3. **Rate Limiting on Database Operations**
```typescript
// Prevent brute force attacks on login/search
import { rateLimit } from 'your-rate-limit-library';

searchUsers: publicProcedure
  .input(z.object({ query: z.string() }))
  .query(async ({ input }) => {
    // Rate limit search queries
    await rateLimit('search:' + input.query, 10); // 10 per minute
    
    return db.query.users.findMany({
      where: like(users.name, input.query)
    });
  });
```

### 4. **Add Query Timeouts**
```typescript
// server/db.ts
const timeout = 30000; // 30 seconds
// Add timeout configuration to your database connection
```

### 5. **Regular Security Audits**
```typescript
// Checklist:
✅ No string concatenation in SQL
✅ All user input validated with Zod schemas
✅ Sensitive data encrypted
✅ Error messages don't leak database structure
✅ Database user has minimal permissions
✅ Logs are monitored for suspicious queries
✅ SSL/TLS enabled for database connection
```

---

## Your Current Drizzle Setup

Your `server/db.ts` is properly configured:

```typescript
// ✅ SAFE - Using Drizzle ORM
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq, or, and } from "drizzle-orm";

// All queries use these safe methods:
// - query.findFirst()
// - query.findMany()
// - insert().values()
// - update().set()
// - delete().where()

// ✅ Bank data encrypted with AES-256
function encryptBankData(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);
  // ... encryption logic
}
```

---

## Threat Detection & Response

### Monitor These Red Flags:
```
❌ Error logs with "syntax error" or "SQL exception"
❌ Unusual database query patterns
❌ Multiple failed login attempts
❌ Queries returning unexpected row counts
❌ High database resource usage
```

### Response Actions:
```
1. Check application logs for the timestamp
2. Review recent tRPC procedure calls
3. Check user activity logs
4. If compromised: Rotate encryption keys
5. Reset affected user sessions
```

---

## Summary

**Your Application is Protected Because:**

1. ✅ **Drizzle ORM** - All queries are parameterized automatically
2. ✅ **tRPC Validation** - Input validated before database access
3. ✅ **No Raw SQL** - No string concatenation in queries
4. ✅ **Encryption** - Sensitive data (bank info) encrypted with AES-256
5. ✅ **Type Safety** - TypeScript prevents many injection attempts

**Keep It Secure:**

- Always validate input with Zod schemas
- Never disable Drizzle's built-in protections
- Keep dependencies updated
- Monitor database logs regularly
- Use environment variables for secrets

---

## Quick Reference Commands

### Test Injection Attack (Development Only)
```typescript
// These should be blocked by tRPC validation:
const maliciousInput = "'; DROP TABLE users; --";

// ✅ Safe - Will be rejected by Zod schema
await trpc.auth.register.mutate({
  email: maliciousInput // Schema validation will reject
});
```

### View Active Connections
```bash
# PostgreSQL
psql -U $USER -d $DB -c "SELECT * FROM pg_stat_activity;"
```

### Enable Query Logging
```typescript
// In development, log all queries:
const db = drizzle(client, { logger: true });
```

---

## Need More Protection?

Consider implementing:
1. **Web Application Firewall (WAF)** - Filter malicious requests
2. **Database Activity Monitoring** - Track suspicious queries
3. **Secrets Management** - Use HashiCorp Vault or AWS Secrets Manager
4. **Regular Security Audits** - Penetration testing
5. **Dependency Scanning** - npm audit, Snyk
