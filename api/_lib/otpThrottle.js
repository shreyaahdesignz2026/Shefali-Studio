// Pure throttle check for the login-OTP request route: a short cooldown
// between any two requests, plus a cap on requests within a longer window,
// so one inbox can't be used to spam the OTP-request endpoint (each
// request also sends a real email via Resend).
function canRequestOtp(recentTimestamps, now, opts) {
  const { windowMs = 15 * 60 * 1000, maxRequests = 3, cooldownMs = 60 * 1000 } = opts || {};

  const recent = (recentTimestamps || [])
    .map((t) => (t instanceof Date ? t.getTime() : new Date(t).getTime()))
    .filter((t) => !Number.isNaN(t) && now - t < windowMs);

  if (recent.length === 0) return { allowed: true };

  const mostRecent = Math.max(...recent);
  if (now - mostRecent < cooldownMs) {
    return { allowed: false, reason: 'cooldown', retryAfterMs: cooldownMs - (now - mostRecent) };
  }

  if (recent.length >= maxRequests) {
    const oldestInWindow = Math.min(...recent);
    return { allowed: false, reason: 'rate_limit', retryAfterMs: windowMs - (now - oldestInWindow) };
  }

  return { allowed: true };
}

module.exports = { canRequestOtp };
