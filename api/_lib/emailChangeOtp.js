const crypto = require('node:crypto');

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function matches(code, hash) {
  const a = Buffer.from(hashCode(code), 'hex');
  const b = Buffer.from(String(hash || ''), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isExpired(expiresAt, now) {
  const nowMs = now instanceof Date ? now.getTime() : now || Date.now();
  return new Date(expiresAt).getTime() <= nowMs;
}

module.exports = { generateCode, hashCode, matches, isExpired };
