const crypto = require('crypto');

const GIFT_CARD_CODE_LENGTH = 16;
const GIFT_CARD_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const GIFT_CARD_MIN_AMOUNT = 250;

function generateGiftCardCode() {
  let code = '';
  for (let i = 0; i < GIFT_CARD_CODE_LENGTH; i++) {
    code += GIFT_CARD_CODE_ALPHABET[crypto.randomInt(GIFT_CARD_CODE_ALPHABET.length)];
  }
  return code;
}

module.exports = { generateGiftCardCode, GIFT_CARD_CODE_LENGTH, GIFT_CARD_CODE_ALPHABET, GIFT_CARD_MIN_AMOUNT };
