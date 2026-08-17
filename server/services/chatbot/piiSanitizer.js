/**
 * piiSanitizer.js
 * Regex and token-based masking utility to sanitize PII before AI prompt dispatch.
 */

const PII_PATTERNS = [
  // Email addresses
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
  // Phone numbers (Philippine formats: 09xx, +639xx, etc.)
  { regex: /(\+?63|0)?9\d{2}[-\s]?\d{3}[-\s]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' },
  // Government IDs (TIN, SSS, PhilHealth, typical formats)
  { regex: /\b\d{2,4}-\d{4,7}-\d{1,2}\b/g, replacement: '[ID_REDACTED]' },
  // Credit/Debit Cards
  { regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CARD_REDACTED]' },
  // Bank Account numbers (rudimentary)
  { regex: /\b\d{10,14}\b/g, replacement: '[BANK_ACCT_REDACTED]' }
];

export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let sanitized = text;
  PII_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern.regex, pattern.replacement);
  });
  
  return sanitized;
};

export const sanitizeObject = (obj) => {
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitizedObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitizedObj[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitizedObj;
  }
  
  return obj;
};
