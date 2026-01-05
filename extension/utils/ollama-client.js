// Ollama AI integration for intelligent text parsing

// Default configuration
const DEFAULT_CONFIG = {
  endpoint: 'http://localhost:11434',
  model: 'llama3.2',
  timeout: 30000 // 30 seconds (AI inference can be slow, especially for vision models)
};

// Parse product information using Ollama
async function parseWithOllama(text, config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Check if Ollama is enabled in settings
  const settings = await browser.storage.local.get(['ollamaEnabled', 'ollamaEndpoint', 'ollamaModel']);

  if (!settings.ollamaEnabled) {
    console.log('Ollama is disabled in settings');
    return null;
  }

  // Use settings if available
  if (settings.ollamaEndpoint) finalConfig.endpoint = settings.ollamaEndpoint;
  if (settings.ollamaModel) finalConfig.model = settings.ollamaModel;

  const prompt = buildPrompt(text);

  try {
    console.log('Calling Ollama at:', finalConfig.endpoint);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

    const response = await fetch(`${finalConfig.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: finalConfig.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for more consistent extraction
          num_predict: 200   // Limit response length
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ollama response:', data);

    // Parse the response
    const parsed = parseOllamaResponse(data.response);
    return parsed;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Ollama request timed out');
    } else {
      console.error('Ollama error:', error);
    }
    return null; // Fall back to regex parsing
  }
}

// Build prompt for Ollama
function buildPrompt(text) {
  // Limit text length to avoid token limits
  const truncatedText = text.substring(0, 1000);

  return `Extract fidget spinner/slider product specifications from this text. Return ONLY valid JSON.

EXAMPLES:

Input: "Dawn T Brass-Distressed Weight: 95g Button: 24mm"
Output: {"name": "Dawn T", "material": "Brass", "weight": "95g", "button_size": "24mm", "finish": "Distressed", "dimensions": null, "price": null, "variants": []}

Input: "Cloudspin - Titanium - Sand blasted SS 55g Ti 30g Zr 46g W 140g"
Output: {"name": "Cloudspin", "material": "Titanium", "weight": "30g", "finish": "Sand blasted", "dimensions": null, "button_size": null, "price": null, "variants": [{"material": "Stainless Steel", "weight": "55g"}, {"material": "Titanium", "weight": "30g"}, {"material": "Zirconium", "weight": "46g"}, {"material": "Tungsten", "weight": "140g"}]}

Input: "Material: Zr+W Weight: 113g"
Output: {"name": null, "material": "Zirconium + Tungsten", "weight": "113g", "dimensions": null, "button_size": null, "finish": null, "price": null, "variants": []}

RULES:
1. Name should NOT include material (put in separate field)
2. EXPAND ALL ABBREVIATIONS:
   - SS → Stainless Steel
   - Ti → Titanium
   - Zr, Zirc → Zirconium
   - W → Tungsten
   - Cu → Copper
3. COMPOUND MATERIALS: "Zr+W" → "Zirconium + Tungsten"
4. If multiple materials with weights (e.g., "SS 55g Ti 30g"), extract ALL to variants array
5. Match the product's material to get the correct weight from multi-material lists
6. Do NOT include finish in material name
7. Use null for missing fields, not empty strings

Text to analyze:
${truncatedText}

JSON:`;
}

// Strip material prefixes from product names
// Uses centralized Materials module if available, otherwise falls back to local implementation
function stripMaterialFromName(name) {
  if (!name) return null;

  // Use centralized Materials module if available
  if (typeof window !== 'undefined' && window.Materials) {
    return window.Materials.stripMaterialFromName(name);
  }

  // Fallback implementation (for when module not loaded)
  const materials = [
    'Stainless Steel', 'Carbon Fiber', 'Titanium', 'Zirconium', 'Tungsten',
    'Copper', 'Brass', 'Bronze', 'Aluminum', 'Mokume', 'Damascus'
  ];

  let cleanName = name.trim();

  for (const material of materials) {
    const regex = new RegExp(`^${material}\\s+`, 'i');
    if (regex.test(cleanName)) {
      cleanName = cleanName.replace(regex, '').trim();
      break;
    }
  }

  return cleanName;
}

// Expand material abbreviations (in case Ollama didn't follow instructions)
// Uses centralized Materials module if available
function expandMaterialAbbreviations(material) {
  if (!material) return null;

  // Use centralized Materials module if available
  if (typeof window !== 'undefined' && window.Materials) {
    return window.Materials.expandMaterialAbbreviation(material);
  }

  // Fallback implementation
  let expanded = material.trim();

  const expansions = [
    { pattern: /\bzirc\b/gi, replacement: 'Zirconium' },
    { pattern: /\bzr\b/gi, replacement: 'Zirconium' },
    { pattern: /\bss\b/gi, replacement: 'Stainless Steel' },
    { pattern: /\bsc\b/gi, replacement: 'Superconductor' },
    { pattern: /\bcu\b/gi, replacement: 'Copper' },
    { pattern: /\bti\b/gi, replacement: 'Titanium' },
    { pattern: /\bw\b/gi, replacement: 'Tungsten' }
  ];

  for (const { pattern, replacement } of expansions) {
    expanded = expanded.replace(pattern, replacement);
  }

  expanded = expanded.replace(/\s*([+&])\s*/g, ' $1 ');

  return expanded;
}

// Parse Ollama's JSON response
function parseOllamaResponse(responseText) {
  try {
    // Clean up response - sometimes Ollama adds extra text
    let jsonText = responseText.trim();

    // Try to extract JSON if wrapped in markdown code blocks
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Find first { and last }
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}') + 1;

    if (start !== -1 && end > start) {
      jsonText = jsonText.substring(start, end);
    }

    const parsed = JSON.parse(jsonText);

    // Validate and normalize the response
    const result = {
      name: stripMaterialFromName(parsed.name),
      dimensions: normalizeDimensions(parsed.dimensions),
      button_size: normalizeButtonSize(parsed.button_size),
      material: expandMaterialAbbreviations(parsed.material),
      weight: normalizeWeight(parsed.weight),
      finish: parsed.finish || null,
      price: parsed.price || null,
      variants: []
    };

    // Parse variants if present
    if (parsed.variants && Array.isArray(parsed.variants) && parsed.variants.length > 0) {
      result.variants = parsed.variants.map(v => ({
        material: expandMaterialAbbreviations(v.material) || null,
        weight: normalizeWeight(v.weight)
      })).filter(v => v.material); // Only keep variants with a material
    }

    return result;
  } catch (error) {
    console.error('Failed to parse Ollama response:', error);
    console.log('Raw response:', responseText);
    return null;
  }
}

// Normalize dimensions to standard format
function normalizeDimensions(dims) {
  if (!dims || dims === 'null' || dims.toLowerCase() === 'unknown') return null;

  // Extract numbers
  const numbers = dims.match(/\d+(?:\.\d+)?/g);
  if (numbers && numbers.length >= 3) {
    return `${numbers[0]}mm x ${numbers[1]}mm x ${numbers[2]}mm`;
  }

  return dims;
}

// Normalize button size
function normalizeButtonSize(size) {
  if (!size || size === 'null' || size.toLowerCase() === 'unknown') return null;

  const number = size.match(/\d+(?:\.\d+)?/);
  if (number) {
    return `${number[0]}mm`;
  }

  return size;
}

// Normalize weight
// Uses centralized TextNormalizer module if available
function normalizeWeight(weight) {
  if (!weight || weight === 'null' || (typeof weight === 'string' && weight.toLowerCase() === 'unknown')) return null;

  // Use centralized TextNormalizer if available
  if (typeof window !== 'undefined' && window.TextNormalizer) {
    return window.TextNormalizer.normalizeWeightString(weight);
  }

  // Fallback implementation
  const match = weight.match(/(\d+(?:\.\d+)?)\s*([a-z]+)?/i);
  if (match) {
    const value = match[1];
    const unit = match[2] ? match[2].toLowerCase() : 'g';

    if (unit === 'g' || unit === 'gram' || unit === 'grams' || unit === 'gg') {
      return `${value}g`;
    } else if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
      return `${value}oz`;
    }

    return `${value}${unit}`;
  }

  return weight;
}

// Test Ollama connection
async function testOllamaConnection(endpoint, model) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${endpoint}/api/tags`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Check if the specified model is available
    const models = data.models || [];
    const modelNames = models.map(m => m.name);
    const hasModel = modelNames.some(name => name.includes(model));

    return {
      success: true,
      available_models: modelNames,
      has_requested_model: hasModel
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Analyze image with vision model to identify material
async function identifyMaterialFromImage(imageUrl, availableMaterials, config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Check if Ollama is enabled in settings
  const settings = await browser.storage.local.get(['ollamaEnabled', 'ollamaEndpoint', 'ollamaVisionModel']);

  if (!settings.ollamaEnabled) {
    console.log('Ollama is disabled in settings');
    return null;
  }

  // Use settings if available
  if (settings.ollamaEndpoint) finalConfig.endpoint = settings.ollamaEndpoint;

  // Use vision model if configured, otherwise skip
  const visionModel = settings.ollamaVisionModel || 'llava:7b';
  if (!settings.ollamaVisionModel) {
    console.log('No vision model configured, skipping image analysis');
    return null;
  }

  try {
    console.log('Analyzing image with vision model:', imageUrl);

    // Download image and convert to base64
    const imageBase64 = await downloadImageAsBase64(imageUrl);
    if (!imageBase64) {
      console.warn('Failed to download image:', imageUrl);
      return null;
    }

    const materialsText = availableMaterials.join(', ');
    const prompt = `Look at this fidget spinner/slider image. Which material is it made from?

Available materials: ${materialsText}

Based on the color, finish, and appearance, identify which ONE material from the list above best matches this image. Respond with ONLY the material name, nothing else.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for vision (vision models are slow)

    const response = await fetch(`${finalConfig.endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: visionModel,
        prompt: prompt,
        images: [imageBase64],
        stream: false,
        options: {
          temperature: 0.1
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const identifiedMaterial = data.response.trim();

    console.log(`Vision model identified material: "${identifiedMaterial}"`);

    // Match against available materials (case-insensitive)
    const matched = availableMaterials.find(m =>
      m.toLowerCase() === identifiedMaterial.toLowerCase() ||
      identifiedMaterial.toLowerCase().includes(m.toLowerCase())
    );

    return matched || null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Vision model request timed out');
    } else {
      console.error('Vision model error:', error);
    }
    return null;
  }
}

// Download image and convert to base64
async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data URL prefix to get just base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

// Export functions
if (typeof window !== 'undefined') {
  window.OllamaClient = {
    parseWithOllama,
    testOllamaConnection,
    identifyMaterialFromImage
  };
}
