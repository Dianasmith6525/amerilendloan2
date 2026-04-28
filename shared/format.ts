/**
 * Shared formatting utilities used across client and server.
 */

/**
 * Capitalizes the first letter of each word in a string (Title Case).
 * Handles hyphenated names (e.g., "mary-jane" → "Mary-Jane"),
 * apostrophes (e.g., "o'brien" → "O'Brien"),
 * and "Mc/Mac" prefixes (e.g., "mcdonald" → "McDonald").
 *
 * Safe to call on every keystroke — preserves cursor-friendly behavior
 * by only capitalizing, never rearranging characters.
 */
export function toTitleCase(value: string): string {
  if (!value) return value;

  return value.replace(
    /(?:^|[\s\-'])([a-zA-Z])/g,
    (_match, letter, offset) => {
      // Rebuild the exact prefix character(s) then uppercase the letter
      const prefix = value.slice(
        offset === 0 ? 0 : offset,
        offset + _match.length - 1,
      );
      return (offset === 0 ? "" : prefix) + letter.toUpperCase();
    },
  );
}

/**
 * A simpler version that just capitalizes the first letter of each
 * whitespace-separated word. Use this when you don't need hyphen/
 * apostrophe handling (e.g., city names).
 */
export function capitalizeWords(value: string): string {
  if (!value) return value;
  return value.replace(/(^|\s)([a-z])/g, (_m, space, ch) => space + ch.toUpperCase());
}

/**
 * Returns a friendly, properly-cased first name for greetings.
 * Prefers `firstName`, then the first token of `name`, then the
 * local part of `email` (with separators normalized to spaces).
 * Falls back to "there" so we never expose a raw email address.
 */
export function getFriendlyFirstName(user?: {
  firstName?: string | null;
  name?: string | null;
  email?: string | null;
} | null): string {
  if (!user) return "there";

  const isEmailLike = (s?: string | null) => !!s && s.includes("@");

  const fromFirst = user.firstName?.trim();
  if (fromFirst && !isEmailLike(fromFirst)) return toTitleCase(fromFirst);

  const fromName = user.name?.trim().split(/\s+/)[0];
  if (fromName && !isEmailLike(fromName)) return toTitleCase(fromName);

  const local = user.email?.split("@")[0];
  if (local) {
    const cleaned = local.replace(/[._\-+]+/g, " ").replace(/\d+/g, "").trim();
    const firstWord = cleaned.split(/\s+/)[0];
    if (firstWord) return toTitleCase(firstWord);
  }

  return "there";
}

/**
 * Returns a properly-cased full name (e.g. "Diana Smith") for display.
 * Prefers the structured firstName/lastName columns, falls back to the
 * legacy `name` field, then the email local-part. Never returns the raw
 * email so we don't leak it in UI surfaces.
 */
export function getFriendlyFullName(user?: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
} | null): string {
  if (!user) return "User";

  const isEmailLike = (s?: string | null) => !!s && s.includes("@");

  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  const safeFirst = first && !isEmailLike(first) ? first : undefined;
  const safeLast = last && !isEmailLike(last) ? last : undefined;
  if (safeFirst || safeLast) {
    return [safeFirst, safeLast].filter(Boolean).map((p) => toTitleCase(p as string)).join(" ");
  }

  const fromName = user.name?.trim();
  if (fromName && !isEmailLike(fromName)) return toTitleCase(fromName);

  return getFriendlyFirstName(user);
}
