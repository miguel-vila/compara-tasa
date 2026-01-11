import pRetry from "p-retry";

export type FetchResult = {
  content: Buffer;
  contentType: string;
  lastModified?: string;
  etag?: string;
  statusCode: number;
};

/**
 * Fetches a URL with retries and returns the response with metadata
 */
export async function fetchWithRetry(
  url: string,
  options: {
    retries?: number;
    timeoutMs?: number;
  } = {}
): Promise<FetchResult> {
  const { retries = 3, timeoutMs = 30000 } = options;

  return pRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "MejorTasa/1.0 (https://github.com/mejor-tasa; mortgage rate aggregator)",
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
