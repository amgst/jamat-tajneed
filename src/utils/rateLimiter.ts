/**
 * Rate Limiting Utilities
 * Prevents brute force attacks by limiting login attempts
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

// Store rate limit data in memory (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 5, // Maximum failed attempts
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes window
  BLOCK_DURATION_MS: 30 * 60 * 1000, // Block for 30 minutes after max attempts
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // Clean up old entries every hour
};

/**
 * Check if an IP/identifier is rate limited
 * @param identifier - IP address or user identifier
 * @returns Object with allowed status and remaining attempts
 */
export const checkRateLimit = (identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetTime: number;
  blocked: boolean;
} => {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // Clean up expired entries
  if (entry && entry.resetTime < now && !entry.blocked) {
    rateLimitStore.delete(identifier);
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
      resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS,
      blocked: false
    };
  }
  
  // Check if blocked
  if (entry?.blocked && entry.blockUntil) {
    if (now < entry.blockUntil) {
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: entry.blockUntil,
        blocked: true
      };
    } else {
      // Block expired, reset
      rateLimitStore.delete(identifier);
      return {
        allowed: true,
        remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
        resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS,
        blocked: false
      };
    }
  }
  
  // No entry or entry expired
  if (!entry || entry.resetTime < now) {
    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
      resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS,
      blocked: false
    };
  }
  
  // Check if exceeded max attempts
  if (entry.count >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
    // Block the identifier
    entry.blocked = true;
    entry.blockUntil = now + RATE_LIMIT_CONFIG.BLOCK_DURATION_MS;
    rateLimitStore.set(identifier, entry);
    
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: entry.blockUntil,
      blocked: true
    };
  }
  
  return {
    allowed: true,
    remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS - entry.count,
    resetTime: entry.resetTime,
    blocked: false
  };
};

/**
 * Record a failed attempt
 * @param identifier - IP address or user identifier
 */
export const recordFailedAttempt = (identifier: string): void => {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS,
      blocked: false
    });
  } else {
    // Increment existing entry
    entry.count += 1;
    
    // Block if exceeded max attempts
    if (entry.count >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS) {
      entry.blocked = true;
      entry.blockUntil = now + RATE_LIMIT_CONFIG.BLOCK_DURATION_MS;
    }
    
    rateLimitStore.set(identifier, entry);
  }
};

/**
 * Record a successful attempt (reset counter)
 * @param identifier - IP address or user identifier
 */
export const recordSuccess = (identifier: string): void => {
  rateLimitStore.delete(identifier);
};

/**
 * Get client identifier (IP address)
 * In a real application, this should get the actual IP from the request
 * For client-side, we'll use a combination of user agent and other factors
 */
export const getClientIdentifier = (): string => {
  // In a real application, get IP from request headers
  // For client-side, use a combination of factors
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const language = typeof navigator !== 'undefined' ? navigator.language : 'unknown';
  
  // Create a semi-unique identifier (not perfect, but better than nothing)
  // In production, this should be handled server-side with actual IP addresses
  return `client_${btoa(userAgent + language).substring(0, 16)}`;
};

/**
 * Clean up old rate limit entries
 */
export const cleanupRateLimitStore = (): void => {
  const now = Date.now();
  
  for (const [identifier, entry] of rateLimitStore.entries()) {
    const isExpired = entry.resetTime < now;
    const isBlockExpired = entry.blocked && entry.blockUntil && entry.blockUntil < now;
    
    if (isExpired && !entry.blocked) {
      rateLimitStore.delete(identifier);
    } else if (isBlockExpired) {
      rateLimitStore.delete(identifier);
    }
  }
};

// Start cleanup interval
if (typeof window !== 'undefined') {
  setInterval(cleanupRateLimitStore, RATE_LIMIT_CONFIG.CLEANUP_INTERVAL_MS);
}

