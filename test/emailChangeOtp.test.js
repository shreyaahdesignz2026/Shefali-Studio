const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, hashCode, matches, isExpired } = require('../api/_lib/emailChangeOtp');

test('generateCode produces a 6-digit zero-padded string', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    assert.match(code, /^\d{6}$/);
  }
});

test('matches accepts the correct code against its hash', () => {
  const code = '042817';
  assert.equal(matches(code, hashCode(code)), true);
});

test('matches rejects an incorrect code', () => {
  assert.equal(matches('111111', hashCode('222222')), false);
});

test('matches rejects a malformed/short hash without throwing', () => {
  assert.equal(matches('123456', 'not-a-hash'), false);
});

test('isExpired is false before the expiry time', () => {
  const future = new Date(Date.now() + 60 * 1000).toISOString();
  assert.equal(isExpired(future, Date.now()), false);
});

test('isExpired is true after the expiry time', () => {
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  assert.equal(isExpired(past, Date.now()), true);
});

test('isExpired is true exactly at the expiry time', () => {
  const now = Date.now();
  assert.equal(isExpired(new Date(now).toISOString(), now), true);
});
