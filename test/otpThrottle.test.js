const test = require('node:test');
const assert = require('node:assert/strict');
const { canRequestOtp } = require('../api/_lib/otpThrottle');

test('allows a first-ever request with no prior history', () => {
  const result = canRequestOtp([], Date.now());
  assert.equal(result.allowed, true);
});

test('blocks a second request inside the cooldown window', () => {
  const now = Date.now();
  const result = canRequestOtp([now - 10 * 1000], now);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'cooldown');
});

test('allows a second request once the cooldown has passed', () => {
  const now = Date.now();
  const result = canRequestOtp([now - 90 * 1000], now, { cooldownMs: 60 * 1000 });
  assert.equal(result.allowed, true);
});

test('blocks once the request cap within the window is reached', () => {
  const now = Date.now();
  const recent = [now - 70 * 1000, now - 5 * 60 * 1000, now - 10 * 60 * 1000];
  const result = canRequestOtp(recent, now, { windowMs: 15 * 60 * 1000, maxRequests: 3, cooldownMs: 60 * 1000 });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'rate_limit');
});

test('ignores requests that fall outside the window', () => {
  const now = Date.now();
  const recent = [now - 20 * 60 * 1000, now - 25 * 60 * 1000];
  const result = canRequestOtp(recent, now, { windowMs: 15 * 60 * 1000, maxRequests: 3, cooldownMs: 60 * 1000 });
  assert.equal(result.allowed, true);
});

test('accepts Date objects and ISO strings interchangeably', () => {
  const now = Date.now();
  const isoRecent = new Date(now - 5000).toISOString();
  const result = canRequestOtp([isoRecent], now);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'cooldown');
});
