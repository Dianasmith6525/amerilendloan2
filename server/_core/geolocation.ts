/**
 * IP Geolocation service
 * Resolves an IP to a human-readable location with:
 *   - In-memory cache (24h TTL) to avoid rate limits
 *   - IPv4-mapped IPv6 normalization (::ffff:1.2.3.4 → 1.2.3.4)
 *   - Multi-provider fallback (ipwho.is → ip-api.com → ipapi.co)
 *   - Optional `geoip-lite` offline lookup as last resort
 */

import { logger } from "./logger";

export interface IPLocationData {
  country?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  source?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX = 500;
const FETCH_TIMEOUT_MS = 4000;

const cache = new Map<string, { data: IPLocationData; ts: number }>();

function normalizeIP(ip: string): string {
  let v = ip.trim();
  if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1);
  // Strip port suffix on IPv4 only (1.2.3.4:5678) — bare IPv6 has multiple colons
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(v)) v = v.split(":")[0];
  // IPv4-mapped IPv6
  if (v.toLowerCase().startsWith("::ffff:")) v = v.substring(7);
  return v;
}

function isPrivateOrReserved(ip: string): boolean {
  if (!ip) return true;
  const v = ip.toLowerCase();
  if (v === "::1" || v === "127.0.0.1" || v === "localhost") return true;
  if (/^(10|127)\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (/^169\.254\./.test(v)) return true;
  if (/^(0\.|22[4-9]\.|2[3-5]\d\.|255\.)/.test(v)) return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) return true;
  return false;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "AmeriLend-Geo/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Provider 1: ipwho.is (HTTPS, no key, generous limits, IPv6 OK) */
async function lookupIpwho(ip: string): Promise<IPLocationData | null> {
  const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (!data || data.success === false) return null;
  return {
    country: data.country,
    countryCode: data.country_code,
    state: data.region,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone?.id,
    isp: data.connection?.isp,
    source: "ipwho.is",
  };
}

/** Provider 2: ip-api.com — http free tier (server-side fetch is fine) */
async function lookupIpApi(ip: string): Promise<IPLocationData | null> {
  const data = await fetchJson(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp`
  );
  if (!data || data.status !== "success") return null;
  return {
    country: data.country,
    countryCode: data.countryCode,
    state: data.regionName,
    city: data.city,
    latitude: data.lat,
    longitude: data.lon,
    timezone: data.timezone,
    isp: data.isp,
    source: "ip-api.com",
  };
}

/** Provider 3: ipapi.co */
async function lookupIpapiCo(ip: string): Promise<IPLocationData | null> {
  const data = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
  if (!data || data.error) return null;
  return {
    country: data.country_name,
    countryCode: data.country_code,
    state: data.region,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    isp: data.org,
    source: "ipapi.co",
  };
}

/** Provider 4: offline geoip-lite (very rough, country/city level) */
function lookupOffline(ip: string): IPLocationData | null {
  try {
    // Lazy require so a missing/broken module doesn't crash the server
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const geoip = require("geoip-lite");
    const r = geoip.lookup(ip);
    if (!r) return null;
    return {
      country: r.country,
      countryCode: r.country,
      state: r.region,
      city: r.city,
      latitude: Array.isArray(r.ll) ? r.ll[0] : undefined,
      longitude: Array.isArray(r.ll) ? r.ll[1] : undefined,
      timezone: r.timezone,
      source: "geoip-lite",
    };
  } catch {
    return null;
  }
}

function putCache(ip: string, data: IPLocationData) {
  if (cache.size >= CACHE_MAX) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [k, v] of Array.from(cache)) {
      if (v.ts < cutoff) cache.delete(k);
    }
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  }
  cache.set(ip, { data, ts: Date.now() });
}

/** Get geolocation data from an IP address — uses cache + multi-provider fallback */
export async function getIPLocation(ipAddress?: string): Promise<IPLocationData> {
  if (!ipAddress) return {};
  const ip = normalizeIP(ipAddress);
  if (!ip || ip === "Unknown" || ip === "unknown") return {};
  if (isPrivateOrReserved(ip)) return { city: "Local Network", source: "private" };

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  // Try offline geoip-lite first — instant, no network
  const offline = lookupOffline(ip);
  if (offline && (offline.city || offline.country)) {
    putCache(ip, offline);
    // Kick off a background refresh from a real provider for accuracy
    refreshFromProvidersInBackground(ip);
    return offline;
  }

  // Otherwise try providers sequentially
  const providers: Array<() => Promise<IPLocationData | null>> = [
    () => lookupIpwho(ip),
    () => lookupIpApi(ip),
    () => lookupIpapiCo(ip),
  ];

  for (const fn of providers) {
    try {
      const result = await fn();
      if (result && (result.city || result.country)) {
        putCache(ip, result);
        return result;
      }
    } catch (e) {
      logger.warn(`[Geo] provider failed for ${ip}:`, e);
    }
  }

  logger.warn(`[Geo] All providers failed for IP ${ip}`);
  return {};
}

/** Best-effort background refresh — improves accuracy after the first hit */
function refreshFromProvidersInBackground(ip: string): void {
  setImmediate(async () => {
    try {
      const r =
        (await lookupIpwho(ip)) ||
        (await lookupIpApi(ip)) ||
        (await lookupIpapiCo(ip));
      if (r && (r.city || r.country)) putCache(ip, r);
    } catch {
      /* ignore */
    }
  });
}

/** Format location into a readable string */
export function formatLocation(location: IPLocationData): string {
  const parts: string[] = [];
  if (location.city && location.city !== "Local Network") parts.push(location.city);
  else if (location.city === "Local Network") return "Local Network";
  if (location.state && location.state !== location.city) parts.push(location.state);
  if (location.country) parts.push(location.country);
  return parts.length > 0 ? parts.join(", ") : "Location unavailable";
}

/** Get location string directly from IP address */
export async function getLocationFromIP(ipAddress?: string): Promise<string> {
  const location = await getIPLocation(ipAddress);
  return formatLocation(location);
}

/** Pretty-format an IP for display, normalizing IPv4-mapped IPv6 */
export function formatIPForDisplay(ipAddress?: string): string {
  if (!ipAddress) return "Not recorded";
  const v = normalizeIP(ipAddress);
  if (!v || v === "Unknown") return "Not recorded";
  return v;
}
