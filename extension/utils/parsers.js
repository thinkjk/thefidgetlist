// Centralized parsing utilities for product information extraction
// Uses text-normalizer.js and materials.js for consistent parsing

/**
 * Parse patterns with priority ordering
 * Each pattern has a name for debugging
 */
const PARSE_PATTERNS = {
  // Dimension patterns (in priority order)
  dimensions: [
    {
      name: 'labeled-3d',
      regex: /(?:dimensions?|size|measurements?|spinner\s*size)\s*:\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i,
      extract: (m) => ({ l: m[1], w: m[2], h: m[3] })
    },
    {
      // Matches "Length: 55mm ... Width: 28mm ... Body/Thickness/Height/Depth: 12mm"
      name: 'lwh-separate',
      regex: /length\s*:\s*(\d+(?:\.\d+)?)\s*mm[\s\S]{0,100}width[^0-9]*(\d+(?:\.\d+)?)\s*mm[\s\S]{0,100}(?:body|thickness|height|depth)\s*:\s*(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => ({ l: m[1], w: m[2], h: m[3] })
    },
    {
      // KapEDC/Big Cartel format: "50mm long, 27mm wide, thickness is 15mm"
      name: 'kapedc-lwt',
      regex: /(\d+(?:\.\d+)?)\s*mm\s*long[,\s]+(\d+(?:\.\d+)?)\s*mm\s*wide[,\s]+(?:thickness\s*(?:is\s*)?)?(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => ({ l: m[1], w: m[2], h: m[3] })
    },
    {
      // Alternative: "size is 50mm long, 27mm wide"
      name: 'size-is-lw',
      regex: /size\s*is\s*(\d+(?:\.\d+)?)\s*mm\s*long[,\s]+(\d+(?:\.\d+)?)\s*mm\s*wide/i,
      extract: (m) => ({ l: m[1], w: m[2] })
    },
    {
      name: 'inline-3d-mm',
      regex: /(\d+(?:\.\d+)?)\s*mm\s*x\s*(\d+(?:\.\d+)?)\s*mm\s*x\s*(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => ({ l: m[1], w: m[2], h: m[3] })
    },
    {
      name: 'inline-3d-no-unit',
      regex: /(\d{1,3}(?:\.\d+)?)\s*x\s*(\d{1,3}(?:\.\d+)?)\s*x\s*(\d{1,3}(?:\.\d+)?)/i,
      extract: (m) => ({ l: m[1], w: m[2], h: m[3] }),
      validate: (m) => parseFloat(m[1]) < 200 && parseFloat(m[2]) < 200 && parseFloat(m[3]) < 200
    },
    {
      name: 'body-length-only',
      regex: /body\s*length\s*:\s*(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => ({ l: m[1] }),
      single: true
    }
  ],

  // Weight patterns (in priority order)
  weight: [
    {
      name: 'labeled-weight',
      regex: /weight\s*:\s*(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i,
      extract: (m) => m[1]
    },
    {
      // Matches "SS 55g", "Ti 30g", "Stainless Steel: 114g", "Titanium: 66g"
      name: 'multi-material',
      regex: /(SS|Ti|Zr|W|Cu|Brass|Copper|Tungsten|Titanium|Zirconium|Stainless\s*Steel)\s*:?\s*(\d{1,3}(?:\.\d+)?)\s*g/gi,
      multi: true,
      extract: (matches) => matches.map(m => ({ material: m[1], weight: m[2] + 'g' }))
    },
    {
      name: 'inline-grams',
      regex: /\b(\d{1,3}(?:\.\d)?)\s*g\b/i,
      extract: (m) => m[1],
      validate: (m, text) => {
        // Skip if looks like price (e.g., 225.00)
        const fullMatch = m[0];
        const hasDecimalCents = /\d+\.\d{2}/.test(text.substring(Math.max(0, m.index - 5), m.index + fullMatch.length + 5));
        return !hasDecimalCents;
      }
    },
    {
      name: 'inline-oz',
      regex: /\b(\d{1,3}(?:\.\d)?)\s*oz\b/i,
      extract: (m) => m[1],
      unit: 'oz'
    }
  ],

  // Button size patterns (in priority order)
  buttonSize: [
    {
      name: 'button-size-labeled',
      regex: /button\s*sizes?\s*:\s*(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => m[1]
    },
    {
      name: 'button-diameter',
      regex: /button\s*diameter\s*:\s*(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => m[1]
    },
    {
      name: 'button-inline',
      regex: /button\s*:\s*(\d+(?:\.\d+)?)\s*mm\b/i,
      extract: (m) => m[1]
    },
    {
      // KapEDC format: "button is 24.5mm" or "button is 24.5mmX15mm"
      // Must be before mm-button to avoid "15mm button" matching from "15mm button is 24.5mm"
      name: 'button-is-mm',
      regex: /button\s+is\s+(\d+(?:\.\d+)?)\s*mm/i,
      extract: (m) => m[1]
    },
    {
      name: 'mm-button',
      regex: /(\d+(?:\.\d+)?)\s*mm\s*button\b/i,
      extract: (m) => m[1]
    }
  ],

  // Material patterns (in priority order)
  material: [
    {
      name: 'title-material-dash',
      // Match "- Material" pattern at start of product title
      // Must be followed by: another dash, end of string, newline, or space followed by non-dash word
      regex: /[-]\s*(Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Bronze|Aluminum|Ti|Zr|W|SS|Cu)(?:\s*[-]|$|\n|\r|\s+[A-Z])/i,
      extract: (m) => m[1],
      searchRange: 200 // Only search first N chars
    },
    {
      name: 'labeled-material',
      regex: /material\s*:\s*([A-Za-z0-9+&\s]+?)(?=finish|weight|size|button|spinner|bearing|\s{2,}|$)/i,
      extract: (m) => m[1].trim()
    },
    {
      name: 'compound-material',
      regex: /(zirc?|zr|ti|cu|w|ss|brass|copper|tungsten|titanium|zirconium)\s*([+&])\s*(zirc?|zr|ti|cu|w|ss|brass|copper|tungsten|titanium|zirconium)/i,
      extract: (m) => m[0]
    }
  ]
};

/**
 * Parse dimensions from text
 * @param {string} text - The text to parse (should be pre-normalized)
 * @returns {object} - { dimensions: string|null, pattern: string|null }
 */
function parseDimensions(text) {
  if (!text) return { dimensions: null, pattern: null };

  for (const pattern of PARSE_PATTERNS.dimensions) {
    const match = text.match(pattern.regex);
    if (match) {
      // Run validation if present
      if (pattern.validate && !pattern.validate(match)) {
        continue;
      }

      const extracted = pattern.extract(match);

      // Format based on what was extracted
      let dimensions;
      if (pattern.single) {
        dimensions = `${extracted.l}mm`;
      } else if (extracted.h) {
        dimensions = `${extracted.l}mm x ${extracted.w}mm x ${extracted.h}mm`;
      } else {
        dimensions = `${extracted.l}mm x ${extracted.w}mm`;
      }

      console.log(`[Parser] Dimensions matched by "${pattern.name}":`, dimensions);
      return { dimensions, pattern: pattern.name };
    }
  }

  return { dimensions: null, pattern: null };
}

/**
 * Parse weight from text
 * @param {string} text - The text to parse (should be pre-normalized)
 * @param {string} targetMaterial - Optional material to match for multi-material weights
 * @returns {object} - { weight: string|null, pattern: string|null, allWeights: array|null }
 */
function parseWeight(text, targetMaterial = null) {
  if (!text) return { weight: null, pattern: null, allWeights: null };

  // First check for multi-material format
  const multiPattern = PARSE_PATTERNS.weight.find(p => p.multi);
  if (multiPattern) {
    const matches = [...text.matchAll(multiPattern.regex)];
    if (matches.length > 1) {
      const allWeights = multiPattern.extract(matches);
      console.log(`[Parser] Found multi-material weights:`, allWeights);

      // If target material specified, try to match
      if (targetMaterial) {
        const targetLower = targetMaterial.toLowerCase().replace(/\s+/g, '');
        const materialAbbreviations = {
          'titanium': 'ti', 'ti': 'ti',
          'zirconium': 'zr', 'zr': 'zr',
          'tungsten': 'w', 'w': 'w',
          'stainlesssteel': 'ss', 'ss': 'ss',
          'copper': 'cu', 'cu': 'cu',
          'brass': 'brass',
          'bronze': 'bronze'
        };

        const targetAbbr = materialAbbreviations[targetLower] || targetLower;

        for (const { material, weight } of allWeights) {
          const matLower = material.toLowerCase();
          if (matLower === targetAbbr || materialAbbreviations[matLower] === targetAbbr) {
            console.log(`[Parser] Matched "${targetMaterial}" to weight: ${weight}`);
            return { weight, pattern: 'multi-material-matched', allWeights };
          }
        }

        // Fallback to first weight if no match
        console.log(`[Parser] No material match, using first weight as fallback`);
        return { weight: allWeights[0].weight, pattern: 'multi-material-fallback', allWeights };
      }

      return { weight: allWeights[0].weight, pattern: 'multi-material', allWeights };
    }
  }

  // Try standard patterns
  for (const pattern of PARSE_PATTERNS.weight) {
    if (pattern.multi) continue; // Already handled above

    const match = text.match(pattern.regex);
    if (match) {
      // Run validation if present
      if (pattern.validate && !pattern.validate(match, text)) {
        continue;
      }

      const value = pattern.extract(match);
      const unit = pattern.unit || 'g';
      const weight = `${value}${unit}`;

      console.log(`[Parser] Weight matched by "${pattern.name}":`, weight);
      return { weight, pattern: pattern.name, allWeights: null };
    }
  }

  return { weight: null, pattern: null, allWeights: null };
}

/**
 * Parse button size from text
 * @param {string} text - The text to parse (should be pre-normalized)
 * @returns {object} - { buttonSize: string|null, pattern: string|null }
 */
function parseButtonSize(text) {
  if (!text) return { buttonSize: null, pattern: null };

  for (const pattern of PARSE_PATTERNS.buttonSize) {
    const match = text.match(pattern.regex);
    if (match) {
      const value = pattern.extract(match);
      const buttonSize = `${value}mm`;

      console.log(`[Parser] Button size matched by "${pattern.name}":`, buttonSize);
      return { buttonSize, pattern: pattern.name };
    }
  }

  return { buttonSize: null, pattern: null };
}

/**
 * Parse material from text
 * @param {string} text - The text to parse (should be pre-normalized)
 * @returns {object} - { material: string|null, pattern: string|null }
 */
function parseMaterial(text) {
  if (!text) return { material: null, pattern: null };

  for (const pattern of PARSE_PATTERNS.material) {
    // Apply search range if specified
    const searchText = pattern.searchRange ? text.substring(0, pattern.searchRange) : text;

    const match = searchText.match(pattern.regex);
    if (match) {
      let material = pattern.extract(match);

      // Expand abbreviations if Materials module is available
      if (typeof window !== 'undefined' && window.Materials) {
        material = window.Materials.expandMaterialAbbreviation(material);
      }

      console.log(`[Parser] Material matched by "${pattern.name}":`, material);
      return { material, pattern: pattern.name };
    }
  }

  // Fallback: search for known materials in text
  if (typeof window !== 'undefined' && window.Materials) {
    const material = window.Materials.findMaterial(text.substring(0, 500));
    if (material) {
      console.log(`[Parser] Material found by keyword search:`, material);
      return { material, pattern: 'keyword-search' };
    }
  }

  return { material: null, pattern: null };
}

/**
 * Parse all product info from text
 * @param {string} rawText - The raw text to parse
 * @returns {object} - Parsed product information
 */
function parseProductInfo(rawText) {
  // Normalize text first
  let text = rawText;
  if (typeof window !== 'undefined' && window.TextNormalizer) {
    text = window.TextNormalizer.normalizeText(rawText);
  }

  const result = {
    dimensions: null,
    weight: null,
    buttonSize: null,
    material: null,
    _debug: {} // Store pattern matches for debugging
  };

  // Parse each field
  const dimResult = parseDimensions(text);
  result.dimensions = dimResult.dimensions;
  result._debug.dimensions = dimResult.pattern;

  const materialResult = parseMaterial(text);
  result.material = materialResult.material;
  result._debug.material = materialResult.pattern;

  // Parse weight with material context for multi-material matching
  const weightResult = parseWeight(text, result.material);
  result.weight = weightResult.weight;
  result._debug.weight = weightResult.pattern;
  if (weightResult.allWeights) {
    result._debug.allWeights = weightResult.allWeights;
  }

  const buttonResult = parseButtonSize(text);
  result.buttonSize = buttonResult.buttonSize;
  result._debug.buttonSize = buttonResult.pattern;

  return result;
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.Parsers = {
    PARSE_PATTERNS,
    parseDimensions,
    parseWeight,
    parseButtonSize,
    parseMaterial,
    parseProductInfo
  };
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARSE_PATTERNS,
    parseDimensions,
    parseWeight,
    parseButtonSize,
    parseMaterial,
    parseProductInfo
  };
}
