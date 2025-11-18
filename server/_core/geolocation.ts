/**
 * IP Geolocation service
 * Converts IP addresses to geographic location information
 */

export interface IPLocationData {
  country?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

/**
 * Check if an IP address is private/local
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^127\./, // Loopback
    /^10\./, // Private
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private
    /^192\.168\./, // Private
    /^::1$/, // IPv6 loopback
    /^fc00:/i, // IPv6 private
    /^fe80:/i, // IPv6 link-local
    /^localhost/i,
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Get geolocation data from an IP address using ip-api.com
 */
export async function getIPLocation(ipAddress?: string): Promise<IPLocationData> {
  if (!ipAddress || ipAddress === 'Unknown') {
    return {};
  }

  try {
    // Skip private/local IPs
    if (isPrivateIP(ipAddress)) {
      return { city: 'Local Network' };
    }

    // Use ip-api.com's free geolocation service
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://ip-api.com/json/${ipAddress}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { city: 'Unknown Location' };
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return { city: 'Unknown Location' };
    }

    return {
      country: data.country,
      countryCode: data.countryCode,
      state: data.regionName,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
    };
  } catch (error) {
    console.error('Error fetching IP geolocation:', error);
    return { city: 'Unknown Location' };
  }
}

/**
 * Format location data into a readable string
 */
export function formatLocation(location: IPLocationData): string {
  const parts: string[] = [];

  if (location.city) parts.push(location.city);
  if (location.state && location.state !== location.city) parts.push(location.state);
  if (location.country) parts.push(location.country);

  return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
}

/**
 * Get location string directly from IP address
 */
export async function getLocationFromIP(ipAddress?: string): Promise<string> {
  const location = await getIPLocation(ipAddress);
  return formatLocation(location);
}
