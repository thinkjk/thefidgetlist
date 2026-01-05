// Advanced text parsing utilities for extracting product specifications

// Parse all specifications from text in one pass
function parseAllSpecs(text) {
  if (!text) return null;

  const specs = {
    dimensions: parseDimensions(text),
    weight: parseWeight(text),
    material: parseMaterial(text),
    buttonSize: parseButtonSize(text),
    price: parsePrice(text),
    finish: parseFinish(text)
  };

  return specs;
}

// Parse dimensions with multiple format support
function parseDimensions(text) {
  const patterns = [
    // CleanEDC: "Length: 46mm • Width: 20mm • Thickness: 14mm"
    /Length[\s:•]+(\d+(?:\.\d+)?)\s*mm[\s\S]{0,100}Width[^0-9]*(\d+(?:\.\d+)?)\s*mm[\s\S]{0,100}(?:Body\s+)?(?:Thickness|Height|Depth)[\s:•]+(\d+(?:\.\d+)?)\s*mm/i,
    // Standard: "Dimensions: 48mm x 29mm x 16mm"
    /(?:dimensions?|size|measurements?)[\s:]+(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i,
    // Simple: "48mm x 29mm x 16mm"
    /(\d+(?:\.\d+)?)\s*mm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm/,
    // Minimal: "48 x 29 x 16"
    /(\d{1,3}(?:\.\d+)?)\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)/,
    // Separated: "L: 48mm, W: 29mm, H: 16mm"
    /[LlWwHh][\s:]*(\d+(?:\.\d+)?)\s*(?:mm)?[\s,]+[LlWwHh][\s:]*(\d+(?:\.\d+)?)\s*(?:mm)?[\s,]+[LlWwHh][\s:]*(\d+(?:\.\d+)?)\s*(?:mm)?/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [, l, w, h] = match;
      const lNum = parseFloat(l);
      const wNum = parseFloat(w);
      const hNum = parseFloat(h);

      // Validate dimensions
      if (lNum > 0 && wNum > 0 && hNum > 0 && lNum < 500 && wNum < 500 && hNum < 500) {
        return `${l}mm x ${w}mm x ${h}mm`;
      }
    }
  }

  return null;
}

// Parse weight
function parseWeight(text) {
  const patterns = [
    /weight[\s:]+(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1] || match[0].match(/\d+(?:\.\d+)?/)[0];
      // Return with appropriate unit
      if (match[0].toLowerCase().includes('oz')) {
        return `${value}oz`;
      }
      return `${value}g`;
    }
  }

  return null;
}

// Parse button size
function parseButtonSize(text) {
  const patterns = [
    /button\s*sizes?[\s:]+(\d+(?:\.\d+)?)\s*mm/i,
    /button[\s:]+(\d+(?:\.\d+)?)\s*mm\b/i,
    /(\d+(?:\.\d+)?)\s*mm\s*button\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const size = match[1];
      const fullMatch = match[0];
      // Avoid matching weight (e.g., "buttons: 40g")
      if (!fullMatch.toLowerCase().includes('g)') && !fullMatch.toLowerCase().includes('grams')) {
        return `${size}mm`;
      }
    }
  }

  return null;
}

// Parse material
function parseMaterial(text, prioritizeTitle = true) {
  const materials = [
    'stainless steel',
    'carbon fiber',
    'tungsten',
    'titanium',
    'aluminum',
    'copper',
    'brass',
    'mokume',
    'damascus',
    'timascus',
    'zircuti',
    'resin',
    'bronze',
    'wood',
    'acrylic',
    'steel'
  ];

  const lowerText = text.toLowerCase();

  // Check beginning of text first (likely title)
  if (prioritizeTitle) {
    const firstPart = text.substring(0, 200).toLowerCase();
    for (const material of materials) {
      if (firstPart.includes(material)) {
        return material.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
  }

  // Check full text
  for (const material of materials) {
    if (lowerText.includes(material)) {
      return material.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return null;
}

// Parse price
function parsePrice(text) {
  const patterns = [
    /\$\s*(\d+(?:\.\d{2})?)\s*(?:USD)?/i,
    /(\d+(?:\.\d{2})?)\s*USD/i,
    /price[\s:]+\$?(\d+(?:\.\d{2})?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `$${match[1]}`;
    }
  }

  return null;
}

// Parse finish/coating
function parseFinish(text) {
  const finishes = [
    'stonewash',
    'stonewashed',
    'polished',
    'polish',
    'brushed',
    'bead blasted',
    'beadblasted',
    'anodized',
    'powder coated',
    'cerakote',
    'machine finish',
    'raw',
    'tumbled'
  ];

  const lowerText = text.toLowerCase();

  for (const finish of finishes) {
    if (lowerText.includes(finish)) {
      return finish.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return null;
}

// Extract multiple variants from text (e.g., different colors/materials listed)
function extractVariants(text) {
  const variants = [];

  // Look for common variant patterns
  const variantPatterns = [
    // "Available in: Tungsten, Titanium, Copper"
    /available\s+in[\s:]+([^.]+)/i,
    // "Materials: Tungsten, Titanium, Copper"
    /materials?[\s:]+([^.]+)/i,
    // "Colors: Red, Blue, Green"
    /colors?[\s:]+([^.]+)/i
  ];

  for (const pattern of variantPatterns) {
    const match = text.match(pattern);
    if (match) {
      const variantText = match[1];
      const materials = [
        'tungsten', 'titanium', 'aluminum', 'copper', 'brass',
        'stainless steel', 'bronze', 'mokume', 'damascus'
      ];

      for (const material of materials) {
        if (variantText.toLowerCase().includes(material)) {
          variants.push({
            material: material.charAt(0).toUpperCase() + material.slice(1)
          });
        }
      }
    }
  }

  return variants;
}

// Smart text extraction - tries to find product description block
function extractProductDescription(pageText) {
  // Look for common product description sections
  const descriptionPatterns = [
    /SPECIFICATIONS:([^]+?)(?:\n\n|\r\n\r\n|Important|Shipping|$)/i,
    /SPECS:([^]+?)(?:\n\n|\r\n\r\n|Important|Shipping|$)/i,
    /Description:([^]+?)(?:\n\n|\r\n\r\n|Specifications|$)/i,
    /Product Details:([^]+?)(?:\n\n|\r\n\r\n|$)/i
  ];

  for (const pattern of descriptionPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // If no specific section found, return first 500 chars
  return pageText.substring(0, 500);
}

// Export functions
if (typeof window !== 'undefined') {
  window.TextParser = {
    parseAllSpecs,
    parseDimensions,
    parseWeight,
    parseButtonSize,
    parseMaterial,
    parsePrice,
    parseFinish,
    extractVariants,
    extractProductDescription
  };
}
