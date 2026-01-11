import pRetry from "p-retry";

export type FetchResult = {
  content: Buffer;
  contentType: string;
  lastModified?: string;
  etag?: string;
  statusCode: number;
};

const DEFAULT_USER_AGENT =
  "MejorTasa/1.0 (https://github.com/mejor-tasa; mortgage rate aggregator)";
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
  } = {}
): Promise<FetchResult> {
  const { retries = 3, timeoutMs = 30000, headers = {}, useBrowserUserAgent = false } = options;

  return pRetry(
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
}
