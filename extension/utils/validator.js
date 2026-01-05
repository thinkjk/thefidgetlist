// Form validation utilities

// Validate dimension format (e.g., "48mm x 29mm x 16mm" or "48mm x 29mm" or "48mm")
function validateDimensions(dimensions) {
  if (!dimensions || dimensions.trim() === '') {
    return { valid: true, normalized: null }; // Dimensions are optional
  }

  const trimmed = dimensions.trim();

  // Pattern for 3 dimensions: "48mm x 29mm x 16mm"
  const pattern3D = /^(\d+(?:\.\d+)?)\s*([a-z]+)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*([a-z]+)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*([a-z]+)?$/;
  const match3D = trimmed.match(pattern3D);

  if (match3D) {
    const [, l, unit1, w, unit2, h, unit3] = match3D;
    const unit = unit1 || unit2 || unit3 || 'mm';
    const normalized = `${l}${unit} x ${w}${unit} x ${h}${unit}`;
    return { valid: true, normalized };
  }

  // Pattern for 2 dimensions: "48mm x 29mm"
  const pattern2D = /^(\d+(?:\.\d+)?)\s*([a-z]+)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*([a-z]+)?$/;
  const match2D = trimmed.match(pattern2D);

  if (match2D) {
    const [, d1, unit1, d2, unit2] = match2D;
    const unit = unit1 || unit2 || 'mm';
    const normalized = `${d1}${unit} x ${d2}${unit}`;
    return { valid: true, normalized };
  }

  // Pattern for 1 dimension: "48mm"
  const pattern1D = /^(\d+(?:\.\d+)?)\s*([a-z]+)?$/;
  const match1D = trimmed.match(pattern1D);

  if (match1D) {
    const [, d, unit] = match1D;
    const normalizedUnit = unit || 'mm';
    const normalized = `${d}${normalizedUnit}`;
    return { valid: true, normalized };
  }

  return { valid: false, error: 'Dimensions must be in format: L, LxW, or LxWxH (e.g., "48mm", "48mm x 29mm", or "48mm x 29mm x 16mm")' };
}

// Validate weight format (e.g., "327g")
function validateWeight(weight) {
  if (!weight || weight.trim() === '') {
    return { valid: true, normalized: null }; // Weight is optional
  }

  const trimmed = weight.trim();

  // Pattern: number + optional space + unit
  const pattern = /^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i;
  const match = trimmed.match(pattern);

  if (!match) {
    return { valid: false, error: 'Weight must be a number with optional unit (e.g., "327g" or "327")' };
  }

  const [, value, unit] = match;

  // Normalize unit - handle both 'g', 'gram', 'grams', 'gg' (malformed)
  let normalizedUnit = 'g';
  if (unit) {
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit.includes('oz')) {
      normalizedUnit = 'oz';
    } else {
      normalizedUnit = 'g'; // Default to 'g' for any g-based unit
    }
  }

  // Normalize to standard format
  const normalized = `${value}${normalizedUnit}`;

  return { valid: true, normalized };
}

// Validate button size (e.g., "24.5mm")
function validateButtonSize(buttonSize) {
  // Button size is now optional
  if (!buttonSize || buttonSize.trim() === '') {
    return { valid: true, normalized: null };
  }

  const trimmed = buttonSize.trim();

  // Pattern: number + optional unit
  const pattern = /^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i;
  const match = trimmed.match(pattern);

  if (!match) {
    return { valid: false, error: 'Button size must be a number with optional unit (e.g., "24.5mm")' };
  }

  const [, value, unit] = match;
  const normalizedUnit = unit || 'mm';

  // Normalize to standard format
  const normalized = `${value}${normalizedUnit}`;

  return { valid: true, normalized };
}

// Validate image URL
function validateImageURL(url) {
  if (!url || url.trim() === '') {
    return { valid: true, normalized: null }; // Image URL is now optional
  }

  const trimmed = url.trim();

  // Basic URL validation
  try {
    new URL(trimmed);
    return { valid: true, normalized: trimmed };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Validate entire form data
function validateFormData(formData) {
  const errors = [];

  // Required fields
  if (!formData.group_name || formData.group_name.trim() === '') {
    errors.push('Group name is required');
  }

  if (!formData.fidget_name || formData.fidget_name.trim() === '') {
    errors.push('Fidget name is required');
  }

  // Button size validation
  const buttonSizeResult = validateButtonSize(formData.button_size);
  if (!buttonSizeResult.valid) {
    errors.push(buttonSizeResult.error);
  }

  // Dimensions validation (optional)
  if (formData.dimensions) {
    const dimensionsResult = validateDimensions(formData.dimensions);
    if (!dimensionsResult.valid) {
      errors.push(dimensionsResult.error);
    }
  }

  // Variants validation
  if (!formData.variants || formData.variants.length === 0) {
    errors.push('At least one variant is required');
  } else {
    formData.variants.forEach((variant, index) => {
      if (!variant.material || variant.material.trim() === '') {
        errors.push(`Variant #${index + 1}: Material is required`);
      }

      if (variant.weight) {
        const weightResult = validateWeight(variant.weight);
        if (!weightResult.valid) {
          errors.push(`Variant #${index + 1}: ${weightResult.error}`);
        }
      }

      // Only validate image URL if one was provided
      if (variant.image_url) {
        const imageResult = validateImageURL(variant.image_url);
        if (!imageResult.valid) {
          errors.push(`Variant #${index + 1}: ${imageResult.error}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Strip material prefixes from fidget names
// Uses centralized Materials module if available
function stripMaterialPrefix(name) {
  // Use centralized Materials module if available
  if (typeof window !== 'undefined' && window.Materials) {
    return window.Materials.stripMaterialFromName(name);
  }

  // Fallback implementation (for when module not loaded)
  const materials = [
    'Stainless Steel', 'Carbon Fiber', 'Titanium', 'Zirconium', 'Tungsten',
    'Copper', 'Brass', 'Bronze', 'Aluminum', 'Mokume', 'Damascus', 'Timascus',
    'Damasteel', 'Mokuti', 'Zircuti', 'Superconductor', 'Ultem', 'PEEK'
  ];

  const finishes = [
    'Polished', 'Brushed', 'Stonewashed', 'Distressed', 'Anodized',
    'Cerakote', 'DLC', 'PVD', 'Bead Blasted', 'Satin', 'Tumbled', 'Raw'
  ];

  let cleanName = name.trim();

  // First, try to strip "- Material - Finish" pattern (TWEDC style)
  const materialFinishPattern = /\s*[-–]\s*\w+\s*[-–]\s*\w+\s*$/;
  if (materialFinishPattern.test(cleanName)) {
    cleanName = cleanName.replace(materialFinishPattern, '').trim();
    return cleanName;
  }

  // Try to strip material-finish combinations at the end
  for (const material of materials) {
    for (const finish of finishes) {
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

  // Try to strip material at the end
  for (const material of materials) {
    const regex = new RegExp(`\\s+${material}$`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, '').trim();
      return cleanName;
    }
  }

  // Try to match material at the start
  for (const material of materials) {
    const regex = new RegExp(`^${material}\\s+`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, '').trim();
      break;
    }
  }

  // Try to match material in the middle
  for (const material of materials) {
    const regex = new RegExp(`\\s+${material}\\s+`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, ' ').trim();
      break;
    }
  }

  return cleanName;
}

// Normalize form data (apply standard formats)
function normalizeFormData(formData) {
  const normalized = { ...formData };

  // Strip material prefix from fidget name
  if (normalized.fidget_name) {
    normalized.fidget_name = stripMaterialPrefix(normalized.fidget_name);
  }

  // Normalize dimensions
  if (normalized.dimensions) {
    const dimensionsResult = validateDimensions(normalized.dimensions);
    if (dimensionsResult.valid && dimensionsResult.normalized) {
      normalized.dimensions = dimensionsResult.normalized;
    }
  }

  // Normalize button size
  const buttonSizeResult = validateButtonSize(normalized.button_size);
  if (buttonSizeResult.valid && buttonSizeResult.normalized) {
    normalized.button_size = buttonSizeResult.normalized;
  }

  // Normalize variants
  if (normalized.variants) {
    normalized.variants = normalized.variants.map(variant => {
      const normalizedVariant = { ...variant };

      if (normalizedVariant.weight) {
        const weightResult = validateWeight(normalizedVariant.weight);
        if (weightResult.valid && weightResult.normalized) {
          normalizedVariant.weight = weightResult.normalized;
        }
      }

      return normalizedVariant;
    });
  }

  return normalized;
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
  window.FidgetValidator = {
    validateDimensions,
    validateWeight,
    validateButtonSize,
    validateImageURL,
    validateFormData,
    normalizeFormData,
    stripMaterialPrefix
  };
}
