import { randomBytes } from "crypto";

const SESSION_TOKENS = new Map(); // In production, use Redis or database

/**
 * Generate a CSRF token for a session
 * @param sessionId - The session ID (typically from auth token or session cookie)
 * @returns CSRF token
 */
export const generateCSRFToken = (sessionId) => {
  if (!sessionId) {
    throw new Error("Session ID is required to generate CSRF token");
  }

  const token = randomBytes(32).toString("hex");
  SESSION_TOKENS.set(sessionId, token);

  // Set expiry for token (30 minutes)
  setTimeout(() => {
    SESSION_TOKENS.delete(sessionId);
  }, 30 * 60 * 1000);

  return token;
};

/**
 * Verify a CSRF token
 * @param sessionId - The session ID
 * @param token - The token to verify
 * @returns true if valid, false otherwise
 */
export const verifyCSRFToken = (sessionId, token) => {
  if (!sessionId || !token) {
    return false;
  }

  const storedToken = SESSION_TOKENS.get(sessionId);
  if (!storedToken) {
    return false;
  }

  const isValid = storedToken === token;
  if (isValid) {
    SESSION_TOKENS.delete(sessionId); // Invalidate token after use
  }

  return isValid;
};

/**
 * Middleware to validate CSRF tokens on POST/PUT/DELETE requests
 */
export const csrfProtection = (req, res, next) => {
  // Skip CSRF validation for GET requests and public endpoints
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF for certain public endpoints that don't require auth
  const publicEndpoints = ["/api/contact", "/api/register"];
  if (publicEndpoints.some((ep) => req.path.startsWith(ep))) {
    return next();
  }

  const sessionId = req.userInfo?.user_id || req.headers["x-session-id"];
  const csrfToken = req.headers["x-csrf-token"] || req.body?.csrf_token;

  if (!sessionId) {
    return res.status(401).json({ error: "Session ID is required." });
  }

  if (!csrfToken) {
    return res.status(403).json({ error: "CSRF token is missing." });
  }

  if (!verifyCSRFToken(sessionId, csrfToken)) {
    return res.status(403).json({ error: "CSRF token is invalid or expired." });
  }

  next();
};

/**
 * Middleware to provide CSRF token to client
 */
export const csrfTokenProvider = (req, res, next) => {
  const sessionId = req.userInfo?.user_id || req.headers["x-session-id"];

  if (sessionId) {
    try {
      const token = generateCSRFToken(sessionId);
      res.locals.csrfToken = token;
      res.setHeader("X-CSRF-Token", token);
    } catch (err) {
      console.error("Error generating CSRF token:", err);
    }
  }

  next();
};
