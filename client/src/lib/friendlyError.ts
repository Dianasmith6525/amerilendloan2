/**
 * Convert technical/server error messages to user-friendly text.
 * Use this in every onError callback instead of showing raw error.message.
 */
export function friendlyError(
  rawMessage: string | undefined | null,
  fallback = "Something went wrong. Please try again or contact support."
): string {
  if (!rawMessage) return fallback;

  const msg = rawMessage.trim();

  // Duplicate / conflict
  if (/duplicate|already exists|conflict/i.test(msg)) return msg;

  // Network issues
  if (/failed to fetch|networkerror|network|ERR_INTERNET/i.test(msg))
    return "Unable to reach our servers. Please check your internet connection and try again.";

  // Timeout
  if (/timeout/i.test(msg)) return "The request took too long. Please try again.";

  // Auth / session
  if (/unauthorized|unauthenticated|session.*expired/i.test(msg))
    return "Your session has expired. Please log in again.";

  // Database / server config
  if (/database|connection.*refused|ECONNREFUSED/i.test(msg))
    return "We're experiencing a temporary server issue. Please try again in a few minutes.";

  if (/INTERNAL_SERVER_ERROR/i.test(msg))
    return "Something went wrong on our end. Please try again or contact support.";

  if (/require is not defined|is not a function|cannot read prop/i.test(msg))
    return "A server error occurred. Please contact support.";

  // Zod / input validation errors
  if (/invalid_type|too_small|too_big|invalid_string|invalid_enum|expected|validation|invalid input/i.test(msg))
    return "Please review your information — some fields are missing or have incorrect values.";

  // Stack traces, JSON blobs, or very long messages — never show them raw
  if (msg.length > 200 || /^\{/.test(msg) || /\bat\s+\w/.test(msg) || /Error:\s/.test(msg))
    return fallback;

  // Otherwise the message is probably already readable (e.g. "Email already in use")
  return msg;
}
