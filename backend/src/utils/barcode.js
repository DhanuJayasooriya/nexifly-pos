/**
 * EAN-13 Barcode Generator
 *
 * Structure:  [6-digit company prefix] [6-digit item ref] [1 check digit]
 * The company prefix is your GS1-registered prefix (BARCODE_COMPANY_PREFIX in .env).
 * Item reference is the zero-padded barcode sequence from the database.
 */

/**
 * Compute the EAN-13 check digit for a 12-digit string.
 * @param {string} digits - exactly 12 numeric characters
 * @returns {number} check digit 0-9
 */
function computeCheckDigit(digits) {
  if (digits.length !== 12) throw new Error('EAN-13 requires exactly 12 digits before check digit');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Generate a full 13-digit EAN-13 barcode value.
 * @param {number} sequence - unique integer item sequence (1 – 999999)
 * @returns {string} 13-character EAN-13 barcode
 */
function generateEAN13(sequence) {
  // Ignore anything after the first whitespace, so an inline comment in .env can't break the prefix
  const prefix = (process.env.BARCODE_COMPANY_PREFIX || '629999')
    .trim()
    .replace(/\s.*/, '')
    .slice(0, 6)
    .padStart(6, '0');
  const itemRef = String(sequence).padStart(6, '0');
  if (itemRef.length > 6) throw new Error('Sequence exceeds 6-digit item reference limit (max 999999)');
  const base12 = prefix + itemRef;
  const check = computeCheckDigit(base12);
  return base12 + check;
}

/**
 * Validate a 13-digit EAN-13 string.
 * @param {string} ean - 13-character string
 * @returns {boolean}
 */
function validateEAN13(ean) {
  if (!/^\d{13}$/.test(ean)) return false;
  const expected = computeCheckDigit(ean.slice(0, 12));
  return parseInt(ean[12], 10) === expected;
}

module.exports = { generateEAN13, validateEAN13, computeCheckDigit };
