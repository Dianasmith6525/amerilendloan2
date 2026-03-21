import { logger } from "./logger";

/**
 * OFAC / Sanctions Screening Service
 *
 * Checks users against the US Treasury OFAC SDN (Specially Designated Nationals)
 * list and other sanctions lists.
 *
 * In production this should hit the real Treasury OFAC API or a third-party
 * compliance provider (e.g., Dow Jones, LexisNexis, ComplyAdvantage).
 * This implementation provides a structured interface with a stub backend
 * that can be swapped for a real provider.
 */

export interface OFACScreeningRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string; // YYYY-MM-DD
  address?: string;
  country?: string;
  ssnLast4?: string; // Last 4 of SSN for additional matching
}

export interface OFACMatch {
  sdnName: string;
  matchScore: number; // 0-100
  sdnType: string; // "individual" | "entity"
  program: string; // e.g., "SDGT", "IRAN", "SYRIA"
  remarks?: string;
}

export interface OFACScreeningResult {
  clear: boolean; // true = no matches, false = potential match found
  screenedAt: Date;
  matchCount: number;
  matches: OFACMatch[];
  screeningId: string; // Unique ID for audit trail
  provider: string;
  error?: string;
}

// Generate a unique screening ID for audit purposes
function generateScreeningId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `OFAC-${timestamp}-${random}`.toUpperCase();
}

/**
 * Screen a person against the OFAC SDN list.
 *
 * Currently this is a stub that always returns clear.
 * To integrate a real provider, replace the body of this function
 * with an HTTP call to the provider's API.
 */
export async function screenAgainstOFAC(
  request: OFACScreeningRequest
): Promise<OFACScreeningResult> {
  const screeningId = generateScreeningId();

  logger.info(`[OFAC] Screening initiated: ${screeningId} for ${request.firstName} ${request.lastName}`);

  try {
    // ── Real provider integration point ──
    // Replace this block with a real API call, e.g.:
    //
    //   const response = await fetch('https://api.complyadvantage.com/searches', {
    //     method: 'POST',
    //     headers: { 'Authorization': `Token ${process.env.COMPLY_ADVANTAGE_API_KEY}` },
    //     body: JSON.stringify({ search_term: `${request.firstName} ${request.lastName}`, ... }),
    //   });
    //   const data = await response.json();
    //   return mapProviderResponse(data, screeningId);
    //
    // For now, we return a clear result to allow the KYC workflow to proceed.

    const result: OFACScreeningResult = {
      clear: true,
      screenedAt: new Date(),
      matchCount: 0,
      matches: [],
      screeningId,
      provider: "internal-stub",
    };

    logger.info(`[OFAC] Screening complete: ${screeningId} — clear: ${result.clear}`);
    return result;
  } catch (error) {
    logger.error(`[OFAC] Screening failed: ${screeningId}`, error);
    return {
      clear: false, // Conservative: treat failure as not clear
      screenedAt: new Date(),
      matchCount: 0,
      matches: [],
      screeningId,
      provider: "internal-stub",
      error: error instanceof Error ? error.message : "OFAC screening failed",
    };
  }
}

/**
 * Validate a US Social Security Number format.
 *
 * Rules per SSA:
 * - 9 digits in format AAA-GG-SSSS
 * - Area (AAA) cannot be 000, 666, or 900-999
 * - Group (GG) cannot be 00
 * - Serial (SSSS) cannot be 0000
 *
 * This does NOT call the SSA verification API (which requires
 * employer authorization). It validates format only.
 */
export function validateSSNFormat(ssn: string): {
  valid: boolean;
  error?: string;
  maskedSSN?: string; // "***-**-1234"
} {
  // Strip any non-digit characters
  const digits = ssn.replace(/\D/g, "");

  if (digits.length !== 9) {
    return { valid: false, error: "SSN must be exactly 9 digits" };
  }

  const area = parseInt(digits.substring(0, 3), 10);
  const group = parseInt(digits.substring(3, 5), 10);
  const serial = parseInt(digits.substring(5, 9), 10);

  if (area === 0 || area === 666 || area >= 900) {
    return { valid: false, error: "Invalid SSN area number" };
  }

  if (group === 0) {
    return { valid: false, error: "Invalid SSN group number" };
  }

  if (serial === 0) {
    return { valid: false, error: "Invalid SSN serial number" };
  }

  return {
    valid: true,
    maskedSSN: `***-**-${digits.substring(5)}`,
  };
}

/**
 * Validate an Individual Taxpayer Identification Number (ITIN) format.
 *
 * ITINs:
 * - Start with 9
 * - 4th and 5th digits are in range 50-65, 70-88, 90-92, 94-99
 * - Format: 9XX-XX-XXXX
 */
export function validateITINFormat(itin: string): {
  valid: boolean;
  error?: string;
  maskedITIN?: string;
} {
  const digits = itin.replace(/\D/g, "");

  if (digits.length !== 9) {
    return { valid: false, error: "ITIN must be exactly 9 digits" };
  }

  if (digits[0] !== "9") {
    return { valid: false, error: "ITIN must start with 9" };
  }

  const group = parseInt(digits.substring(3, 5), 10);
  const validGroups =
    (group >= 50 && group <= 65) ||
    (group >= 70 && group <= 88) ||
    (group >= 90 && group <= 92) ||
    (group >= 94 && group <= 99);

  if (!validGroups) {
    return { valid: false, error: "Invalid ITIN group number" };
  }

  return {
    valid: true,
    maskedITIN: `***-**-${digits.substring(5)}`,
  };
}
