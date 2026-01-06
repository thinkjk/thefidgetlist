// Content script for page scraping and auto-detection

console.log('🚀🚀🚀 Fidget List Quick Add: Content script loaded - VERSION 2025-01-04 🚀🚀🚀');

// Extract basic information from the current page
function extractPageInfo() {
  const pageType = detectPageType();

  // Use Facebook-specific extraction if on Facebook
  if (pageType === 'facebook') {
    return extractFacebookPostInfo();
  }

  const selectors = SELECTORS[pageType] || SELECTORS.generic;

  // Get parsing options for this site
  const parsingOptions = typeof getParsingOptions === 'function' ? getParsingOptions() : {};

  let title = extractBySelectors(selectors.title);

  // Strip materials from title if configured (e.g., 2R Designs: "Phantom X - SS & Titanium" -> "Phantom X")
  if (parsingOptions.stripTitleMaterials && title && window.Materials) {
    const cleanedTitle = window.Materials.stripMaterialFromName(title);
    if (cleanedTitle && cleanedTitle !== title) {
      console.log(`📝 Stripped materials from title: "${title}" -> "${cleanedTitle}"`);
      title = cleanedTitle;
    }
  }

  const info = {
    pageType: pageType,
    url: window.location.href,
    title: title,
    description: extractBySelectors(selectors.description),
    image: extractImageBySelectors(selectors.image),
    images: extractAllImages(selectors.image),
    groupName: detectGroupFromDomain(),
    timestamp: new Date().toISOString()
  };

  // Extract all visible text from the page for parsing
  const pageText = document.body.innerText || document.body.textContent;

  // Also get the description from meta tag (often has full specs)
  const descriptionMeta = document.querySelector('meta[name="description"]') ||
                          document.querySelector('meta[property="og:description"]');
  const descriptionText = descriptionMeta ? descriptionMeta.getAttribute('content') : '';

  // Combine both sources for better parsing
  const combinedText = descriptionText + '\n' + pageText;

  // Try to extract structured product data (JSON-LD, Big Cartel, etc.)
  console.log('🔍 Attempting to extract structured data...');
  const structuredData = extractStructuredData();
  console.log('🔍 extractStructuredData returned:', structuredData);
  if (structuredData) {
    info.structuredData = structuredData;
    console.log('✅ Found structured product data:', structuredData);
  } else {
    console.log('❌ No structured data found');
  }

  // Parse product info from combined text (using regex)
  const parsedInfo = parseProductInfo(combinedText);
  info.parsedDimensions = parsedInfo.dimensions;
  info.parsedWeight = parsedInfo.weight;
  info.parsedMaterial = parsedInfo.material;
  info.parsedButtonSize = parsedInfo.buttonSize;
  info.parsedFinish = parsedInfo.finish;
  info.parsedPrice = parsedInfo.price;

  // Store combined text for potential Ollama parsing in popup
  info.fullText = combinedText.substring(0, 2000);

  console.log('Extracted page info:', info);
  console.log('Page text length:', pageText.length);
  console.log('Description text:', descriptionText.substring(0, 200));
  console.log('Parsed info:', parsedInfo);

  return info;
}

// Extract information from a Facebook post
function extractFacebookPostInfo() {
  console.log('📘 Extracting Facebook post info...');

  const info = {
    pageType: 'facebook',
    url: window.location.href,
    title: '',
    description: '',
    image: '',
    images: [],
    groupName: null, // Must be entered manually for Facebook
    timestamp: new Date().toISOString(),
    isFacebookPost: true
  };

  // Try to extract post text using multiple strategies
  const postText = extractFacebookPostText();
  console.log('📘 Extracted post text:', postText.substring(0, 500));

  // Try to extract a product name from the post
  // Common patterns: first line, quoted text, or text before specs
  info.title = extractProductNameFromPost(postText);
  info.description = postText;

  // Extract images from the post
  info.images = extractFacebookImages();
  info.image = info.images[0] || '';
  console.log('📘 Found', info.images.length, 'images');

  // Parse product info from post text
  const parsedInfo = parseProductInfo(postText);
  info.parsedDimensions = parsedInfo.dimensions;
  info.parsedWeight = parsedInfo.weight;
  info.parsedMaterial = parsedInfo.material;
  info.parsedButtonSize = parsedInfo.buttonSize;
  info.parsedFinish = parsedInfo.finish;
  info.parsedPrice = parsedInfo.price;

  // Store full text for AI enhancement
  info.fullText = postText.substring(0, 2000);

  // Try to detect group name from URL or page
  info.groupName = extractFacebookGroupName();

  console.log('📘 Facebook extraction result:', info);
  return info;
}

// Extract text content from a Facebook post
function extractFacebookPostText() {
  const selectors = SELECTORS.facebook?.postText || [
    '[data-ad-preview="message"]',
    '.userContent',
    '[data-testid="post_message"]',
    'div[dir="auto"]'
  ];

  // Strategy 1: Try specific post selectors
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.innerText?.trim();
      // Look for posts that likely contain product info (have dimensions, weights, materials)
      if (text && text.length > 50 && looksLikeProductPost(text)) {
        console.log('📘 Found post text via selector:', selector);
        return text;
      }
    }
  }

  // Strategy 2: Find the main post content area
  // Look for the largest text block that contains product-like info
  const allDivs = document.querySelectorAll('div[dir="auto"]');
  let bestMatch = '';
  let bestScore = 0;

  for (const div of allDivs) {
    const text = div.innerText?.trim();
    if (text && text.length > 30) {
      const score = scoreProductText(text);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = text;
      }
    }
  }

  if (bestMatch) {
    console.log('📘 Found post text via scoring, score:', bestScore);
    return bestMatch;
  }

  // Strategy 3: Fallback - get visible text from main content area
  const mainContent = document.querySelector('[role="main"]') || document.body;
  return mainContent.innerText?.substring(0, 3000) || '';
}

// Check if text looks like a product post
function looksLikeProductPost(text) {
  const lowerText = text.toLowerCase();
  const indicators = [
    /\d+\s*mm/i,           // Dimensions in mm
    /\d+\s*g\b/i,          // Weight in grams
    /titanium|zirconium|tungsten|copper|brass|stainless/i,  // Materials
    /spinner|slider|fidget/i,  // Product types
    /button/i,             // Button size mentions
    /\$\d+/,               // Price
    /pre-?order|drop|available|sold out/i  // Sales language
  ];

  let matchCount = 0;
  for (const pattern of indicators) {
    if (pattern.test(text)) matchCount++;
  }

  return matchCount >= 2;
}

// Score text based on how likely it is to be product info
function scoreProductText(text) {
  let score = 0;
  const lowerText = text.toLowerCase();

  // Positive indicators
  if (/\d+\s*mm\s*x\s*\d+/i.test(text)) score += 10;  // Dimensions
  if (/\d+\s*g\b/i.test(text)) score += 5;            // Weight
  if (/titanium|zirconium|tungsten|copper|brass/i.test(text)) score += 5;  // Materials
  if (/spinner|slider|fidget/i.test(text)) score += 3;
  if (/button\s*:?\s*\d+/i.test(text)) score += 5;    // Button size
  if (/\$\d+/.test(text)) score += 3;                 // Price
  if (/weight\s*:/i.test(text)) score += 5;           // Labeled weight
  if (/dimension|size/i.test(text)) score += 3;       // Dimension labels

  // Length bonus (prefer medium-length posts)
  if (text.length > 100 && text.length < 2000) score += 2;

  // Negative indicators (reduce score for non-product content)
  if (/comment|reply|like|share|write a comment/i.test(text)) score -= 5;
  if (/see more|view more/i.test(text)) score -= 2;

  return score;
}

// Extract product name from post text
function extractProductNameFromPost(text) {
  if (!text) return '';

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Strategy 1: First non-empty line that looks like a product name
  for (const line of lines.slice(0, 5)) {
    // Skip lines that are just specs or prices
    if (/^\$?\d+/.test(line)) continue;
    if (/^(weight|dimension|size|button|material):/i.test(line)) continue;
    if (/^\d+\s*mm\s*x/i.test(line)) continue;
    if (/^\d+\s*g$/i.test(line)) continue;

    // Good candidate: short line without too many numbers
    if (line.length > 3 && line.length < 100) {
      // Check it's not mostly numbers/specs
      const alphaRatio = (line.match(/[a-zA-Z]/g) || []).length / line.length;
      if (alphaRatio > 0.5) {
        console.log('📘 Extracted product name:', line);
        return line;
      }
    }
  }

  // Strategy 2: Look for quoted product names
  const quotedMatch = text.match(/[""]([^""]+)[""]|"([^"]+)"/);
  if (quotedMatch) {
    const name = quotedMatch[1] || quotedMatch[2];
    if (name.length > 3 && name.length < 100) {
      console.log('📘 Extracted quoted product name:', name);
      return name;
    }
  }

  // Strategy 3: Look for "Product Name - Material" pattern
  const dashMatch = text.match(/^([A-Z][a-zA-Z0-9\s]+)\s*[-–]\s*(Titanium|Zirconium|Tungsten|Brass|Copper|SS|Ti|Zr)/m);
  if (dashMatch) {
    console.log('📘 Extracted product name from dash pattern:', dashMatch[1]);
    return dashMatch[1].trim();
  }

  return '';
}

// Extract images from Facebook post
function extractFacebookImages() {
  const images = [];
  const seen = new Set();

  const selectors = SELECTORS.facebook?.postImages || [
    'img[data-visualcompletion="media-vc-image"]',
    '.spotlight img',
    'img[src*="scontent"]'
  ];

  // Also try to find images in the lightbox/theater view if open
  const theaterSelectors = [
    'img[data-visualcompletion="media-vc-image"]',
    '[role="dialog"] img[src*="scontent"]',
    '.spotlight img'
  ];

  const allSelectors = [...new Set([...selectors, ...theaterSelectors])];

  for (const selector of allSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const img of elements) {
      let src = img.src;

      // Skip tiny images (icons, avatars)
      if (img.width && img.width < 100) continue;
      if (img.height && img.height < 100) continue;

      // Skip profile pictures and emoji
      if (src.includes('emoji') || src.includes('profile')) continue;

      // Prefer high-res version if available
      // Facebook often has data attributes with higher res URLs
      const dataSrc = img.getAttribute('data-src') ||
                      img.getAttribute('data-src-large') ||
                      img.getAttribute('src');
      if (dataSrc && dataSrc.includes('scontent')) {
        src = dataSrc;
      }

      if (src && src.includes('scontent') && !seen.has(src)) {
        images.push(src);
        seen.add(src);

        if (images.length >= 10) break; // Limit to 10 images
      }
    }

    if (images.length >= 10) break;
  }

  console.log('📘 Extracted Facebook images:', images.length);
  return images;
}

// Try to extract group name from Facebook URL or page
function extractFacebookGroupName() {
  const url = window.location.href;

  // Check if URL contains group info
  const groupMatch = url.match(/facebook\.com\/groups\/([^\/]+)/);
  if (groupMatch) {
    // Try to get the actual group name from the page
    const groupNameSelectors = SELECTORS.facebook?.groupName || [
      'h1[role="heading"]',
      'a[role="link"][aria-label*="group"]',
      'h2 a[href*="/groups/"]'
    ];

    for (const selector of groupNameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const name = el.innerText?.trim() || el.getAttribute('aria-label');
        if (name && name.length > 2 && name.length < 100) {
          console.log('📘 Found Facebook group name:', name);
          return name;
        }
      }
    }

    // Fallback to group slug from URL
    return groupMatch[1].replace(/[._-]/g, ' ');
  }

  return null; // User will need to enter manually
}

// Helper: Extract text content by trying multiple selectors
function extractBySelectors(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      if (element.tagName === 'META') {
        return element.getAttribute('content');
      }
      return element.textContent.trim();
    }
  }
  return '';
}

// Helper: Extract image URL by trying multiple selectors
function extractImageBySelectors(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      if (element.tagName === 'META') {
        return element.getAttribute('content');
      } else if (element.tagName === 'IMG') {
        return element.src;
      }
    }
  }
  return '';
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractPageInfo') {
    const pageInfo = extractPageInfo();
    sendResponse({ success: true, data: pageInfo });
  }
  return true; // Keep channel open for async response
});

// Extract all images (not just the first one)
function extractAllImages(selectors) {
  const images = [];
  const seen = new Set();

  // Sections to exclude (related products, recommendations, etc.)
  const excludeSections = [
    '.related-products',
    '.product-recommendations',
    '.recommendations',
    '[class*="related"]',
    '[class*="recommend"]',
    '[id*="related"]',
    '[id*="recommend"]'
  ];

  // Check if this is a single-variant product page
  // Uses isSingleVariantSite() helper from selectors.js if available
  const pageType = detectPageType();
  const groupName = detectGroupFromDomain();

  // Use helper function if available, otherwise fall back to local check
  let singleVariant = false;
  if (typeof isSingleVariantSite === 'function') {
    singleVariant = isSingleVariantSite();
  } else {
    singleVariant = (pageType === 'ziiistudio') || (pageType === 'twedc') || (groupName === 'Clean EDC');
  }

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      // Skip if element is inside a related/recommended products section
      if (element.tagName === 'IMG') {
        const isInExcludedSection = excludeSections.some(excludeSelector => {
          return element.closest(excludeSelector) !== null;
        });
        if (isInExcludedSection) {
          continue; // Skip this image
        }
      }

      let imageUrl = null;

      if (element.tagName === 'META') {
        imageUrl = element.getAttribute('content');
      } else if (element.tagName === 'IMG') {
        imageUrl = element.src;
      }

      // Only add unique, valid URLs
      if (imageUrl && !seen.has(imageUrl) && imageUrl.startsWith('http')) {
        images.push(imageUrl);
        seen.add(imageUrl);

        // For single-variant sites, stop immediately after first image
        if (singleVariant) {
          return images;
        }
      }

      // For other sites, stop after 5 images
      if (images.length >= 5) {
        return images;
      }
    }

    // Check limits between selectors too
    if (singleVariant && images.length >= 1) break;
    if (images.length >= 5) break;
  }

  return images;
}

// Parse product information from text
// Uses centralized Parsers module if available, otherwise falls back to local implementation
function parseProductInfo(text) {
  const info = {
    dimensions: null,
    weight: null,
    material: null,
    buttonSize: null
  };

  if (!text) return info;

  // Use centralized Parsers module if available
  if (typeof window !== 'undefined' && window.Parsers) {
    console.log('Using centralized Parsers module');
    const result = window.Parsers.parseProductInfo(text);
    info.dimensions = result.dimensions;
    info.weight = result.weight;
    info.material = result.material;
    info.buttonSize = result.buttonSize;
    console.log('Centralized parser result:', result);
    return info;
  }

  // Fallback to local implementation
  console.log('Using fallback parser (centralized module not loaded)');
  console.log('Parsing text snippet:', text.substring(0, 500));

  // Parse dimensions - multiple patterns for different website styles
  // Note: Support both regular colon : and fullwidth colon ： (U+FF1A)
  const dimPatterns = [
    // Pattern 1: "Length: 46mm • Width of the body: 20mm • Body Thickness: 14mm" (CleanEDC style)
    // Use more specific capture groups to get the right numbers
    /Length[\s:：•]+(\d+(?:\.\d+)?)\s*mm[\s\S]{0,100}Width[^0-9]*(\d+(?:\.\d+)?)\s*mm[\s\S]{0,100}(?:Body\s+)?(?:Thickness|Height|Depth)[\s:：•]+(\d+(?:\.\d+)?)\s*mm/i,
    // Pattern 2: "Dimensions: 48mm x 29mm x 16mm" or "Size: 48 x 29 x 16" or "Spinner Size：50mm×24.5×12mm"
    /(?:dimensions?|size|measurements?|spinner\s*size)[\s:：]+(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?/i,
    // Pattern 3: Just "48mm x 29mm x 16mm" or "48 x 29 x 16mm" anywhere
    /(\d+(?:\.\d+)?)\s*mm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm/,
    // Pattern 4: "48 x 29 x 16" with optional mm (only if all three numbers are reasonable sizes)
    /(\d{1,3}(?:\.\d+)?)\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)/,
    // Pattern 5: "L: 48mm, W: 29mm, H: 16mm" or "L48 W29 H16"
    /[LlWwHh][\s:：]*(\d+(?:\.\d+)?)\s*(?:mm)?[\s,]+[LlWwHh][\s:：]*(\d+(?:\.\d+)?)\s*(?:mm)?[\s,]+[LlWwHh][\s:：]*(\d+(?:\.\d+)?)\s*(?:mm)?/,
    // Pattern 6: "body length：45.5mm" (TWEDC style - only has length, not full dimensions)
    /body\s*length[\s:：]+(\d+(?:\.\d+)?)\s*mm/i
  ];

  for (let i = 0; i < dimPatterns.length; i++) {
    const pattern = dimPatterns[i];
    const dimMatch = text.match(pattern);
    if (dimMatch) {
      const [full, l, w, h] = dimMatch;

      // Validate all three dimensions exist and are numbers
      if (!l || !w || !h) {
        console.log(`Pattern ${i}: Missing dimension values:`, l, w, h);
        continue;
      }

      const lNum = parseFloat(l);
      const wNum = parseFloat(w);
      const hNum = parseFloat(h);

      // Skip if any number is 0 or if numbers are too large (likely not dimensions)
      if (lNum === 0 || wNum === 0 || hNum === 0) {
        console.log(`Pattern ${i}: Skipping (contains zero):`, l, w, h);
        continue;
      }

      if (lNum > 500 || wNum > 500 || hNum > 500) {
        console.log(`Pattern ${i}: Skipping (numbers too large):`, l, w, h);
        continue;
      }

      // Normalize to "Lmm x Wmm x Hmm"
      info.dimensions = `${l}mm x ${w}mm x ${h}mm`;
      console.log(`Pattern ${i}: Found dimensions:`, info.dimensions, 'from:', full.substring(0, 150));
      break;
    } else {
      console.log(`Pattern ${i}: No match`);
    }
  }

  // Parse weight - multiple patterns
  // Note: Support both regular colon : and fullwidth colon ： (U+FF1A)
  const weightPatterns = [
    // Pattern 1: Variant-specific weights like "Dama BT:95g.Mokume:110g." or "Weight: Material:123g"
    // This is a special case - we'll capture all variants and store as a note
    /weight[\s:：]+([a-zA-Z0-9\s:：]+\d+(?:\.\d+)?g[.,]?)+/i,
    // Pattern 2: Standard "weight: 123g" or "weight: 123 grams"
    /weight[\s:：]+(\d+(?:\.\d+)?)\s*(?:g|grams?|oz|ounces?)\b/i,
    // Pattern 3: TWEDC style "SS 55g Ti 30g Zr 46g W 140g" - multiple materials with weights
    // We'll parse all of them and try to match based on product title material
    /(?:SS|Ti|Zr|W|Cu|Brass|Copper|Tungsten|Titanium|Zirconium)\s+(\d{1,3}(?:\.\d+)?g)/i,
    // Pattern 4: Just a number followed by weight unit (but not prices with decimals like 225.00)
    // Only match whole numbers or single decimal (like 95.5g, not 225.00)
    /\b(\d{1,3}(?:\.\d)?)\s*(?:g|grams?)\b/i,
    /\b(\d{1,3}(?:\.\d)?)\s*(?:oz|ounces?)\b/i
  ];

  // For TWEDC: Check if text has multi-material format "SS 55g Ti 30g Zr 46g W 140g"
  // Parse all materials and try to match with material from title
  const multiMaterialPattern = /(SS|Ti|Zr|W|Cu|Brass|Copper|Tungsten|Titanium|Zirconium)\s+(\d{1,3}(?:\.\d+)?)g/gi;
  const multiMaterialMatches = [...text.matchAll(multiMaterialPattern)];

  if (multiMaterialMatches.length > 1) {
    console.log('Found TWEDC multi-material format:', multiMaterialMatches.length, 'materials');
    console.log('All material weights:', multiMaterialMatches.map(m => `${m[1]} ${m[2]}g`));

    // Try to find which material this product is (from beginning of text - likely title)
    // Search in first 300 chars for material keywords
    const firstPart = text.substring(0, 300);
    // Try multiple patterns to find the material
    let titleMaterialMatch = firstPart.match(/[-–]\s*(Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Bronze|Aluminum|Ti|Zr|W|SS|Cu)(?:\s*[-–]|\s|$)/i);

    // If no dash pattern, try without dash (material might be in product name directly)
    if (!titleMaterialMatch) {
      titleMaterialMatch = firstPart.match(/(Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Bronze|Aluminum|Ti|Zr|W|SS|Cu)/i);
    }

    if (titleMaterialMatch) {
      const titleMaterial = titleMaterialMatch[1].toLowerCase().replace(/\s+/g, '');
      console.log('Product material from title:', titleMaterial);

      // Find matching weight for this material
      for (const match of multiMaterialMatches) {
        const abbr = match[1].toLowerCase();
        const weight = match[2];

        // Create normalized versions for comparison
        const abbrNorm = abbr.replace(/\s+/g, '');

        // Match abbreviation to full name or direct match
        const isMatch =
          (titleMaterial === 'titanium' && abbrNorm === 'ti') ||
          (titleMaterial === 'ti' && abbrNorm === 'ti') ||
          (titleMaterial === 'zirconium' && abbrNorm === 'zr') ||
          (titleMaterial === 'zr' && abbrNorm === 'zr') ||
          (titleMaterial === 'tungsten' && abbrNorm === 'w') ||
          (titleMaterial === 'w' && abbrNorm === 'w') ||
          (titleMaterial === 'stainlesssteel' && abbrNorm === 'ss') ||
          (titleMaterial === 'ss' && abbrNorm === 'ss') ||
          (titleMaterial === 'copper' && abbrNorm === 'cu') ||
          (titleMaterial === 'cu' && abbrNorm === 'cu') ||
          (titleMaterial === 'brass' && abbrNorm === 'brass') ||
          (titleMaterial === 'bronze' && abbrNorm === 'bronze') ||
          (titleMaterial === 'aluminum' && abbrNorm === 'aluminum');

        if (isMatch) {
          info.weight = weight + 'g';
          console.log(`✓ Matched material "${titleMaterial}" to "${abbr}" = ${info.weight}`);
          break;
        }
      }

      // If no match found, default to first weight
      if (!info.weight && multiMaterialMatches.length > 0) {
        info.weight = multiMaterialMatches[0][2] + 'g';
        console.log(`⚠ No material match found, using first weight as fallback: ${info.weight}`);
      }
    }
  }

  // Standard weight parsing (if not already found from multi-material format)
  if (!info.weight) {
    for (let i = 0; i < weightPatterns.length; i++) {
      const pattern = weightPatterns[i];
      const weightMatch = text.match(pattern);
      if (weightMatch) {
        // Special handling for variant-specific weights (Pattern 1)
        if (i === 0 && weightMatch[0].includes(':')) {
          // Extract just the first weight value for the main field
          const firstWeight = weightMatch[0].match(/(\d+(?:\.\d+)?g)/);
          if (firstWeight) {
            info.weight = firstWeight[1];
            console.log('Found variant-specific weights:', weightMatch[0]);
            console.log('Using first weight value:', info.weight);
          }
        } else if (i === 2) {
          // Skip pattern 3 (TWEDC multi-material) since we already handled it above
          continue;
        } else {
          // Standard weight parsing
          info.weight = weightMatch[1] ? (weightMatch[0].includes('oz') ? weightMatch[0] : weightMatch[1] + 'g') : weightMatch[0].replace(/\s+/g, '');
          console.log('Found weight:', info.weight);
        }
        break;
      }
    }
  }

  // Parse button size - multiple patterns
  // Note: Support both regular colon : and fullwidth colon ： (U+FF1A)
  const buttonPatterns = [
    // Pattern 1: "Button Sizes: 24.5mm / 17mm" or "Button Size: 24.5mm"
    /button\s*sizes?[\s:：]+(\d+(?:\.\d+)?)\s*mm/i,
    // Pattern 2: "button diameter：24.5mm" (TWEDC style)
    /button\s*diameter[\s:：]+(\d+(?:\.\d+)?)\s*mm/i,
    // Pattern 3: "button: 24.5mm" or "24.5mm button" (but NOT "buttons: 40g")
    /button[\s:：]+(\d+(?:\.\d+)?)\s*mm\b/i,
    /(\d+(?:\.\d+)?)\s*mm\s*button\b/i,
    // Pattern 4: "button is 24.5mmX15mm" or "button is 24.5mm"
    /button\s+is\s+(\d+(?:\.\d+)?)\s*mm/i,
  ];

  for (const pattern of buttonPatterns) {
    const buttonMatch = text.match(pattern);
    if (buttonMatch) {
      const size = buttonMatch[1];
      // Make sure we didn't accidentally match weight (like "buttons: 40g")
      const fullMatch = buttonMatch[0];
      if (!fullMatch.toLowerCase().includes('g)') && !fullMatch.toLowerCase().includes('grams')) {
        info.buttonSize = size.includes('mm') ? size : size + 'mm';
        console.log('Found button size:', info.buttonSize, 'from:', fullMatch);
        break;
      }
    }
  }

  // Parse material (common fidget materials)
  // Check title/product name first for most accurate material detection
  const materials = [
    'stainless steel', // Check compound names first
    'carbon fiber',
    'mokume gane',
    'mokume',
    'timascus',
    'zircuti',
    'damasteel',
    'damascus',
    'tungsten carbide',
    'tungsten',
    'titanium',
    'zirconium',
    'aluminum',
    'copper',
    'brass',
    'bronze',
    'resin',
    'ultem',
    'peek',
    'delrin',
    'g10',
    'micarta',
    'wood',
    'acrylic',
    'steel'
  ];

  const lowerText = text.toLowerCase();

  // Check for material in title first (TWEDC format: "Product Name - Material" or "Product Name - Material - Finish")
  // Search only in first 200 chars (likely to be the title/product name)
  const titlePart = text.substring(0, 200);
  const titleMaterialPattern = /[-–]\s*(Titanium|Zirconium|Tungsten|Stainless\s*Steel|Copper|Brass|Bronze|Aluminum|Ti|Zr|W|SS|Cu)(?:\s*[-–]|$)/i;
  const titleMaterialMatch = titlePart.match(titleMaterialPattern);
  if (titleMaterialMatch) {
    const materialRaw = titleMaterialMatch[1].trim();
    console.log('Found material in title:', materialRaw);

    // Expand abbreviations
    let expandedMaterial = materialRaw
      .replace(/\bss\b/gi, 'Stainless Steel')
      .replace(/\bti\b/gi, 'Titanium')
      .replace(/\bzr\b/gi, 'Zirconium')
      .replace(/\bw\b/gi, 'Tungsten')
      .replace(/\bcu\b/gi, 'Copper');

    // Capitalize first letter of each word
    expandedMaterial = expandedMaterial.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');

    info.material = expandedMaterial;
    console.log('Expanded title material to:', info.material);
    return info; // Return early so we don't override with other patterns
  }

  // Check for explicit "Material: xxx" or "Material：xxx" pattern (ziiistudio format)
  // Support both regular colon : and fullwidth colon ： (U+FF1A)
  // Match until we hit another keyword (Finish, Weight, Size, etc.)
  if (!info.material) {
    const materialLabelPattern = /material[\s:：]+([A-Za-z0-9+&]+?)(?=Finish|Weight|Size|Button|Spinner|BEARING|\s|$)/i;
    const materialLabelMatch = text.match(materialLabelPattern);
    if (materialLabelMatch) {
      const materialRaw = materialLabelMatch[1].trim();
      console.log('Found material with label:', materialRaw);

      // Expand abbreviations in the extracted material
      const expandedMaterial = materialRaw
        .replace(/\bzirc\b/gi, 'Zirconium')
        .replace(/\bzr\b/gi, 'Zirconium')
        .replace(/\bti\b/gi, 'Titanium')
        .replace(/\bcu\b/gi, 'Copper')
        .replace(/\bw\b/gi, 'Tungsten')
        .replace(/\bss\b/gi, 'Stainless Steel')
        // Clean up spacing around separator
        .replace(/([+&])/g, ' $1 ');

      info.material = expandedMaterial;
      console.log('Expanded material to:', info.material);
      return info;
    }
  }

  // Check for compound materials with + or & (e.g., "Zirc+W", "Zr+W", "Ti&Cu")
  // Only check if we haven't found material yet
  if (!info.material) {
    const compoundPattern = /(zirc?|zr|ti|cu|w|ss|brass|copper|tungsten|titanium|zirconium)[\s]*([+&])[\s]*(zirc?|zr|ti|cu|w|ss|brass|copper|tungsten|titanium|zirconium)/i;
    const compoundMatch = text.match(compoundPattern);
    if (compoundMatch) {
      const compound = compoundMatch[0];
      const separator = compoundMatch[2]; // Preserve + or &
      console.log('Found compound material:', compound);

      // Expand abbreviations
      const expandedCompound = compound
        .replace(/\bzirc?\b/gi, 'Zirconium')
        .replace(/\bzr\b/gi, 'Zirconium')
        .replace(/\bti\b/gi, 'Titanium')
        .replace(/\bcu\b/gi, 'Copper')
        .replace(/\bw\b/gi, 'Tungsten')
        .replace(/\bss\b/gi, 'Stainless Steel')
        // Clean up spacing around separator
        .replace(/\s*[+&]\s*/g, ` ${separator} `);

      info.material = expandedCompound;
      console.log('Expanded to:', info.material);
      return info;
    }
  }

  // First check the beginning of the text (likely title) for material
  const firstPart = text.substring(0, 200).toLowerCase();
  for (const material of materials) {
    if (firstPart.includes(material)) {
      // Proper case the material
      info.material = material.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      console.log('Found material:', info.material, '(from title/start)');
      return info; // Found in title, highest confidence
    }
  }

  // If not found in title, check full text
  for (const material of materials) {
    if (lowerText.includes(material)) {
      // Proper case the material
      info.material = material.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      console.log('Found material:', info.material, '(from body text)');
      break;
    }
  }

  // If still not found, check for single abbreviations and expand them
  if (!info.material) {
    const abbreviationPatterns = [
      { abbr: /\bzirc\b/i, full: 'Zirconium' },
      { abbr: /\bzr\b/i, full: 'Zirconium' },
      { abbr: /\bss\b/i, full: 'Stainless Steel' },
      { abbr: /\bti\b/i, full: 'Titanium' },
      { abbr: /\bcu\b/i, full: 'Copper' },
      { abbr: /\bw\b/i, full: 'Tungsten' },
      { abbr: /\bsc\b/i, full: 'Superconductor' }
    ];

    for (const { abbr, full } of abbreviationPatterns) {
      if (abbr.test(text)) {
        info.material = full;
        console.log('Found abbreviated material:', full, '(from abbreviation)');
        break;
      }
    }
  }

  // Parse finish
  const finishes = [
    'stonewash', 'stonewashed', 'polished', 'polish', 'brushed',
    'bead blasted', 'beadblasted', 'anodized', 'powder coated',
    'cerakote', 'machine finish', 'raw', 'tumbled'
  ];

  for (const finish of finishes) {
    if (lowerText.includes(finish)) {
      info.finish = finish.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      break;
    }
  }

  // Parse price
  const pricePattern = /\$\s*(\d+(?:\.\d{2})?)\s*(?:USD)?/i;
  const priceMatch = text.match(pricePattern);
  if (priceMatch) {
    info.price = `$${priceMatch[1]}`;
  }

  return info;
}

// Extract structured data from page (JSON-LD, Big Cartel, etc.)
function extractStructuredData() {
  console.log('🔍 extractStructuredData called');
  console.log('🔍 typeof window.bigcartel:', typeof window.bigcartel);
  console.log('🔍 typeof window.BIGCARTEL_PRODUCT_DATA:', typeof window.BIGCARTEL_PRODUCT_DATA);

  // Try Big Cartel first (window.bigcartel.product)
  if (typeof window.bigcartel !== 'undefined' && window.bigcartel.product) {
    console.log('🔍 Found window.bigcartel.product, calling parseBigCartelData');
    return parseBigCartelData(window.bigcartel.product);
  }

  // Fallback to window.BIGCARTEL_PRODUCT_DATA
  if (typeof window.BIGCARTEL_PRODUCT_DATA !== 'undefined') {
    console.log('🔍 Found window.BIGCARTEL_PRODUCT_DATA');
    const bcData = window.BIGCARTEL_PRODUCT_DATA;
    if (bcData && bcData.product) {
      console.log('🔍 Found bcData.product, calling parseBigCartelData');
      return parseBigCartelData(bcData.product);
    }
  }

  console.log('🔍 Big Cartel data not found, searching scripts...');

  // Try to find Big Cartel data in script tags
  const scripts = document.querySelectorAll('script');
  console.log(`🔍 Found ${scripts.length} script tags`);

  for (const script of scripts) {
    const content = script.textContent;

    // Look for window.BIGCARTEL_PRODUCT_DATA = {...}
    const bcMatch = content.match(/window\.BIGCARTEL_PRODUCT_DATA\s*=\s*({[\s\S]*?});/);
    if (bcMatch) {
      console.log('🔍 Found BIGCARTEL_PRODUCT_DATA in script tag');
      try {
        const data = JSON.parse(bcMatch[1]);
        if (data && data.product) {
          console.log('🔍 Parsed data successfully, calling parseBigCartelData');
          return parseBigCartelData(data.product);
        }
      } catch (e) {
        console.warn('Failed to parse Big Cartel data:', e);
      }
    }
  }

  // Try Shopify meta data (var meta = {...})
  for (const script of scripts) {
    const content = script.textContent;
    const metaMatch = content.match(/var meta\s*=\s*(\{[\s\S]*?\});/);
    if (metaMatch) {
      console.log('🔍 Found Shopify meta data');
      try {
        const data = JSON.parse(metaMatch[1]);
        if (data && data.product && data.product.variants) {
          console.log('🔍 Parsed Shopify meta successfully');
          return parseShopifyMeta(data.product);
        }
      } catch (e) {
        console.warn('Failed to parse Shopify meta:', e);
      }
    }
  }

  // Try JSON-LD (schema.org)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data['@type'] === 'Product') {
        return parseJsonLd(data);
      }
    } catch (e) {
      console.warn('Failed to parse JSON-LD:', e);
    }
  }

  return null;
}

// Parse Shopify meta product data
function parseShopifyMeta(product) {
  console.log('🔍 parseShopifyMeta called with product:', product);

  const result = {
    source: 'shopify-meta',
    variants: [],
    images: []
  };

  // Get page description for weight extraction
  const descriptionMeta = document.querySelector('meta[name="description"]');
  const description = descriptionMeta ? descriptionMeta.getAttribute('content') : '';
  const pageText = document.body.innerText || '';

  // Extract variants from Shopify meta
  if (product.variants && Array.isArray(product.variants)) {
    console.log(`🔍 Found ${product.variants.length} Shopify variants`);

    product.variants.forEach((variant, index) => {
      // Use public_title for material name (e.g., "Titanium", "Stainless Steel")
      const materialName = variant.public_title || variant.title || variant.name;
      console.log(`🔍 Processing variant ${index}: ${materialName}`);

      const variantObj = {
        name: materialName,
        price: variant.price ? (variant.price / 100).toFixed(2) : null, // Shopify stores price in cents
        soldOut: false,
        weight: null
      };

      // Try to extract weight for this material from page text
      // Pattern: "Material: 114g" or "Material: 114g / 4.02oz"
      const weightPatterns = [
        new RegExp(materialName + '\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*g', 'i'),
        new RegExp(materialName + '\\s+(\\d+(?:\\.\\d+)?)\\s*g', 'i')
      ];

      for (const pattern of weightPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          variantObj.weight = match[1] + 'g';
          console.log(`🔍 Found weight for ${materialName}: ${variantObj.weight}`);
          break;
        }
      }

      result.variants.push(variantObj);
    });
  }

  // Extract images from page
  const imageSelectors = [
    '.product-single__photo img',
    '.product__photo img',
    '.product-featured-img',
    '[data-product-image]',
    '.product__media img'
  ];

  for (const selector of imageSelectors) {
    const images = document.querySelectorAll(selector);
    images.forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && !result.images.includes(src)) {
        result.images.push(src);
      }
    });
    if (result.images.length > 0) break;
  }

  // If no images found, try OG image
  if (result.images.length === 0) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      result.images.push(ogImage.getAttribute('content'));
    }
  }

  console.log('🔍 parseShopifyMeta result:', result);
  return result;
}

// Parse Big Cartel product data
function parseBigCartelData(product) {
  console.log('🔍 parseBigCartelData called with product:', product);
  console.log('🔍 Product name:', product.name);
  console.log('🔍 Product options:', product.options);

  const result = {
    source: 'bigcartel',
    variants: [],
    images: []
  };

  // Get description text for weight extraction
  const description = product.description || '';

  // Extract variants (options in Big Cartel)
  if (product.options && Array.isArray(product.options)) {
    product.options.forEach(option => {
      console.log('🔍 Processing option:', option);
      console.log('🔍 Option name:', option.name);

      const variant = {
        name: option.name,
        price: option.price,
        soldOut: option.sold_out,
        weight: null
      };

      // Try to extract weight for this specific variant from description
      // Pattern: "VariantName:123g" or "VariantName: 123g"
      const weightPattern = new RegExp(option.name + '[\\s:]+([\\d.]+)\\s*g', 'i');
      const weightMatch = description.match(weightPattern);
      if (weightMatch) {
        variant.weight = weightMatch[1] + 'g';
        console.log(`🔍 Found weight for ${option.name}:`, variant.weight);
      }

      console.log('🔍 Final variant object:', variant);
      result.variants.push(variant);
    });
  }

  // Extract images
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (img.url) {
        result.images.push(img.url);
      }
    });
  }

  return result;
}

// Parse JSON-LD product data
function parseJsonLd(data) {
  console.log('🔍 parseJsonLd called with data:', data);

  const result = {
    source: 'jsonld',
    variants: [],
    images: []
  };

  // Get product description for weight extraction and ordering
  const description = data.description || '';

  // Extract variants/offers
  if (data.offers) {
    const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
    console.log(`🔍 Found ${offers.length} offers in JSON-LD`);

    offers.forEach((offer, index) => {
      console.log(`🔍 Processing offer ${index}:`, offer);

      if (offer.name || offer.sku) {
        let materialName = offer.name || offer.sku;

        // Extract material from name if it's in format "Product Name (Material)"
        // Example: "Preorder Exotic Cell Mokume and Dama BT hand spinner (Mokume)"
        const materialMatch = materialName.match(/\(([^)]+)\)$/);
        if (materialMatch) {
          materialName = materialMatch[1];
          console.log(`🔍 Extracted material from parentheses: "${materialName}"`);
        }

        // Extract variant suffix if format is "Product Name - Variant" (e.g., "Stainless Steel XL Slim Pillar - MF")
        // This is the actual variant part that might be a finish option
        let variantSuffix = materialName;
        const variantMatch = materialName.match(/\s*-\s*([^-]+)$/);
        if (variantMatch) {
          variantSuffix = variantMatch[1].trim();
          console.log(`🔍 Extracted variant suffix: "${variantSuffix}"`);
        }

        // Check if variant suffix is a finish option (not a material)
        // Common finish patterns: "etched", "polished", "MF", "stonewashed", "bead blasted", etc.
        const finishPatterns = /(etched|eteched|polish|MF|stonewash|bead\s*blast|brush|satin|mirror|anodize|cerakote|hammer|crystallize|finish|coating|tumble|sand\s*blast)/i;
        const isFinishOption = finishPatterns.test(variantSuffix) && !/(titanium|brass|copper|bronze|aluminum|steel|tungsten|zirconium)/i.test(variantSuffix);

        // If variant is a finish option, try to extract material from product name
        if (isFinishOption) {
          console.log(`🔍 "${materialName}" appears to be a finish option, checking product name for material...`);

          // Extract material from product name (e.g., "Mokume Bar Cell hand spinner" -> "Mokume")
          const productName = data.name || '';
          const knownMaterials = ['Mokume', 'Damascus', 'Damasteel', 'Timascus', 'Mokuti', 'Zircuti',
                                   'Tungsten', 'Titanium', 'Zirconium', 'Stainless Steel', 'Copper',
                                   'Brass', 'Bronze', 'Aluminum', 'Aluminium', 'Superconductor'];

          for (const mat of knownMaterials) {
            if (productName.toLowerCase().includes(mat.toLowerCase())) {
              materialName = mat;
              console.log(`🔍 Found material "${mat}" in product name`);
              break;
            }
          }
        }

        // Expand abbreviations to full material names
        // IMPORTANT: Order matters! Check longer strings first (e.g., Zircuti before Zirc)
        const materialAbbreviations = [
          { abbr: 'Zircuti', full: 'Zircuti' },
          { abbr: 'Timascus', full: 'Timascus' },
          { abbr: 'Damascus', full: 'Damascus' },
          { abbr: 'Mokuti', full: 'Mokuti' },
          { abbr: 'Tungsten', full: 'Tungsten' },
          { abbr: 'Aluminum', full: 'Aluminum' },
          { abbr: 'Aluminium', full: 'Aluminum' },
          { abbr: 'Bronze', full: 'Bronze' },
          { abbr: 'Brass', full: 'Brass' },
          { abbr: 'Zirc', full: 'Zirconium' },
          { abbr: 'Zr', full: 'Zirconium' },
          { abbr: 'SS', full: 'Stainless Steel' },
          { abbr: 'Ti', full: 'Titanium' },
          { abbr: 'W', full: 'Tungsten' },
          { abbr: 'CU', full: 'Copper' },
          { abbr: 'Cu', full: 'Copper' },
          { abbr: 'SC', full: 'Superconductor' }
        ];

        // Extract base material from variant name (e.g., "SS MF" -> "SS", "Ti polished" -> "Ti")
        let baseMaterial = materialName.trim();
        let expandedMaterial = materialName.trim();
        let materialWasExpanded = false;

        // Try to find abbreviation at the start of the material name (check longest matches first)
        for (const { abbr, full } of materialAbbreviations) {
          const abbrRegex = new RegExp('^' + abbr + '(?:\\s|$)', 'i');
          if (abbrRegex.test(materialName)) {
            baseMaterial = abbr;
            // Replace abbreviation with full name, keep the rest (e.g., "SS MF" -> "Stainless Steel MF")
            expandedMaterial = materialName.replace(abbrRegex, full + ' ').trim();
            materialWasExpanded = true;
            console.log(`🔍 Expanded "${materialName}" to "${expandedMaterial}" (base: ${baseMaterial})`);
            break;
          }
        }

        // If material wasn't expanded (e.g., it's already a full name like "Mokume"),
        // set both to the same value
        if (!materialWasExpanded) {
          baseMaterial = materialName;
          expandedMaterial = materialName;
          console.log(`🔍 Material already in full form: "${materialName}"`);
        }

        const variant = {
          name: expandedMaterial,
          price: parseFloat(offer.price),
          soldOut: offer.availability === 'http://schema.org/OutOfStock' ||
                   offer.availability === 'https://schema.org/OutOfStock',
          weight: null
        };

        // Try to extract weight for this specific variant from description
        // Multiple patterns to try:
        const escapedBaseMaterial = baseMaterial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let weightMatch = null;

        // Pattern 1: "MaterialName:123g" or "MaterialName: 123g" (e.g., "SS: 90g", "Mokume: 96g")
        let weightPattern = new RegExp(escapedBaseMaterial + '\\s*:\\s*([\\d.]+)\\s*g', 'i');
        weightMatch = description.match(weightPattern);

        // Pattern 2: "MaterialName - 123g" (e.g., "Mokume - 96g")
        if (!weightMatch) {
          weightPattern = new RegExp(escapedBaseMaterial + '\\s*-\\s*([\\d.]+)\\s*g', 'i');
          weightMatch = description.match(weightPattern);
          if (weightMatch) {
            console.log(`🔍 Found weight with dash pattern: ${escapedBaseMaterial} - ${weightMatch[1]}g`);
          }
        }

        // Pattern 3: Generic "Weight: 96g" (for single-material products)
        if (!weightMatch) {
          weightPattern = /Weight\s*:\s*([\d.]+)\s*g/i;
          weightMatch = description.match(weightPattern);
          if (weightMatch) {
            console.log(`🔍 Found generic weight in description: ${weightMatch[1]}g`);
          }
        }

        // Pattern 4: "weighs 96g" in prose
        if (!weightMatch) {
          weightPattern = new RegExp(escapedBaseMaterial + '[\\s\\w]*weighs?[\\s:]*([\d.]+)\\s*g', 'i');
          weightMatch = description.match(weightPattern);
          if (weightMatch) {
            console.log(`🔍 Found weight in prose: ${weightMatch[1]}g`);
          }
        }

        if (weightMatch) {
          variant.weight = weightMatch[1] + 'g';
          console.log(`🔍 Found weight for ${baseMaterial} (${expandedMaterial}): ${variant.weight}`);
        } else {
          console.log(`🔍 No weight found for ${baseMaterial} (${expandedMaterial}) in description`);
        }

        console.log(`🔍 Final variant object:`, variant);

        // Store baseMaterial for deduplication
        variant.baseMaterial = baseMaterial;
        result.variants.push(variant);
      }
    });

    // Deduplicate variants by base material - keep only the first occurrence of each base material
    // This consolidates finish variants (e.g., "Brass Mini Hammer Finish", "Brass Light Polish") into one "Brass" variant
    const seenBaseMaterials = new Set();
    const uniqueVariants = [];

    for (const variant of result.variants) {
      const base = variant.baseMaterial;
      if (!seenBaseMaterials.has(base)) {
        seenBaseMaterials.add(base);
        // Clean up the name - remove finish details, just keep the base material
        // Match more finish keywords to handle CleanEDC and similar sites
        variant.name = variant.name.split(/\s+(MF|polish|etched|eteched|pattern|circle|lines|colors|black|oil slick|hammer|stonewash|crystallize|brush|satin|mirror|finish|coating|tumble|sand\s*blast|bead\s*blast|anodize|cerakote|mini|light|dark)/i)[0].trim();
        delete variant.baseMaterial; // Remove internal tracking field
        uniqueVariants.push(variant);
      } else {
        console.log(`🔍 Skipping duplicate variant: ${variant.name} (base: ${base})`);
      }
    }

    result.variants = uniqueVariants;
    console.log(`🔍 Deduplicated to ${uniqueVariants.length} unique variants:`, uniqueVariants.map(v => v.name));

    // Sort variants by the order they appear in the description
    // This helps match images to variants more accurately
    if (result.variants.length > 1 && description) {
      result.variants.sort((a, b) => {
        const posA = description.toLowerCase().indexOf(a.name.toLowerCase());
        const posB = description.toLowerCase().indexOf(b.name.toLowerCase());
        if (posA === -1) return 1;
        if (posB === -1) return -1;
        return posA - posB;
      });
      console.log(`🔍 Sorted variants by description order:`, result.variants.map(v => v.name));
    }
  }

  // Extract images
  if (data.image) {
    const images = Array.isArray(data.image) ? data.image : [data.image];
    images.forEach(img => {
      const url = typeof img === 'string' ? img : img.url;
      if (url) {
        result.images.push(url);
      }
    });
  }

  // Assign images to variants
  // Try vision model first if available, otherwise use order-based assignment
  if (result.variants.length > 0 && result.images.length > 0) {
    // Mark that we need vision analysis (will be done by caller if Ollama vision is enabled)
    result.needsVisionAnalysis = true;

    // For now, assign images in order as fallback
    result.variants.forEach((variant, index) => {
      // Assign image to variant - if we have fewer images than variants, reuse images
      const imageIndex = index < result.images.length ? index : index % result.images.length;
      variant.image = result.images[imageIndex];
      console.log(`🔍 Assigned image ${imageIndex + 1} to variant "${variant.name}" (order-based)`);
    });
  }

  console.log('🔍 parseJsonLd final result:', result);
  return result;
}

// Auto-extract on page load (optional, for debugging)
window.addEventListener('load', () => {
  console.log('Page loaded, ready to extract info');
});
