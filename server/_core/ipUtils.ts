import type { Request } from "express";

/**
 * Extract the real client IP address from a request.
 * Handles proxied requests (X-Forwarded-For, X-Real-IP, etc.)
 */
export function getClientIP(req: Request): string {
  // Check X-Forwarded-For header (proxy chain, take first IP)
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) 
      ? xForwardedFor[0] 
      : xForwardedFor.split(",")[0];
    return ips.trim();
  }

  // Check X-Real-IP header (single proxy)
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  // Fall back to socket remote address
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    // Remove IPv6 prefix if present (e.g., ::ffff:127.0.0.1)
    return socketIp.replace(/^::ffff:/, "");
  }

  // Final fallback
  return req.ip || "Unknown";
}
