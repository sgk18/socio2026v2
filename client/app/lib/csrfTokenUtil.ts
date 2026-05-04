/**
 * Client-side CSRF token management utility
 * Fetches CSRF tokens from server and includes them in API requests
 */

let cachedCSRFToken: string | null = null;
let cachedCSRFTokenTimestamp: number = 0;
const CSRF_TOKEN_CACHE_DURATION = 25 * 60 * 1000; // 25 minutes (token expires at 30)

/**
 * Fetch a new CSRF token from the server
 */
export async function fetchCSRFToken(): Promise<string> {
  try {
    // Check if cached token is still valid
    if (
      cachedCSRFToken &&
      Date.now() - cachedCSRFTokenTimestamp < CSRF_TOKEN_CACHE_DURATION
    ) {
      return cachedCSRFToken;
    }

    // Fetch new token from a simple GET endpoint (no CSRF needed for GET)
    const response = await fetch("/api/csrf-token", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
    }

    const token = response.headers.get("x-csrf-token");
    if (!token) {
      throw new Error("No CSRF token in response headers");
    }

    cachedCSRFToken = token;
    cachedCSRFTokenTimestamp = Date.now();

    return token;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
}

/**
 * Make an API request with automatic CSRF token inclusion
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";

  // Only add CSRF token for state-changing requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    try {
      const csrfToken = await fetchCSRFToken();
      const headers = new Headers(options.headers || {});
      headers.set("x-csrf-token", csrfToken);
      options.headers = headers;
    } catch (error) {
      console.warn("CSRF token not available, request may fail:", error);
      // Continue anyway, server will validate
    }
  }

  return fetch(url, options);
}

/**
 * Clear cached CSRF token (e.g., on logout)
 */
export function clearCSRFToken(): void {
  cachedCSRFToken = null;
  cachedCSRFTokenTimestamp = 0;
}
