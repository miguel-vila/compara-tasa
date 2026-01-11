/**
 * Parses a Colombian-format number string to a float.
 * Handles:
 * - Comma as decimal separator (e.g., "12,50" -> 12.5)
 * - Dot as thousands separator (e.g., "1.000,50" -> 1000.5)
 * - Strips percentage signs
 */
export function parseColombianNumber(value: string): number {
  const cleaned = value
    .trim()
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "") // Remove thousands separator
    .replace(",", "."); // Convert decimal comma to dot

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
