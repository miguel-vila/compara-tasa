import pRetry from "p-retry";

export type FetchResult = {
  content: Buffer;
  contentType: string;
  lastModified?: string;
  etag?: string;
  statusCode: number;
};

const DEFAULT_USER_AGENT =
  "ComparaTasa/1.0 (https://github.com/compara-tasa; mortgage rate aggregator)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetches a URL with retries and returns the response with metadata
 */
export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number;
    timeoutMs?: number;
    headers?: Record<string, string>;
    useBrowserUserAgent?: boolean;
    /** Skip SSL certificate verification (use only for sites with known cert chain issues) */
    skipSslVerification?: boolean;
  } = {}
): Promise<FetchResult> {
  const {
    retries = 3,
    timeoutMs = 30000,
    headers = {},
    useBrowserUserAgent = false,
    skipSslVerification = false,
  } = options;

  // Temporarily disable SSL verification if requested
  const originalTlsSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (skipSslVerification) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  try {
    return await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": useBrowserUserAgent ? BROWSER_USER_AGENT : DEFAULT_USER_AGENT,
              ...headers,
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const content = Buffer.from(await response.arrayBuffer());

          return {
            content,
            contentType: response.headers.get("content-type") || "unknown",
            lastModified: response.headers.get("last-modified") || undefined,
            etag: response.headers.get("etag") || undefined,
            statusCode: response.status,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      },
      {
        retries,
        onFailedAttempt: (error) => {
          console.warn(`Fetch attempt ${error.attemptNumber} failed for ${url}: ${error.message}`);
        },
      }
    );
  } finally {
    // Restore original SSL setting
    if (skipSslVerification) {
      if (originalTlsSetting === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsSetting;
      }
    }
  }
}

// Spanish month names for URL construction
const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const BANCO_DE_BOGOTA_BASE_URL = "https://www.bancodebogota.com/documents/d/guest";

function isHttp404(error: unknown): boolean {
  return error instanceof Error && error.message.includes("HTTP 404");
}

/**
 * Fetches Banco de Bogotá PDF with month-based URL resolution.
 * Tries current month first, falls back to previous month if 404.
 */
export async function fetchBancoDeBogotaPdf(
  options?: Parameters<typeof fetchWithRetry>[1]
): Promise<FetchResult & { resolvedUrl: string }> {
  const now = new Date();

  // Try current month first
  const currentMonth = SPANISH_MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();
  const currentUrl = `${BANCO_DE_BOGOTA_BASE_URL}/tasas-${currentMonth}-${currentYear}`;

  try {
    const result = await fetchWithRetry(currentUrl, { ...options, retries: 0 });
    return { ...result, resolvedUrl: currentUrl };
  } catch (error) {
    // If 404, try previous month
    if (isHttp404(error)) {
      // JavaScript handles month -1 correctly: Jan 2025 - 1 month = Dec 2024
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = SPANISH_MONTHS[prevDate.getMonth()];
      const prevYear = prevDate.getFullYear();
      const prevUrl = `${BANCO_DE_BOGOTA_BASE_URL}/tasas-${prevMonth}-${prevYear}`;

      console.log(
        `Banco de Bogotá: current month URL returned 404, trying previous month: ${prevUrl}`
      );
      const result = await fetchWithRetry(prevUrl, options);
      return { ...result, resolvedUrl: prevUrl };
    }
    throw error;
  }
}
