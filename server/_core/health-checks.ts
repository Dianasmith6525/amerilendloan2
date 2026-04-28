import { Request, Response } from "express";
import { getDb } from "../db";
import { redisClient } from "./rate-limiting";
import { ENV } from "./env";
import { getBackupHealth } from "./database-backup";

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceStatus;
    redis?: ServiceStatus;
    storage?: ServiceStatus;
  };
  integrations?: {
    stripe: boolean;
    stripeWebhook: boolean;
    supabase: boolean;
    storage: boolean;
    oauthProviders: string[];
    jwtConfigured: boolean;
    appUrlConfigured: boolean;
    turnstile: boolean;
    twilio: boolean;
    sendgrid: boolean;
    encryption: boolean;
    openai: boolean;
    redis: boolean;
    emailTestMode: boolean;
    ownerOpenIdSet: boolean;
  };
  backup?: {
    lastBackupTime: string | null;
    lastBackupSuccess: boolean;
    ageHours: number | null;
    durableStorageConfigured: boolean;
    stale: boolean;
    lastError: string | null;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu?: {
    usage: number;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
}

// Check database health
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Simple query to check connection
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");
    return {
      status: 'up',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

// Check Redis health
async function checkRedis(): Promise<ServiceStatus> {
  if (!redisClient) {
    return { status: 'down', error: 'Redis not configured' };
  }

  const start = Date.now();
  try {
    await redisClient.ping();
    return {
      status: 'up',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

// Get memory usage
function getMemoryUsage() {
  const used = process.memoryUsage();
  const total = used.heapTotal;
  const percentage = (used.heapUsed / total) * 100;
  
  return {
    used: Math.round(used.heapUsed / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round(percentage),
  };
}

// Get CPU usage (simplified)
function getCpuUsage() {
  const usage = process.cpuUsage();
  const total = usage.user + usage.system;
  return {
    usage: Math.round((total / 1000000) * 100) / 100, // seconds
  };
}

// Report which third-party integrations are configured. We never return
// secrets — only booleans and provider names — so this endpoint is safe to
// expose for production smoke tests.
function getIntegrationStatus() {
  const oauthProviders: string[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) oauthProviders.push("google");
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) oauthProviders.push("github");
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) oauthProviders.push("microsoft");
  if (process.env.OAUTH_SERVER_URL) oauthProviders.push("generic");

  return {
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    // True only when STRIPE_WEBHOOK_SECRET is set; without it Stripe webhook
    // calls are unverified and the server rejects them, so card payments may
    // get stuck in `pending`.
    stripeWebhook: Boolean(ENV.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
    // The codebase reads Supabase config from VITE_SUPABASE_URL /
    // VITE_SUPABASE_ANON_KEY (see env.ts). Accept both naming conventions so
    // this flag stays accurate regardless of which env-var spelling is set.
    supabase: Boolean(
      (ENV.supabaseUrl || process.env.SUPABASE_URL) &&
      (ENV.supabaseAnonKey || process.env.SUPABASE_ANON_KEY)
    ),
    storage: Boolean(ENV.forgeApiUrl && ENV.forgeApiKey),
    oauthProviders,
    jwtConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
    appUrlConfigured: Boolean(ENV.viteAppUrl || process.env.VITE_APP_URL),
    // Cloudflare Turnstile bot verification on public forms. When false,
    // anonymous loan-submit / contact / OTP-request endpoints are protected
    // only by rate-limiting (defeatable with rotating IPs).
    turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY && (ENV.turnstileSiteKey || process.env.VITE_TURNSTILE_SITE_KEY)),
    // SMS via Twilio — when false, otp.requestPhoneCode silently no-ops.
    twilio: Boolean(ENV.twilioAccountSid && ENV.twilioAuthToken && ENV.twilioPhoneNumber),
    // Email via SendGrid — when false, every email path returns success: false
    // and only logs to console, so users never receive OTP / receipt / reset emails.
    sendgrid: Boolean(ENV.sendGridApiKey),
    // Field-level encryption key used for KYC data. Schema requires >=32 chars.
    encryption: Boolean(ENV.encryptionKey && ENV.encryptionKey.length >= 32),
    // OpenAI API key — only matters for AI loan-summary feature.
    openai: Boolean(ENV.openAiApiKey),
    // Redis is required for distributed rate-limiting once we have >1 replica.
    redis: Boolean(redisClient),
    // Test mode redirects every email to a logger instead of sending it.
    emailTestMode: ENV.emailTestMode,
    // Bootstrap admin OpenID — without it no one is auto-admin on a fresh DB.
    ownerOpenIdSet: Boolean(ENV.ownerOpenId),
  };
}

// Surface backup health on /health/detailed so we can spot silent backup
// failures without needing an admin login. Considers a backup "stale" once it
// is more than ~26h old (scheduler runs every 6h, so 26h means at least 4
// scheduled runs missed). Also flags when durable object storage is not
// configured — on ephemeral hosts (Railway/Vercel) that means every redeploy
// wipes every backup.
function getBackupSnapshot() {
  const health = getBackupHealth();
  const ageHours = health.timestamp
    ? (Date.now() - new Date(health.timestamp).getTime()) / (1000 * 60 * 60)
    : null;
  // Forge object storage OR an explicit BACKUP_DIR (e.g. mounted Railway
  // volume) both count as durable destinations.
  const durableStorageConfigured = Boolean(
    (ENV.forgeApiUrl && ENV.forgeApiKey) || process.env.BACKUP_DIR
  );
  const stale = ageHours === null ? true : ageHours > 26;
  return {
    lastBackupTime: health.timestamp,
    lastBackupSuccess: health.success,
    ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
    durableStorageConfigured,
    stale,
    lastError: health.error || null,
  };
}

// Live probe — actually call the LLM with a 1-token prompt to confirm the
// configured key is valid. Only runs when explicitly requested
// (?probe=llm) since it costs an API call.
async function probeLlm(): Promise<{ ok: boolean; provider: string; latencyMs: number; error: string | null }> {
  const start = Date.now();
  const provider = ENV.groqApiKey ? "groq" : ENV.geminiApiKey ? "gemini" : ENV.openAiApiKey ? "openai" : ENV.forgeApiKey ? "forge" : "none";
  if (provider === "none") {
    return { ok: false, provider, latencyMs: 0, error: "No LLM key configured. Set GROQ_API_KEY (free), GEMINI_API_KEY (free), OPENAI_API_KEY, or BUILT_IN_FORGE_API_KEY" };
  }
  try {
    const { invokeLLM } = await import("./llm");
    const res = await invokeLLM({
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 5,
      temperature: 0,
    });
    const text = res.choices?.[0]?.message?.content;
    return {
      ok: true,
      provider,
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Main health check handler
export async function healthCheck(req: Request, res: Response) {
  try {
    const [dbStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      redisClient ? checkRedis() : Promise.resolve({ status: 'down' as const, error: 'Not configured' }),
    ]);

    const memory = getMemoryUsage();
    const cpu = getCpuUsage();

    const backup = getBackupSnapshot();

    // Optional live LLM probe — only runs when ?probe=llm is set in the URL.
    const llmProbe = req.query.probe === "llm" ? await probeLlm() : undefined;

    // Determine overall health
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (dbStatus.status === 'down') {
      overallStatus = 'unhealthy';
    } else if (
      redisStatus.status === 'down' ||
      memory.percentage > 90 ||
      // Treat a stale backup or non-durable backup target as degraded so
      // monitoring picks it up before disaster recovery is needed.
      (process.env.NODE_ENV === 'production' && (backup.stale || !backup.durableStorageConfigured))
    ) {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      integrations: getIntegrationStatus(),
      backup,
      memory,
      cpu,
    };

    if (llmProbe) {
      (result as any).llmProbe = llmProbe;
    }

    // Return appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
}

// Readiness check (for k8s/container orchestration)
export async function readinessCheck(req: Request, res: Response) {
  try {
    const dbStatus = await checkDatabase();
    
    if (dbStatus.status === 'up') {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Database not available' });
    }
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      reason: error instanceof Error ? error.message : 'Readiness check failed' 
    });
  }
}

// Liveness check (for k8s/container orchestration)
export async function livenessCheck(req: Request, res: Response) {
  // Simple check - if we can respond, we're alive
  res.status(200).json({ alive: true });
}

// Metrics endpoint (Prometheus-compatible)
export async function metricsEndpoint(req: Request, res: Response) {
  try {
    const memory = getMemoryUsage();
    const cpu = getCpuUsage();
    
    const metrics = `
# HELP nodejs_memory_usage_bytes Memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="used"} ${memory.used * 1024 * 1024}
nodejs_memory_usage_bytes{type="total"} ${memory.total * 1024 * 1024}

# HELP nodejs_cpu_usage_seconds CPU usage in seconds
# TYPE nodejs_cpu_usage_seconds counter
nodejs_cpu_usage_seconds ${cpu.usage}

# HELP nodejs_uptime_seconds Process uptime in seconds
# TYPE nodejs_uptime_seconds counter
nodejs_uptime_seconds ${process.uptime()}

# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1
    `.trim();

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('# Error generating metrics');
  }
}
