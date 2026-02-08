/**
 * Parses a number string to a float, handling both formats:
 * - Colombian format: comma as decimal separator (e.g., "12,50" -> 12.5)
 * - International format: dot as decimal separator (e.g., "12.50" -> 12.5)
 * - Strips percentage signs
 *
 * Detection logic:
 * - If there's a comma, assume Colombian format (dot=thousands, comma=decimal)
 * - If only dots exist, assume international format (dot=decimal)
 */
export function parseColombianNumber(value: string): number {
  let cleaned = value.trim().replace(/%/g, "").replace(/\s/g, "");

  const hasComma = cleaned.includes(",");

  if (hasComma) {
    // Colombian format: dot is thousands separator, comma is decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  // If only dots (international format), leave as-is for parseFloat

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    throw new Error(`Failed to parse number: "${value}"`);
  }

  return parsed;
}

/**
 * Extracts UVR spread from strings like:
 * - "UVR + 6,50%"
 * - "5.15% + UVR"
 * - "UVR+7,80%"
 */
export function parseUvrSpread(value: string): number {
  const patterns = [
    /UVR\s*\+\s*([\d,.]+)%?/i, // "UVR + 6,50%"
    /([\d,.]+)%?\s*\+\s*UVR/i, // "6,50% + UVR"
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      return parseColombianNumber(match[1]);
    }
  }

  throw new Error(`Failed to parse UVR spread: "${value}"`);
}

/**
 * Extracts E.A. percentage from strings like:
 * - "12,00%"
 * - "12.00% E.A."
 * - "Desde 11,50%"
 */
export function parseEaPercent(value: string): number {
  const cleaned = value.replace(/E\.?A\.?/gi, "").replace(/Desde/gi, "");
  return parseColombianNumber(cleaned);
}
