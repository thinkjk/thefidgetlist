// Centralized material configuration
// This is the single source of truth for all material-related data

const MATERIALS = {
  // Full material names (order matters - check longer/compound names first)
  fullNames: [
    // Compound/exotic materials first
    'Stainless Steel',
    'Carbon Fiber',
    'Carbon Fibre',
    'Mokume Gane',
    'Tungsten Carbide',
    'Aluminum Bronze',
    'Aluminium Bronze',
    'Vegas Forge Steel',
    'Super Conductor',
    'Superconductor',
    'Crystallized Titanium',
    // Standard metals
    'Titanium',
    'Zirconium',
    'Tungsten',
    'Copper',
    'Brass',
    'Bronze',
    'Aluminum',
    'Aluminium',
    'Steel',
    // Exotic alloys
    'Mokume',
    'Mokuti',
    'Timascus',
    'Damascus',
    'Damasteel',
    'Zircuti',
    'ZircuTi',
    'Cupronickel',
    'WCu',
    // Plastics and composites
    'Ultem',
    'PEEK',
    'Delrin',
    'POM',
    'ABS',
    'G10',
    'Micarta',
    'Resin',
    'Acrylic',
    'Wood'
  ],

  // Abbreviation to full name mapping (lowercase keys)
  abbreviations: {
    'ss': 'Stainless Steel',
    'ti': 'Titanium',
    'zr': 'Zirconium',
    'zirc': 'Zirconium',
    'w': 'Tungsten',
    'cu': 'Copper',
    'sc': 'Superconductor',
    'cf': 'Carbon Fiber',
    'al': 'Aluminum'
  },

  // Finishes that should not be treated as materials
  finishes: [
    'Polished',
    'Polish',
    'Brushed',
    'Stonewashed',
    'Stonewash',
    'Distressed',
    'Anodized',
    'Cerakote',
    'DLC',
    'PVD',
    'Bead Blasted',
    'Beadblasted',
    'Satin',
    'Mirror',
    'Matte',
    'Sandblasted',
    'Sand Blasted',
    'Tumbled',
    'Raw',
    'Flamed',
    'Hammer',
    'Hammered',
    'Crystallize',
    'Crystallized',
    'Etched',
    'Machine Finish',
    'MF'
  ],

  // Finish patterns for regex matching (case-insensitive)
  finishPattern: /(hammer|crystallize|polish|stonewash|distress|brush|satin|mirror|matte|tumble|sand\s*blast|bead\s*blast|anodize|cerakote|etched?|finish|coating|MF|DLC|PVD|raw|flamed?)/i
};

/**
 * Expand material abbreviations to full names
 * @param {string} material - The material string to expand
 * @returns {string} - The expanded material name
 */
function expandMaterialAbbreviation(material) {
  if (!material) return null;

  let expanded = material.trim();

  // Handle compound materials (e.g., "Zr+W" -> "Zirconium + Tungsten")
  if (/[+&]/.test(expanded)) {
    const separator = expanded.includes('+') ? '+' : '&';
    const parts = expanded.split(/[+&]/).map(part => {
      const trimmed = part.trim().toLowerCase();
      return MATERIALS.abbreviations[trimmed] || part.trim();
    });
    return parts.join(` ${separator} `);
  }

  // Check for abbreviation match (case-insensitive)
  const lowerMaterial = expanded.toLowerCase();

  // Try exact abbreviation match first
  if (MATERIALS.abbreviations[lowerMaterial]) {
    return MATERIALS.abbreviations[lowerMaterial];
  }

  // Try matching abbreviation at start of string (e.g., "Ti polished" -> "Titanium polished")
  for (const [abbr, full] of Object.entries(MATERIALS.abbreviations)) {
    const regex = new RegExp(`^${abbr}(?:\\s|$)`, 'i');
    if (regex.test(expanded)) {
      expanded = expanded.replace(regex, full + ' ').trim();
      break;
    }
  }

  return expanded;
}

/**
 * Check if a string is a finish (not a material)
 * @param {string} text - The text to check
 * @returns {boolean} - True if it's a finish
 */
function isFinish(text) {
  if (!text) return false;
  return MATERIALS.finishPattern.test(text);
}

/**
 * Check if a string contains a known material
 * @param {string} text - The text to check
 * @returns {string|null} - The matched material or null
 */
function findMaterial(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const material of MATERIALS.fullNames) {
    if (lowerText.includes(material.toLowerCase())) {
      return material;
    }
  }

  // Check abbreviations
  for (const [abbr, full] of Object.entries(MATERIALS.abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'i');
    if (regex.test(text)) {
      return full;
    }
  }

  return null;
}

/**
 * Strip material prefix/suffix from a product name
 * @param {string} name - The product name
 * @returns {string} - The cleaned name
 */
function stripMaterialFromName(name) {
  if (!name) return null;

  let cleanName = name.trim();

  // First, try to strip "- Material1 & Material2" pattern (2R style: "Phantom X - SS & Titanium")
  // This pattern matches compound materials with & or and
  const compoundMaterialPattern = /\s*[-–]\s*(?:SS|Ti|Zr|W|Cu|Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Bronze)\s*[&+]\s*(?:SS|Ti|Zr|W|Cu|Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Bronze)\s*$/i;
  if (compoundMaterialPattern.test(cleanName)) {
    cleanName = cleanName.replace(compoundMaterialPattern, '').trim();
    return cleanName;
  }

  // Try to strip "- Material - Finish" pattern (TWEDC style: "Cloudspin - Titanium - Sand blasted")
  // This pattern matches: " - word(s) - word(s)" at the end
  const materialFinishPattern = /\s*[-–]\s*[^-–]+\s*[-–]\s*[^-–]+\s*$/;
  if (materialFinishPattern.test(cleanName)) {
    cleanName = cleanName.replace(materialFinishPattern, '').trim();
    return cleanName;
  }

  // Try to strip material-finish combinations at the end (e.g., "Dawn T Brass-Distressed")
  // Check this BEFORE the simple dash pattern
  for (const material of MATERIALS.fullNames) {
    for (const finish of MATERIALS.finishes) {
      const patterns = [
        new RegExp(`\\s+${material}[-\\s]${finish}$`, 'i'),
        new RegExp(`\\s+${finish}[-\\s]${material}$`, 'i')
      ];
      for (const regex of patterns) {
        if (regex.test(cleanName)) {
          cleanName = cleanName.replace(regex, '').trim();
          return cleanName;
        }
      }
    }
  }

  // Also try simpler "- Material" pattern (e.g., "Cloudspin - Titanium")
  const simpleDashPattern = /\s*[-–]\s*\w+(?:\s+\w+)?\s*$/;
  if (simpleDashPattern.test(cleanName)) {
    // Only strip if the part after dash looks like a material
    const afterDash = cleanName.match(/[-–]\s*(\w+(?:\s+\w+)?)\s*$/);
    if (afterDash) {
      const potentialMaterial = afterDash[1].toLowerCase();
      const knownMaterials = ['titanium', 'zirconium', 'tungsten', 'copper', 'brass', 'bronze',
                              'stainless steel', 'aluminum', 'mokume', 'damascus', 'ti', 'zr', 'w', 'ss', 'cu'];
      if (knownMaterials.some(m => potentialMaterial.includes(m))) {
        cleanName = cleanName.replace(/\s*[-–]\s*\w+(?:\s+\w+)?\s*$/, '').trim();
        return cleanName;
      }
    }
  }

  // Try to strip material at the end
  for (const material of MATERIALS.fullNames) {
    const regex = new RegExp(`\\s+${material}$`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, '').trim();
      return cleanName;
    }
  }

  // Try to strip material at the start
  for (const material of MATERIALS.fullNames) {
    const regex = new RegExp(`^${material}\\s+`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, '').trim();
      break;
    }
  }

  // Try to strip material in the middle
  for (const material of MATERIALS.fullNames) {
    const regex = new RegExp(`\\s+${material}\\s+`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, ' ').trim();
      break;
    }
  }

  return cleanName;
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.Materials = {
    MATERIALS,
    expandMaterialAbbreviation,
    isFinish,
    findMaterial,
    stripMaterialFromName
  };
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MATERIALS,
    expandMaterialAbbreviation,
    isFinish,
    findMaterial,
    stripMaterialFromName
  };
}
