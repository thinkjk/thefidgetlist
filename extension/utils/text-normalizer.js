// Text normalization utilities
// Handles Unicode characters and text cleanup before parsing

/**
 * Normalize text for consistent parsing
 * Converts fullwidth characters and cleans up spacing
 * @param {string} text - The text to normalize
 * @returns {string} - The normalized text
 */
function normalizeText(text) {
  if (!text) return '';

  return text
    // Normalize fullwidth punctuation to ASCII equivalents
    .replace(/：/g, ':')   // Fullwidth colon (U+FF1A) -> colon
    .replace(/；/g, ';')   // Fullwidth semicolon
    .replace(/，/g, ',')   // Fullwidth comma
    .replace(/．/g, '.')   // Fullwidth period
    .replace(/×/g, 'x')    // Multiplication sign (U+00D7) -> x
    .replace(/✕/g, 'x')    // Multiplication X (U+2715) -> x
    .replace(/✖/g, 'x')    // Heavy multiplication X (U+2716) -> x
    .replace(/–/g, '-')    // En dash (U+2013) -> hyphen
    .replace(/—/g, '-')    // Em dash (U+2014) -> hyphen
    .replace(/'/g, "'")    // Right single quote -> apostrophe
    .replace(/'/g, "'")    // Left single quote -> apostrophe
    .replace(/"/g, '"')    // Left double quote -> quote
    .replace(/"/g, '"')    // Right double quote -> quote

    // Normalize fullwidth letters and numbers to ASCII
    .replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30)) // 0-9
    .replace(/[\uFF21-\uFF3A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF21 + 0x41)) // A-Z
    .replace(/[\uFF41-\uFF5A]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF41 + 0x61)) // a-z

    // Normalize whitespace
    .replace(/　/g, ' ')   // Fullwidth space (U+3000) -> space
    .replace(/\u00A0/g, ' ') // Non-breaking space -> space
    .replace(/\s+/g, ' ')  // Multiple spaces -> single space
    .trim();
}

/**
 * Extract a clean number from text (handles various formats)
 * @param {string} text - Text containing a number
 * @returns {string|null} - The extracted number or null
 */
function extractNumber(text) {
  if (!text) return null;

  const normalized = normalizeText(text);
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : null;
}

/**
 * Check if text looks like a price (has currency symbol or .00 pattern)
 * @param {string} text - The text to check
 * @returns {boolean} - True if it looks like a price
 */
function looksLikePrice(text) {
  if (!text) return false;

  // Has currency symbol
  if (/[$€£¥₹]/.test(text)) return true;

  // Has .00 or .99 pattern (common price endings)
  if (/\d+\.\d{2}$/.test(text.trim())) return true;

  // Contains "USD", "price", etc.
  if (/\b(USD|EUR|GBP|price|cost)\b/i.test(text)) return true;

  return false;
}

/**
 * Clean up a dimension string to standard format
 * @param {string} dim - Raw dimension string
 * @returns {string|null} - Normalized dimension or null
 */
function normalizeDimensionString(dim) {
  if (!dim) return null;

  const normalized = normalizeText(dim);

  // Try to extract L x W x H pattern
  const match3d = normalized.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (match3d) {
    return `${match3d[1]}mm x ${match3d[2]}mm x ${match3d[3]}mm`;
  }

  // Try to extract L x W pattern
  const match2d = normalized.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (match2d) {
    return `${match2d[1]}mm x ${match2d[2]}mm`;
  }

  // Try to extract single dimension
  const match1d = normalized.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (match1d) {
    return `${match1d[1]}mm`;
  }

  return null;
}

/**
 * Normalize a weight string to standard format
 * @param {string} weight - Raw weight string
 * @returns {string|null} - Normalized weight (e.g., "113g") or null
 */
function normalizeWeightString(weight) {
  if (!weight) return null;

  const normalized = normalizeText(weight);

  // Skip if it looks like a price
  if (looksLikePrice(normalized)) return null;

  // Extract number and unit
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([a-z]*)/i);
  if (!match) return null;

  const value = match[1];
  const unit = (match[2] || 'g').toLowerCase();

  // Normalize unit
  if (unit === 'g' || unit === 'gram' || unit === 'grams' || unit === 'gg') {
    return `${value}g`;
  } else if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
    return `${value}oz`;
  }

  // Default to grams if no unit
  return `${value}g`;
}

/**
 * Normalize a button size string to standard format
 * @param {string} size - Raw button size string
 * @returns {string|null} - Normalized size (e.g., "24.5mm") or null
 */
function normalizeButtonSizeString(size) {
  if (!size) return null;

  const normalized = normalizeText(size);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:mm)?/i);

  if (match) {
    return `${match[1]}mm`;
  }

  return null;
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.TextNormalizer = {
    normalizeText,
    extractNumber,
    looksLikePrice,
    normalizeDimensionString,
    normalizeWeightString,
    normalizeButtonSizeString
  };
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeText,
    extractNumber,
    looksLikePrice,
    normalizeDimensionString,
    normalizeWeightString,
    normalizeButtonSizeString
  };
}
