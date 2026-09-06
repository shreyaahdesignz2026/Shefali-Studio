const test = require('node:test');
const assert = require('node:assert/strict');
const { generateGiftCardCode, GIFT_CARD_CODE_LENGTH, GIFT_CARD_CODE_ALPHABET } = require('../api/_lib/giftCards');

test('generates a code of the expected length', () => {
  assert.equal(generateGiftCardCode().length, GIFT_CARD_CODE_LENGTH);
});

test('generates a code using only the declared alphabet', () => {
  const code = generateGiftCardCode();
  const allowed = new Set(GIFT_CARD_CODE_ALPHABET.split(''));
  for (const ch of code) {
    assert.ok(allowed.has(ch), `unexpected character: ${ch}`);
  }
});

test('generates different codes across calls', () => {
  const codes = new Set();
  for (let i = 0; i < 50; i++) codes.add(generateGiftCardCode());
  assert.equal(codes.size, 50);
});
