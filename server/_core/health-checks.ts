import { Request, Response } from "express";
import { getDb } from "../db";
import { redisClient } from "./rate-limiting";

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

// Main health check handler
export async function healthCheck(req: Request, res: Response) {
  try {
    const [dbStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      redisClient ? checkRedis() : Promise.resolve({ status: 'down' as const, error: 'Not configured' }),
    ]);

    const memory = getMemoryUsage();
    const cpu = getCpuUsage();

    // Determine overall health
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (dbStatus.status === 'down') {
      overallStatus = 'unhealthy';
    } else if (redisStatus.status === 'down' || memory.percentage > 90) {
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
      memory,
      cpu,
    };

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
