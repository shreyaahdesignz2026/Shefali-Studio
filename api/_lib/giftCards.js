const crypto = require('crypto');

const GIFT_CARD_CODE_LENGTH = 16;
const GIFT_CARD_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const GIFT_CARD_MIN_AMOUNT = 250;

// crypto.randomInt avoids the modulo bias a plain Math.random() % length
// pick would have -- this code is effectively a bearer token redeemable for
// real money, so it's generated the same way api/admin/admin-users.js
// generates temporary passwords.
function generateGiftCardCode() {
  let code = '';
  for (let i = 0; i < GIFT_CARD_CODE_LENGTH; i++) {
    code += GIFT_CARD_CODE_ALPHABET[crypto.randomInt(GIFT_CARD_CODE_ALPHABET.length)];
  }
  return code;
}

module.exports = { generateGiftCardCode, GIFT_CARD_CODE_LENGTH, GIFT_CARD_CODE_ALPHABET, GIFT_CARD_MIN_AMOUNT };
