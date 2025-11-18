# Database Connection Troubleshooting Guide

## Quick Status Check

### Check if Server is Running
```bash
# Test if server responds
curl http://localhost:3000/api/trpc/system.health

# Should return: {"result":{"data":{"ok":true,"timestamp":"..."}}}
```

### Check Database Connection
```bash
# Check database health status
curl http://localhost:3000/api/trpc/system.dbHealth

# Should return: {"result":{"data":{"status":"healthy","connected":true,...}}}
```

---

## Common Issues & Solutions

### 1. ❌ "DATABASE_URL not set" Error

**Problem:** Application crashes on startup with "DATABASE_URL not configured"

**Solution:**
```bash
# Check if DATABASE_URL is set
echo $env:DATABASE_URL

# If empty, set it:
$env:DATABASE_URL="postgresql://user:password@host:port/database"

# Or add to .env file:
echo "DATABASE_URL=postgresql://user:password@host:port/database" >> .env

# Restart server:
npm run dev
```

**What to Check:**
- Is PostgreSQL server running?
- Are credentials correct (user/password)?
- Is database name spelled correctly?
- Is host accessible (localhost vs hostname)?

---

### 2. ⚠️ "SSL Certificate Error" / "SSL Validation Error"

**Problem:** Connection fails with SSL/TLS error

**Solution:**

For **Development** (local):
```typescript
// ✅ Already configured in db.ts
ssl: process.env.NODE_ENV === 'production' ? 'require' : false
```

For **Production** (Supabase/Cloud):
```bash
# Set environment variable
$env:NODE_ENV="production"

# Ensure DATABASE_URL uses postgresql:// (not postgres://)
# Example: postgresql://user:password@host/db
```

---

### 3. 🔴 "Connection Refused"

**Problem:** Error: `ECONNREFUSED` or "connection refused"

**Solution:**
```bash
# Check if PostgreSQL is running
psql -U postgres -h localhost

# If not running, start it:
# On macOS:
brew services start postgresql

# On Windows (with PostgreSQL installed):
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start

# On Linux:
sudo systemctl start postgresql
```

---

### 4. 🔐 "Authentication Failed"

**Problem:** Error: `authentication failed for user`

**Solution:**
```bash
# Test database credentials manually
psql -U your_username -h localhost -d database_name

# If password has special characters, encode them:
# Before:   password@123!
# Encoded:  password%40123%21

# DATABASE_URL should be:
# postgresql://user:password%40123%21@host/db
```

**Common Issues:**
- Wrong username or password
- User doesn't have permission for this database
- User was deleted or disabled

---

### 5. ⏱️ "Connection Timeout"

**Problem:** Server hangs during database operations

**Solution:**
```bash
# Increase connection timeout (in db.ts):
// connection_timeout: 30 // 30 seconds

# Check if database is responding:
ping database-host

# Check network connectivity:
telnet host port

# Example for Supabase:
# telnet aws-1-us-east-1.pooler.supabase.com 6543
```

---

### 6. 🚀 "Too Many Connections"

**Problem:** Error: `too many connections`

**Solution:**
```bash
# Reduce connection pool size (in db.ts):
// Pool config in postgres-js
// The default is usually 10-25

# Close idle connections:
psql -U postgres -h localhost -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'your_database' AND state = 'idle'
"

# Restart application:
npm run dev
```

---

## Checking Connection Status

### Via API Endpoints

```bash
# 1. Basic health check
curl http://localhost:3000/api/trpc/system.health

# 2. Database health (public)
curl http://localhost:3000/api/trpc/system.dbHealth

# 3. Database diagnostics (admin only)
# Requires authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/trpc/system.dbStatus
```

### In Server Logs

Look for these messages:

```
✅ Successfully connected to database (450ms)
// Good - connection established

❌ Failed to connect: [error message]
// Bad - connection failed

⚠️ Connection lost, attempting to reconnect...
// Recovering - will retry

[HealthCheck] Database healthy (12ms)
// Good - health check passed

[HealthCheck] Database UNHEALTHY: [error]
// Bad - health check failed
```

---

## Monitoring Database Connection

### Check Connection Status

```bash
# View active connections
psql -U postgres -h localhost -c "
  SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_database';
"

# View detailed connection info
psql -U postgres -h localhost -c "
  SELECT 
    pid,
    usename,
    state,
    state_change,
    query
  FROM pg_stat_activity 
  WHERE datname = 'your_database';
"
```

### Monitor in Real-Time

```bash
# Watch connections every 5 seconds
watch -n 5 'psql -U postgres -h localhost -c "SELECT count(*) FROM pg_stat_activity WHERE datname = \"your_database\";"'
```

---

## Database Configuration Checklist

- [ ] DATABASE_URL is set as environment variable
- [ ] PostgreSQL server is running and accessible
- [ ] Database user has correct permissions
- [ ] Database exists
- [ ] Connection credentials are correct
- [ ] Firewall allows connection to database port
- [ ] SSL settings match deployment environment
- [ ] Connection timeout is appropriate
- [ ] Connection pool size is configured
- [ ] Database backups are automated

---

## Advanced Troubleshooting

### Enable SQL Query Logging

```typescript
// In server/db.ts
const db = drizzle(_client, { logger: true });

// Now all SQL queries will be logged to console
```

### Check Drizzle ORM Configuration

```typescript
// Current configuration in server/db.ts
_client = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  idle_timeout: 30,           // 30 seconds
  max_lifetime: 60 * 60,      // 1 hour
  connection_timeout: 10,     // 10 seconds
});
```

### Manual Connection Test

```typescript
// Test file: test-db.ts
import postgres from 'postgres';

async function testConnection() {
  try {
    const sql = postgres(process.env.DATABASE_URL, {
      ssl: false,
    });
    
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Connection successful:', result);
    
    await sql.end();
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();
```

Run with:
```bash
npx tsx test-db.ts
```

---

## Recovery Steps (If Database Goes Down)

### 1. Immediate Action
```bash
# Stop the application
# Press Ctrl+C in terminal

# Check PostgreSQL status
pg_ctl status -D /path/to/data

# Restart PostgreSQL
pg_ctl restart -D /path/to/data
```

### 2. Verify Recovery
```bash
# Test connection
psql -U username -h localhost -d database_name

# Check application logs
npm run dev

# Test API
curl http://localhost:3000/api/trpc/system.health
```

### 3. Reset Connection Pool
```typescript
// The application will automatically retry
// Health checks run every 30 seconds
// Connection will be re-established automatically
```

---

## Getting Help

### Collect This Information

1. Error message (exact text)
2. Timestamp of error
3. SERVER logs (last 100 lines)
4. Output of `npm run check`
5. Database status:
   ```bash
   psql -U postgres -h localhost -c "SELECT version();"
   ```
6. Environment:
   ```bash
   echo $env:NODE_ENV
   echo $env:DATABASE_URL (first 30 chars only)
   ```

### Check Application Status

```bash
# Terminal 1: Check if server is running
curl http://localhost:3000/api/trpc/system.health

# Terminal 2: Check database health
curl http://localhost:3000/api/trpc/system.dbHealth

# Terminal 3: View real-time logs
npm run dev
```

---

## Database Reconnection Logic

Your application automatically handles reconnection:

```
1. Connection fails
   ↓
2. Log error
   ↓
3. Wait 1-10 seconds (exponential backoff)
   ↓
4. Retry connection
   ↓
5. If successful: resume operations
   If fails: repeat
```

**Max retries:** 3 attempts per operation
**Backoff:** 1s, 2s, 4s, up to 10s max

---

## Production Best Practices

- [ ] Use connection pooling (configured)
- [ ] Set appropriate connection timeouts
- [ ] Monitor connection pool metrics
- [ ] Enable database query logging
- [ ] Regular backup tests
- [ ] Monitor disk space
- [ ] Set up alerts for connection failures
- [ ] Document connection parameters
- [ ] Test failover procedures

---

**Last Updated:** November 17, 2025
